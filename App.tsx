
import React, { useEffect } from 'react';
import { MainUI } from './components/MainUI';
import { ModalManager } from './components/ModalManager';
import { ToastContainer, LoadingModal } from './components/Modals';
import { Loader2 } from 'lucide-react';

import { useCoreState } from './hooks/useCoreState';
import { useUIState } from './hooks/useUIState';
import { useFileHandler } from './hooks/useFileHandler';
import { useTranslationEngine } from './hooks/useTranslationEngine';
import { useAutomation } from './hooks/useAutomation';

import { FileStatus, StoryInfo } from './types';
import { DEFAULT_PROMPT } from './constants';
import { generateCoverImage, createCoverPrompt, analyzeStoryContext, analyzeNameBatch, analyzeContextBatch, mergeContexts, optimizePrompt } from './geminiService';
import { deduplicateDictionary, formatBookStyle, countForeignChars } from './utils/textHelpers';
import { downloadTextFile, sortFiles } from './utils/fileHelpers';
import { quotaManager } from './utils/quotaManager';

const App: React.FC = () => {
  // 1. Initialize State Hooks
  const ui = useUIState();
  const core = useCoreState(ui.addToast);
  
  // 2. Initialize Logic Hooks (Dependency Injection)
  const engine = useTranslationEngine(core, ui);
  const fileHandler = useFileHandler(core, ui);
  const automation = useAutomation(core, ui, engine);

  // --- Helpers that bridge hooks ---
  
  // Auto-sync Cover Image Preview whenever core.coverImage changes
  useEffect(() => {
      if (core.coverImage) {
          const url = URL.createObjectURL(core.coverImage);
          ui.setCoverPreviewUrl(url);
          return () => URL.revokeObjectURL(url);
      } else {
          ui.setCoverPreviewUrl(null);
      }
  }, [core.coverImage]);

  // Manual Cleanup (needs UI + Core)
  const handleManualCleanup = (scope: 'all' | 'selected') => {
      let count = 0;
      const newFiles = core.files.map(f => {
          if (scope === 'selected' && !ui.selectedFiles.has(f.id)) return f;
          if (f.translatedContent && f.status === FileStatus.COMPLETED) {
              const cleaned = formatBookStyle(f.translatedContent);
              if (cleaned !== f.translatedContent) {
                  count++;
                  const newRawCount = countForeignChars(cleaned);
                  return { ...f, translatedContent: cleaned, remainingRawCharCount: newRawCount };
              }
          }
          return f;
      });
      if (count > 0) {
          core.setFiles(newFiles);
          ui.addToast(`Trợ Lý Local đã lọc rác & định dạng chuẩn cho ${count} file.`, 'success');
      } else {
          ui.addToast(`Trợ Lý Local: Các file đã sạch và chuẩn form sách in.`, 'info');
      }
  };

  // Smart Start Run
  const handleSmartStartRun = async (useSearch: boolean, additionalRules: string, sampling: {start: number, middle: number, end: number}) => {
      if (!core.storyInfo.title) { ui.addToast("Vui lòng nhập tên truyện", 'error'); return; }
      try {
          ui.setSmartStartStep('analyzing');
          ui.addToast("Bắt đầu phân tích ngữ cảnh mẫu...", 'info');
          const glossaryResult = await analyzeStoryContext(core.files, core.storyInfo, core.promptTemplate, core.additionalDictionary, useSearch, additionalRules, sampling);
          
          const currentDict = core.additionalDictionary || "";
          const prefix = currentDict.trim() ? "\n\n" : "";
          const newFullDictionary = currentDict.trim() + prefix + glossaryResult;
          const newContextNotes = (core.storyInfo.contextNotes || "") + (core.storyInfo.contextNotes ? "\n\n" : "") + glossaryResult;
          
          core.setAdditionalDictionary(newFullDictionary);
          core.setStoryInfo(prev => ({ ...prev, contextNotes: newContextNotes, additionalRules: additionalRules }));
          ui.setDictTab('custom');
          
          const postAnalysisStoryInfo = { ...core.storyInfo, contextNotes: newContextNotes, additionalRules: additionalRules };
          
          if (ui.autoOptimizePrompt) {
              ui.setSmartStartStep('optimizing');
              ui.addToast("Đang kiến trúc Prompt dựa trên ngữ cảnh vừa tìm được...", 'info');
              const optimized = await optimizePrompt(DEFAULT_PROMPT, postAnalysisStoryInfo, newContextNotes, newFullDictionary, additionalRules);
              core.setPromptTemplate(optimized);
          }
          
          core.saveSession(); // Trigger save
          ui.setSmartStartStep('idle');
          ui.setShowSmartStartModal(false);
          ui.addToast("Đã cập nhật bộ quy tắc & Series Bible mới!", 'success');
          ui.setShowStartOptions(true);
          
      } catch (e: any) {
          ui.setSmartStartStep('idle');
          ui.addToast(`Lỗi Smart Start: ${e.message}`, 'error');
      }
  };

  // Name Analysis
  const handleNameAnalysis = async (config: { mode: 'only_char' | 'full' | 'deep_context'; scope: 'smart' | 'range' | 'full'; rangeStart: number; rangeEnd: number; updatedStoryInfo: StoryInfo; useSearch: boolean; additionalRules?: string; sampling?: {start: number, middle: number, end: number} }) => {
      if (core.files.length === 0) return;
      core.setStoryInfo(config.updatedStoryInfo);
      ui.setIsAnalyzingNames(true);
      ui.setNameAnalysisProgress({ current: 0, total: 1, stage: 'Đang chuẩn bị dữ liệu...' });
      
      let filesToAnalyze = sortFiles([...core.files]);
      const totalFileCount = filesToAnalyze.length;
      
      if (config.scope === 'range') {
          const startIdx = Math.max(0, config.rangeStart - 1);
          const endIdx = Math.min(totalFileCount, config.rangeEnd);
          filesToAnalyze = filesToAnalyze.slice(startIdx, endIdx);
      }

      const allContent = filesToAnalyze.map(f => f.content).join('\n');
      const chunks = [];
      const CHUNK_SIZE = 800000;
      for (let i = 0; i < allContent.length; i += CHUNK_SIZE) chunks.push(allContent.substring(i, i + CHUNK_SIZE));
      
      ui.setNameAnalysisProgress({ current: 0, total: chunks.length, stage: `Đang phân tích 0/${chunks.length} phần` });
      const results: string[] = [];

      try {
          for (let i = 0; i < chunks.length; i += 2) {
              const batch = chunks.slice(i, i + 2);
              ui.setNameAnalysisProgress({ current: i + 1, total: chunks.length, stage: `Đang phân tích Batch...` });
              const batchPromises = batch.map((chunk, idx) => {
                  const modelId = (i + idx) % 2 === 0 ? 'gemini-3-pro-preview' : 'gemini-2.5-pro';
                  if (config.mode === 'deep_context') {
                      return analyzeContextBatch(chunk, config.updatedStoryInfo, core.additionalDictionary, config.useSearch, [modelId], config.additionalRules || "");
                  } else {
                      return analyzeNameBatch(chunk, config.updatedStoryInfo, config.mode as 'only_char' | 'full', config.useSearch, config.additionalRules || "", [modelId]);
                  }
              });
              results.push(...await Promise.all(batchPromises));
          }

          if (config.mode === 'deep_context') {
              const mergedContext = await mergeContexts(results, config.updatedStoryInfo);
              core.setStoryInfo(prev => ({ ...prev, contextNotes: prev.contextNotes ? prev.contextNotes + "\n" + mergedContext : mergedContext }));
              downloadTextFile(`${config.updatedStoryInfo.title}_Context.txt`, mergedContext);
          } else {
              const cleanDictionary = deduplicateDictionary(results.join("\n"));
              core.setAdditionalDictionary(prev => (prev ? prev + '\n' + cleanDictionary : cleanDictionary));
              ui.setDictTab('custom');
              downloadTextFile(`${config.updatedStoryInfo.title}_Dictionary.txt`, cleanDictionary);
          }
          ui.addToast("Phân tích hoàn tất!", "success");
      } catch (e: any) {
          ui.addToast(`Lỗi phân tích: ${e.message}`, "error");
      } finally {
          ui.setIsAnalyzingNames(false);
          ui.setShowNameAnalysisModal(false);
      }
  };

  // --- UI Handlers ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) fileHandler.processFiles(Array.from(e.target.files)); e.target.value = ''; };
  
  // Confirmed Delete Handlers
  const handleRemoveFile = (id: string) => { 
      ui.setConfirmModal({
          isOpen: true,
          title: "Xóa File?",
          message: "Bạn có chắc chắn muốn xóa file này không?",
          isDanger: true,
          confirmText: "Xóa Ngay",
          onConfirm: () => {
              core.setFiles(prev => prev.filter(f => f.id !== id)); 
              ui.setSelectedFiles(prev => { const n = new Set(prev); n.delete(id); return n; }); 
              ui.setConfirmModal(prev => ({...prev, isOpen: false}));
              ui.addToast("Đã xóa file", "success");
          },
          onCancel: () => ui.setConfirmModal(prev => ({...prev, isOpen: false}))
      });
  };

  const handleSmartDelete = () => {
      if (ui.selectedFiles.size === 0) return;
      ui.setConfirmModal({
          isOpen: true,
          title: `Xóa ${ui.selectedFiles.size} File?`,
          message: "Hành động này sẽ xóa các file đang chọn khỏi danh sách. Bạn có chắc không?",
          isDanger: true,
          confirmText: "Xóa Tất Cả Chọn",
          onConfirm: () => {
              core.setFiles(prev => prev.filter(f => !ui.selectedFiles.has(f.id)));
              ui.setSelectedFiles(new Set());
              ui.setConfirmModal(prev => ({...prev, isOpen: false}));
              ui.addToast("Đã xóa các file đã chọn", "success");
          },
          onCancel: () => ui.setConfirmModal(prev => ({...prev, isOpen: false}))
      });
  };

  const requestDeleteAll = () => {
      if (core.files.length === 0) return;
      ui.setConfirmModal({
          isOpen: true,
          title: "Xóa Toàn Bộ?",
          message: "CẢNH BÁO: Hành động này sẽ xóa sạch tất cả các file hiện có. Dữ liệu chưa lưu sẽ bị mất.",
          isDanger: true,
          confirmText: "XÓA HẾT",
          onConfirm: () => {
              core.setFiles([]);
              ui.setSelectedFiles(new Set());
              ui.setConfirmModal(prev => ({...prev, isOpen: false}));
              ui.addToast("Đã dọn sạch danh sách file", "success");
          },
          onCancel: () => ui.setConfirmModal(prev => ({...prev, isOpen: false}))
      });
  };

  const handleSelectFile = (id: string, shiftKey: boolean) => {
      const newSelected = new Set(ui.selectedFiles);
      if (shiftKey && ui.lastSelectedId) {
          const idx1 = core.files.findIndex(f => f.id === ui.lastSelectedId);
          const idx2 = core.files.findIndex(f => f.id === id);
          const start = Math.min(idx1, idx2);
          const end = Math.max(idx1, idx2);
          for (let i = start; i < end + 1; i++) newSelected.add(core.files[i].id);
      } else {
          if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
          ui.setLastSelectedId(id);
      }
      ui.setSelectedFiles(newSelected);
  };
  const selectAll = () => { if (ui.selectedFiles.size === core.files.length) ui.setSelectedFiles(new Set()); else ui.setSelectedFiles(new Set(core.files.map(f => f.id))); };
  
  const handleQuickParse = () => {
      if (!ui.quickInput.trim()) return;
      const items = ui.quickInput.split(/[,;\n]+/).map(s => s.trim()).filter(s => s);
      // Logic to parse genres/settings from string (simplified)
      // ... update storyInfo
      ui.setQuickInput('');
      ui.addToast("Đã cập nhật thẻ thông tin", "success");
  };

  // Visible Files Calculation (Moved from Hook to Render for simplicity, or keep in UI Hook if preferred)
  const visibleFiles = React.useMemo(() => {
        let filtered = core.files;
        if (ui.filterStatuses.size > 0 || ui.filterModels.size > 0) {
            // Filter logic is handled in WorkspacePage, this passes raw files
            // or we duplicate logic?
            // Actually WorkspacePage handles filtering locally for display now. 
            // So we pass full list to WorkspacePage and it handles filtering.
            // BUT if pagination relies on filtered list...
            // Let's keep it simple: WorkspacePage handles filtering logic.
        }
        if (ui.currentPage === 0) return filtered;
        const startIndex = (ui.currentPage - 1) * 50;
        return filtered.slice(startIndex, startIndex + 50);
  }, [core.files, ui.currentPage]);

  const totalPages = Math.ceil(core.files.length / 50);

  // Stats
  const stats = {
      total: core.files.length,
      completed: core.files.filter(f => f.status === FileStatus.COMPLETED).length,
      failed: core.files.filter(f => f.status === FileStatus.ERROR).length,
      processing: core.files.filter(f => f.status === FileStatus.PROCESSING || f.status === FileStatus.REPAIRING).length,
      pending: core.files.filter(f => f.status === FileStatus.IDLE).length
  };
  const progressPercentage = core.files.length > 0 ? Math.round((stats.completed / core.files.length) * 100) : 0;

  // Render
  if (core.isResetting) {
      return ( <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-600 animate-in fade-in"> <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" /> <h2 className="text-xl font-bold">Resetting System...</h2> </div> );
  }

  return (
    <div className={`h-[100dvh] w-screen flex flex-col font-sans transition-colors duration-300 overflow-hidden ${ui.isDarkMode ? 'dark bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-800'}`} onDragOver={e => {e.preventDefault(); ui.setIsDragging(true)}} onDragLeave={e => {e.preventDefault(); ui.setIsDragging(false)}} onDrop={e => {e.preventDefault(); ui.setIsDragging(false); if(e.dataTransfer.files) fileHandler.processFiles(Array.from(e.dataTransfer.files));}}>
      <ToastContainer toasts={ui.toasts} removeToast={ui.removeToast} />
      {ui.importProgress && <LoadingModal isOpen={!!ui.importProgress} progress={ui.importProgress} />}
      {ui.actionProgress && <LoadingModal isOpen={!!ui.actionProgress} progress={ui.actionProgress} />}
      
      <ModalManager 
        // State Props
        showPasteModal={ui.showPasteModal} setShowPasteModal={ui.setShowPasteModal}
        showFindReplace={ui.showFindReplace} setShowFindReplace={ui.setShowFindReplace}
        confirmModal={ui.confirmModal} setConfirmModal={ui.setConfirmModal}
        importModal={ui.importModal} setImportModal={ui.setImportModal}
        splitterModal={ui.splitterModal} setSplitterModal={ui.setSplitterModal}
        zipActionModal={ui.zipActionModal} setZipActionModal={ui.setZipActionModal}
        showGuide={ui.showGuide} setShowGuide={ui.setShowGuide}
        showStartOptions={ui.showStartOptions} setShowStartOptions={ui.setShowStartOptions}
        showNameAnalysisModal={ui.showNameAnalysisModal} setShowNameAnalysisModal={ui.setShowNameAnalysisModal}
        showSmartStartModal={ui.showSmartStartModal} setShowSmartStartModal={ui.setShowSmartStartModal}
        showChangelog={ui.showChangelog} setShowChangelog={ui.setShowChangelog}
        editingFileId={ui.editingFileId} setEditingFileId={ui.setEditingFileId}
        showRetranslateModal={ui.showRetranslateModal} setShowRetranslateModal={ui.setShowRetranslateModal}
        showEpubModal={ui.showEpubModal} setShowEpubModal={ui.setShowEpubModal}
        showLogs={ui.showLogs} setShowLogs={ui.setShowLogs}
        systemLogs={ui.systemLogs} clearLogs={ui.clearLogs}
        showPromptDesigner={ui.showPromptDesigner} setShowPromptDesigner={ui.setShowPromptDesigner}
        showAutomationModal={ui.showAutomationModal} setShowAutomationModal={ui.setShowAutomationModal}
        
        // Data Props
        files={core.files}
        storyInfo={core.storyInfo}
        setStoryInfo={core.setStoryInfo}
        coverImage={core.coverImage}
        setCoverImage={core.setCoverImage}
        dictionary={core.additionalDictionary}
        setAdditionalDictionary={core.setAdditionalDictionary}
        promptTemplate={core.promptTemplate}
        totalFiles={core.files.length}
        selectedCount={ui.selectedFiles.size}
        isOptimizingPrompt={ui.isOptimizingPrompt}
        
        // Handlers from Hooks
        handlePasteConfirm={fileHandler.handlePasteConfirm}
        handleImportAppend={fileHandler.handleImportAppend}
        handleImportOverwrite={fileHandler.handleImportOverwrite}
        handleSplitConfirm={fileHandler.handleSplitConfirm}
        handleZipKeepSeparate={fileHandler.handleZipKeepSeparate}
        handleZipMergeAndSplit={fileHandler.handleZipMergeAndSplit}
        handleEpubConfirm={fileHandler.performEpubGeneration}
        
        handleConfirmStart={(tier) => { ui.setShowStartOptions(false); engine.setTranslationTier(tier); engine.executeProcessing(); }}
        handleRetranslateConfirm={engine.handleRetranslateConfirm}
        
        handlePromptDesignerConfirm={automation.handlePromptDesignerConfirm}
        handleAutomationStart={automation.handleAutomationStart}
        handleAutomationStop={() => { automation.stopAutomation(); engine.stopProcessing(); }} // Stop both logic
        automationState={automation.automationState}
        
        // PASS NEW CONFIG PROPS
        automationInitialConfig={ui.automationInitialConfig} 
        
        handleNameAnalysis={handleNameAnalysis}
        nameAnalysisProgress={ui.nameAnalysisProgress}
        isAnalyzingNames={ui.isAnalyzingNames} 
        
        handleSmartStartRun={handleSmartStartRun}
        handleSkipSmartStart={() => { ui.setShowSmartStartModal(false); ui.setShowStartOptions(true); }}
        smartStartStep={ui.smartStartStep}
        autoOptimizePrompt={ui.autoOptimizePrompt}
        setAutoOptimizePrompt={ui.setAutoOptimizePrompt}
        
        saveEditor={(id, content) => { core.setFiles(prev => prev.map(f => f.id === id ? {...f, translatedContent: content, status: FileStatus.COMPLETED} : f)); ui.setEditingFileId(null); }}
        addToast={ui.addToast}
        handleFindReplace={(find, replace, scope) => { /* Implement find replace logic here or in handler */ }}
        
        isSmartAutoMode={engine.isSmartAutoMode}
        selectedTemplateKey="" setSelectedTemplateKey={() => {}}
        handleFindReplaceInFile={() => {}}
      />

      <MainUI 
        files={core.files}
        stats={stats}
        progressPercentage={progressPercentage}
        storyInfo={core.storyInfo}
        setStoryInfo={core.setStoryInfo}
        
        showSettings={ui.showSettings}
        setShowSettings={ui.setShowSettings}
        showLogs={ui.showLogs}
        setShowLogs={ui.setShowLogs}
        systemLogs={ui.systemLogs}
        hasLogErrors={ui.hasLogErrors}
        isDragging={ui.isDragging}
        
        isAutoSaving={core.isAutoSaving}
        lastSaved={core.lastSaved}
        
        enabledModels={core.enabledModels}
        toggleModel={(id) => core.setEnabledModels(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])}
        modelConfigs={core.modelConfigs}
        
        // --- PASS REAL MODEL USAGES HERE ---
        modelUsages={core.modelUsages} 
        
        handleManualResetQuota={() => quotaManager.resetDailyQuotas()}
        handleTestModel={() => {}}
        testingModelId={null}
        
        batchLimits={core.batchLimits}
        setBatchLimits={core.setBatchLimits}
        ratioLimits={core.ratioLimits}
        setRatioLimits={core.setRatioLimits}
        
        isDarkMode={ui.isDarkMode}
        toggleDarkMode={ui.toggleDarkMode}
        
        // Dashboard
        coverPreviewUrl={ui.coverPreviewUrl}
        handleCoverUpload={() => {}}
        handleAutoAnalyze={automation.handleAutoAnalyze}
        isAutoAnalyzing={ui.isAutoAnalyzing}
        autoAnalyzeStatus={ui.autoAnalyzeStatus}
        quickInput={ui.quickInput}
        setQuickInput={ui.setQuickInput}
        handleQuickParse={handleQuickParse}
        handleRegenerateCover={async () => { 
             ui.setIsGeneratingCover(true);
             try {
                 const prompt = await createCoverPrompt(core.storyInfo); 
                 const cover = await generateCoverImage(prompt);
                 if(cover) {
                     core.setCoverImage(cover);
                     ui.addToast("Đã vẽ lại bìa thành công!", "success");
                 } else {
                     ui.addToast("Không thể tạo ảnh bìa.", "error");
                 }
             } catch(e) { ui.addToast("Lỗi tạo bìa", "error"); }
             finally { ui.setIsGeneratingCover(false); }
        }}
        isGeneratingCover={ui.isGeneratingCover}
        handleBackup={fileHandler.handleBackup}
        handleRestore={fileHandler.handleRestore}
        requestResetApp={core.performSoftReset}
        
        // Knowledge
        handleContextDownload={() => downloadTextFile("Context.txt", core.storyInfo.contextNotes || "")}
        handleContextFileUpload={() => {}}
        setShowContextBuilder={ui.setShowContextBuilder}
        setShowNameAnalysisModal={ui.setShowNameAnalysisModal}
        isAnalyzingNames={ui.isAnalyzingNames}
        setShowSmartStartModal={ui.setShowSmartStartModal}
        viewOriginalPrompt={ui.viewOriginalPrompt}
        setViewOriginalPrompt={ui.setViewOriginalPrompt}
        handlePromptUpload={() => {}}
        resetPrompt={() => core.setPromptTemplate(DEFAULT_PROMPT)}
        promptTemplate={core.promptTemplate}
        setPromptTemplate={core.setPromptTemplate}
        handleOptimizePrompt={() => ui.setShowPromptDesigner(true)}
        isOptimizingPrompt={ui.isOptimizingPrompt}
        handleDictionaryDownload={() => downloadTextFile("Dictionary.txt", core.additionalDictionary)}
        handleDictionaryUpload={() => {}}
        dictTab={ui.dictTab}
        setDictTab={ui.setDictTab}
        additionalDictionary={core.additionalDictionary}
        setAdditionalDictionary={core.setAdditionalDictionary}
        setShowPromptDesigner={ui.setShowPromptDesigner}
        
        // Workspace
        currentPage={ui.currentPage}
        setCurrentPage={ui.setCurrentPage}
        totalPages={totalPages}
        visibleFiles={visibleFiles} // Calculated locally
        selectedFiles={ui.selectedFiles}
        handleSelectFile={handleSelectFile}
        handleManualFixSingle={engine.handleManualFixSingle}
        handleRescueCopy={() => {}}
        requestRetranslateSingle={(e, id) => { e.stopPropagation(); ui.setSelectedFiles(new Set([id])); ui.setShowRetranslateModal(true); }}
        openEditor={(f) => ui.setEditingFileId(f.id)}
        handleRemoveFile={handleRemoveFile}
        handleFileUpload={handleFileUpload}
        setShowPasteModal={ui.setShowPasteModal}
        selectAll={selectAll}
        rangeStart={ui.rangeStart}
        setRangeStart={ui.setRangeStart}
        rangeEnd={ui.rangeEnd}
        setRangeEnd={ui.setRangeEnd}
        handleRangeSelect={() => { /* Implement range select */ }}
        setShowFindReplace={ui.setShowFindReplace}
        isProcessing={engine.isProcessing}
        handleSmartFix={engine.handleSmartFix}
        
        showFilterPanel={ui.showFilterPanel}
        setShowFilterPanel={ui.setShowFilterPanel}
        filterModels={ui.filterModels}
        filterStatuses={ui.filterStatuses}
        toggleFilterModel={(k) => ui.setFilterModels(p => { const n = new Set(p); if(n.has(k)) n.delete(k); else n.add(k); return n; })}
        toggleFilterStatus={(k) => ui.setFilterStatuses(p => { const n = new Set(p); if(n.has(k)) n.delete(k); else n.add(k); return n; })}
        clearFilters={() => { ui.setFilterModels(new Set()); ui.setFilterStatuses(new Set()); }}
        
        handleScanJunk={fileHandler.handleScanJunk}
        handleManualCleanup={handleManualCleanup}
        setShowRetranslateModal={ui.setShowRetranslateModal}
        handleSmartDelete={handleSmartDelete} // Use the new wrapper
        requestDeleteAll={requestDeleteAll} // Use the new wrapper
        
        handleDownloadRaw={fileHandler.handleDownloadRaw}
        handleDownloadTranslatedZip={fileHandler.handleDownloadTranslatedZip}
        handleDownloadMerged={fileHandler.handleDownloadMerged}
        handleDownloadSelected={() => { /* Download selected */ }}
        handleDownloadEpub={() => ui.setShowEpubModal(true)}
        
        stopProcessing={() => { engine.stopProcessing(); automation.stopAutomation(); }}
        handleStartButton={() => { if(core.files.length > 0) ui.setShowStartOptions(true); }}
        
        setShowAutomationModal={ui.setShowAutomationModal}
        automationState={automation.automationState}
        handleRetranslateConfirm={engine.handleRetranslateConfirm}
        
        // PASS NEW SETTER PROP
        setAutomationInitialConfig={ui.setAutomationInitialConfig}

        onShowChangelog={() => ui.setShowChangelog(true)}
        startTime={engine.startTime}
        endTime={engine.endTime}
        setShowGuide={ui.setShowGuide}
        selectedTemplateKey=""
        setSelectedTemplateKey={() => {}}
      />
    </div>
  );
};

export default App;