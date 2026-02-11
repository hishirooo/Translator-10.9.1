
import React, { useState, useMemo } from 'react';
import { 
    LayoutDashboard, BookOpen, PenTool,
    Plus, Clipboard, CheckSquare, ArrowRight, Check, Search, Sparkles, Loader2, 
    Hammer, ListFilter, Eraser, Bot, RefreshCw, Trash2, FileDown, FileArchive, 
    FileText, Play, Book, Zap, PauseCircle
} from 'lucide-react';
import { Header } from './Header';
import { DashboardPage } from './DashboardPage';
import { KnowledgePage } from './KnowledgePage';
import { WorkspacePage } from './WorkspacePage';
import { getInvalidPronounLines } from '../utils/textHelpers';
import { AutomationConfig } from '../types';
import { DEFAULT_PROMPT } from '../constants'; // Import DEFAULT_PROMPT for smart check

// Import Types and Interfaces used in props
import { FileItem, StoryInfo, ModelQuota, BatchLimits, TranslationTier, RatioLimits, FileStatus } from '../types';

interface MainUIProps {
    // ... (All existing props)
    files: FileItem[];
    stats: any;
    progressPercentage: number;
    storyInfo: StoryInfo;
    setStoryInfo: React.Dispatch<React.SetStateAction<StoryInfo>>;
    
    // UI State Props
    showSettings: boolean;
    setShowSettings: (v: boolean) => void;
    showLogs: boolean;
    setShowLogs: (v: boolean) => void;
    systemLogs: any[];
    hasLogErrors: boolean;
    isDragging: boolean;
    
    // Header & Sidebar Logic
    onShowChangelog: () => void;
    isAutoSaving: boolean;
    lastSaved: Date | null;
    enabledModels: string[];
    modelConfigs: ModelQuota[];
    modelUsages: any;
    toggleModel: (id: string) => void;
    handleManualResetQuota: () => void;
    handleTestModel: (id: string) => void;
    testingModelId: string | null;
    startTime: number | null;
    endTime: number | null;
    
    // Batch Config Logic
    batchLimits: BatchLimits;
    setBatchLimits: React.Dispatch<React.SetStateAction<BatchLimits>>;
    
    // Ratio Config Logic
    ratioLimits: RatioLimits;
    setRatioLimits: React.Dispatch<React.SetStateAction<RatioLimits>>;

    // Dark Mode Props
    isDarkMode: boolean;
    toggleDarkMode: () => void;

    // Dashboard Logic
    coverPreviewUrl: string | null;
    handleCoverUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleAutoAnalyze: () => void;
    isAutoAnalyzing: boolean;
    autoAnalyzeStatus: string;
    quickInput: string;
    setQuickInput: (v: string) => void;
    handleQuickParse: () => void;
    handleRegenerateCover: () => void;
    isGeneratingCover: boolean;
    handleBackup: () => void;
    handleRestore: (e: React.ChangeEvent<HTMLInputElement>) => void;
    requestResetApp: () => void;

    // Knowledge Logic
    handleContextDownload: () => void;
    handleContextFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    setShowContextBuilder: (v: boolean) => void;
    setShowNameAnalysisModal: (v: boolean) => void;
    isAnalyzingNames: boolean;
    setShowSmartStartModal: (v: boolean) => void;
    viewOriginalPrompt: boolean;
    setViewOriginalPrompt: (v: boolean) => void;
    handlePromptUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    resetPrompt: () => void;
    promptTemplate: string;
    setPromptTemplate: (v: string) => void;
    handleOptimizePrompt: () => void;
    isOptimizingPrompt: boolean;
    selectedTemplateKey: string;
    setSelectedTemplateKey: (v: string) => void;
    handleDictionaryDownload: () => void;
    handleDictionaryUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    dictTab: 'custom' | 'default';
    setDictTab: (v: 'custom' | 'default') => void;
    additionalDictionary: string;
    setAdditionalDictionary: (v: string) => void;
    setShowPromptDesigner: (v: boolean) => void;

    // Workspace Logic
    currentPage: number;
    setCurrentPage: (v: number) => void;
    totalPages: number;
    visibleFiles: FileItem[];
    selectedFiles: Set<string>;
    handleSelectFile: (id: string, shiftKey: boolean) => void;
    handleManualFixSingle: (e: React.MouseEvent, id: string) => void;
    handleRescueCopy: (e: React.MouseEvent, file: FileItem) => void; // Added prop definition
    requestRetranslateSingle: (e: React.MouseEvent, id: string) => void;
    openEditor: (file: FileItem) => void;
    handleRemoveFile: (id: string) => void;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    setShowPasteModal: (v: boolean) => void;
    selectAll: () => void;
    rangeStart: string;
    setRangeStart: (v: string) => void;
    rangeEnd: string;
    setRangeEnd: (v: string) => void;
    handleRangeSelect: () => void;
    setShowFindReplace: (v: boolean) => void;
    isProcessing: boolean;
    handleSmartFix: () => void;
    showFilterPanel: boolean;
    setShowFilterPanel: (v: boolean) => void;
    filterModels: Set<string>;
    filterStatuses: Set<string>;
    toggleFilterModel: (key: string) => void;
    toggleFilterStatus: (key: string) => void;
    clearFilters: () => void;
    handleScanJunk: () => void;
    handleManualCleanup: (scope: 'all' | 'selected') => void;
    setShowRetranslateModal: (v: boolean) => void;
    handleSmartDelete: () => void;
    requestDeleteAll: () => void;
    handleDownloadRaw: () => void;
    handleDownloadTranslatedZip: () => void;
    handleDownloadMerged: () => void;
    handleDownloadSelected: () => void;
    handleDownloadEpub: () => void;
    stopProcessing: () => void;
    handleStartButton: () => void;
    
    // AUTOMATION PROPS
    setShowAutomationModal: (v: boolean) => void;
    automationState: { isRunning: boolean, currentStep: number, countdown: number };
    setAutomationInitialConfig: (v: { steps: number[], rules: string, tier: TranslationTier }) => void; // New Prop
    
    handleRetranslateConfirm: (keepOld: boolean, tier: TranslationTier) => void;
    setShowGuide: (v: boolean) => void;
}

type Tab = 'dashboard' | 'knowledge' | 'workspace';

export const MainUI: React.FC<MainUIProps> = (props) => {
    const [activeTab, setActiveTab] = useState<Tab>('workspace');

    const fixableCount = useMemo(() => {
        const raw = props.files.filter(f => f.status === FileStatus.COMPLETED && f.remainingRawCharCount > 0).length;
        const error = props.files.filter(f => f.status === FileStatus.ERROR && !f.errorMessage?.includes("English")).length;
        const english = props.files.filter(f => f.status === FileStatus.ERROR && f.errorMessage?.includes("English")).length;
        const processing = props.files.filter(f => f.status === FileStatus.PROCESSING || f.status === FileStatus.REPAIRING).length;
        const pronoun = props.files.filter(f => 
            f.status === FileStatus.COMPLETED && 
            f.remainingRawCharCount === 0 && 
            getInvalidPronounLines(f.translatedContent || "", props.storyInfo.genres).length > 0
        ).length;
        return raw + error + english + processing + pronoun;
    }, [props.files, props.storyInfo.genres]);

    // SMART AUTOMATION LOGIC (UPDATED WITH LOWER THRESHOLDS)
    const handleSmartAutomationClick = () => {
        const currentRules = props.storyInfo.additionalRules || "";
        
        // 1. Check Metadata: Relaxed check. Just title and at least 1 genre is enough.
        const hasMetadata = !!(props.storyInfo.title && props.storyInfo.title.trim().length > 0) && (props.storyInfo.genres.length > 0);
        
        // 2. Check Context: Relaxed check (> 10 chars is enough to assume user input).
        const hasDict = props.additionalDictionary && props.additionalDictionary.trim().length > 10;
        const hasCtx = props.storyInfo.contextNotes && props.storyInfo.contextNotes.trim().length > 10;
        const hasContextData = hasDict || hasCtx;
        
        // 3. Check Prompt: Relaxed check.
        const isNotDefaultPrompt = props.promptTemplate.trim() !== DEFAULT_PROMPT.trim();
        const hasRuleInput = currentRules.trim().length > 5;
        const hasPromptConfig = isNotDefaultPrompt || hasRuleInput;

        let stepsToRun = [1, 2, 3, 4, 5, 6];

        if (hasMetadata) {
            stepsToRun = stepsToRun.filter(s => s !== 1);
        }
        if (hasContextData) {
            stepsToRun = stepsToRun.filter(s => s !== 2);
        }
        if (hasPromptConfig) {
            stepsToRun = stepsToRun.filter(s => s !== 3);
        }

        // Default to translation steps if all prep work is done (or weird state)
        if (stepsToRun.length === 0) stepsToRun = [4, 5, 6];

        // Update Config & Open Modal
        props.setAutomationInitialConfig({
            steps: stepsToRun,
            rules: currentRules,
            tier: 'normal'
        });
        props.setShowAutomationModal(true);
    };

    return (
        <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-200 transition-colors duration-300 overflow-hidden">
            {/* 1. Universal Header */}
            <div className="flex-none z-50">
                <Header 
                    // ... (Existing header props)
                    stats={props.stats}
                    showLogs={props.showLogs}
                    setShowLogs={props.setShowLogs}
                    showSettings={props.showSettings}
                    setShowSettings={props.setShowSettings}
                    onShowChangelog={props.onShowChangelog}
                    enabledModels={props.enabledModels}
                    modelConfigs={props.modelConfigs}
                    modelUsages={props.modelUsages}
                    toggleModel={props.toggleModel}
                    handleManualResetQuota={props.handleManualResetQuota}
                    handleTestModel={props.handleTestModel}
                    testingModelId={props.testingModelId}
                    startTime={props.startTime}
                    endTime={props.endTime}
                    hasLogErrors={props.hasLogErrors}
                    progressPercentage={props.progressPercentage}
                    batchLimits={props.batchLimits}
                    setBatchLimits={props.setBatchLimits}
                    ratioLimits={props.ratioLimits}
                    setRatioLimits={props.setRatioLimits}
                    isDarkMode={props.isDarkMode}
                    toggleDarkMode={props.toggleDarkMode}
                />

                <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-800/60 shadow-sm pt-2 pb-0">
                    <div className="max-w-7xl mx-auto px-4 flex gap-4 overflow-x-auto no-scrollbar">
                        <button onClick={() => setActiveTab('dashboard')} className={`flex-1 min-w-[140px] py-3 px-4 rounded-t-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all relative top-[1px] border-x border-t ${activeTab === 'dashboard' ? 'bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-900 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50 shadow-[0_-2px_6px_rgba(0,0,0,0.02)]' : 'bg-transparent text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400'}`}> <div className={`p-1.5 rounded-lg ${activeTab === 'dashboard' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}> <LayoutDashboard className="w-4 h-4" /> </div> Thông Tin </button>
                        <button onClick={() => setActiveTab('knowledge')} className={`flex-1 min-w-[140px] py-3 px-4 rounded-t-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all relative top-[1px] border-x border-t ${activeTab === 'knowledge' ? 'bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-900 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/50 shadow-[0_-2px_6px_rgba(0,0,0,0.02)]' : 'bg-transparent text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-amber-600 dark:hover:text-amber-400'}`}> <div className={`p-1.5 rounded-lg ${activeTab === 'knowledge' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}> <BookOpen className="w-4 h-4" /> </div> Tri Thức </button>
                        <button onClick={() => setActiveTab('workspace')} className={`flex-1 min-w-[140px] py-3 px-4 rounded-t-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all relative top-[1px] border-x border-t ${activeTab === 'workspace' ? 'bg-gradient-to-br from-sky-50 to-white dark:from-sky-900/20 dark:to-slate-900 text-sky-700 dark:text-sky-400 border-sky-100 dark:border-sky-900/50 shadow-[0_-2px_6px_rgba(0,0,0,0.02)]' : 'bg-transparent text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-sky-600 dark:hover:text-sky-400'}`}> <div className={`p-1.5 rounded-lg ${activeTab === 'workspace' ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}> <PenTool className="w-4 h-4" /> </div> Biên Tập <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'workspace' ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{props.files.length}</span> </button>
                    </div>
                </div>
            </div>

            {/* 3. Page Content */}
            <main className="flex-1 min-h-0 bg-slate-50 dark:bg-slate-950 relative overflow-hidden flex flex-col">
                {activeTab === 'dashboard' && <div className="flex-1 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-300"><DashboardPage {...props} /></div>}
                {activeTab === 'knowledge' && <div className="flex-1 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-300"><KnowledgePage {...props} /></div>}
                {activeTab === 'workspace' && <WorkspacePage {...props} />}
            </main>

            {/* 4. GLOBAL BOTTOM ACTION BAR */}
            <div className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
                    {/* ... (Existing buttons) */}
                    <div className="flex items-center gap-2 shrink-0">
                        <label className="flex flex-col items-center justify-center w-14 h-14 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-all cursor-pointer group active:scale-95 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"> <Plus className="w-5 h-5 group-hover:scale-110 transition-transform mb-1" /> <span className="text-[9px] font-bold uppercase">Thêm</span> <input type="file" multiple accept=".txt,.zip,.epub,.docx,.doc,.pdf" className="hidden" onChange={props.handleFileUpload} /> </label>
                        <button onClick={() => props.setShowPasteModal(true)} className="flex flex-col items-center justify-center w-14 h-14 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-all group active:scale-95 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"> <Clipboard className="w-5 h-5 group-hover:scale-110 transition-transform mb-1" /> <span className="text-[9px] font-bold uppercase">Paste</span> </button>
                    </div>
                    
                    <div className="w-px h-10 bg-slate-200 dark:bg-slate-700 shrink-0"></div>

                    {/* Selection Tools */}
                    <div className="flex items-center gap-2 shrink-0">
                         <button onClick={props.selectAll} className="flex flex-col items-center justify-center w-14 h-14 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer group active:scale-95 border border-transparent hover:border-slate-200 dark:hover:border-slate-700" title="Chọn tất cả"> <CheckSquare className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" /> <span className="text-[9px] font-bold uppercase">All</span> </button>
                         <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 h-14">
                              <div className="flex flex-col items-center justify-center px-1"> <span className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">Start</span> <input type="number" placeholder="1" className="w-16 text-center text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md py-0.5 outline-none font-bold focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:focus:ring-indigo-800 text-slate-800 dark:text-slate-200 transition-all" value={props.rangeStart} onChange={(e) => props.setRangeStart(e.target.value)} /> </div>
                              <div className="px-2 text-slate-300 dark:text-slate-600"> <ArrowRight className="w-4 h-4" /> </div>
                              <div className="flex flex-col items-center justify-center px-1"> <span className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">End</span> <input type="number" placeholder="50" className="w-16 text-center text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md py-0.5 outline-none font-bold focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:focus:ring-indigo-800 text-slate-800 dark:text-slate-200 transition-all" value={props.rangeEnd} onChange={(e) => props.setRangeEnd(e.target.value)} /> </div>
                              <button onClick={props.handleRangeSelect} className="ml-2 w-8 h-8 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg flex items-center justify-center transition-colors shadow-sm active:scale-95" title="Chọn theo dải"> <Check className="w-4 h-4" /> </button>
                         </div>
                    </div>

                    <div className="w-px h-10 bg-slate-200 dark:bg-slate-700 shrink-0"></div>

                    {/* Processing Tools */}
                    <div className="flex items-center gap-2 shrink-0">
                         {/* --- UPDATED AUTO BUTTON --- */}
                         <button 
                            onClick={handleSmartAutomationClick} 
                            disabled={props.isProcessing && !props.automationState.isRunning} 
                            className={`action-btn relative ${props.automationState.isRunning ? 'bg-yellow-400 text-red-600 animate-pulse ring-2 ring-red-500' : 'bg-yellow-400 hover:bg-yellow-500 text-red-600'}`}
                         >
                            {props.automationState.isRunning ? <Loader2 className="w-5 h-5 animate-spin mb-1" /> : <Zap className="w-5 h-5 mb-1 fill-current" />}
                            <span className="text-[9px] font-black uppercase">AUTO</span>
                         </button>
                         {/* ----------------------- */}

                         <button onClick={() => props.setShowFindReplace(true)} className="action-btn text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400"><Search className="w-5 h-5 mb-1" /><span className="text-[9px] font-bold uppercase">Tìm/Thay</span></button>
                         <button onClick={props.handleSmartFix} disabled={props.isProcessing} className={`action-btn transition-colors relative ${fixableCount > 0 ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:scale-105' : 'text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'}`}> <Hammer className="w-5 h-5 mb-1" /> <span className="text-[9px] font-bold uppercase">Smart Fix</span> {fixableCount > 0 && ( <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold shadow-sm animate-bounce"> {fixableCount} </span> )} </button>
                         <button onClick={() => props.setShowFilterPanel(!props.showFilterPanel)} className={`action-btn ${props.showFilterPanel || props.filterModels.size > 0 || props.filterStatuses.size > 0 ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'}`}> <ListFilter className="w-5 h-5 mb-1" /><span className="text-[9px] font-bold uppercase">Filter</span> </button>
                         <button onClick={() => props.handleManualCleanup(props.selectedFiles.size > 0 ? 'selected' : 'all')} className="action-btn text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"><Bot className="w-5 h-5 mb-1" /><span className="text-[9px] font-bold uppercase">Trợ Lý Local</span></button>
                         <button onClick={() => props.selectedFiles.size > 0 ? props.setShowRetranslateModal(true) : alert("Chọn file để dịch lại")} className="action-btn text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"><RefreshCw className="w-5 h-5 mb-1" /><span className="text-[9px] font-bold uppercase">Dịch Lại</span></button>
                         <button onClick={() => props.selectedFiles.size > 0 ? props.handleSmartDelete() : props.requestDeleteAll()} className="action-btn text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"><Trash2 className="w-5 h-5 mb-1" /><span className="text-[9px] font-bold uppercase">Xóa</span></button>
                    </div>

                    <div className="w-px h-10 bg-slate-200 dark:bg-slate-700 shrink-0"></div>

                    {/* Export & Start */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={props.handleDownloadRaw} className="action-btn text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400"><FileDown className="w-5 h-5 mb-1" /><span className="text-[9px] font-bold uppercase">Raw</span></button>
                        <button onClick={props.handleDownloadTranslatedZip} className="action-btn text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"><FileArchive className="w-5 h-5 mb-1" /><span className="text-[9px] font-bold uppercase">Zip</span></button>
                        <button onClick={props.handleDownloadMerged} className="action-btn text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"><FileText className="w-5 h-5 mb-1" /><span className="text-[9px] font-bold uppercase">Gộp</span></button>
                        <button onClick={props.handleDownloadEpub} className="action-btn text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40"><Book className="w-5 h-5 mb-1" /><span className="text-[9px] font-bold uppercase">EPUB</span></button>
                        
                        <button 
                          onClick={props.isProcessing ? props.stopProcessing : props.handleStartButton} 
                          className={`flex items-center gap-2 px-6 h-12 ml-2 rounded-2xl shadow-lg transition-all active:scale-95 font-bold text-white ${props.isProcessing ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200/50' : 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-indigo-200/50'}`}
                      >
                          {props.isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                          <span className="hidden sm:inline">{props.isProcessing ? "DỪNG LẠI" : "BẮT ĐẦU"}</span>
                      </button>
                    </div>
                </div>
            </div>
            
            <style jsx>{`
                .action-btn {
                    @apply flex flex-col items-center justify-center w-14 h-14 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group active:scale-95 border border-transparent hover:border-slate-200 dark:border-slate-700;
                }
            `}</style>
        </div>
    );
};
