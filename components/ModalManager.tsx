
import React, { useState } from 'react';
import { 
    StartOptionsModal, GuideModal, SmartStartModal, NameAnalysisModal, 
    PasteModal, FindReplaceModal, ConfirmationModal, ImportModal, 
    ChangelogModal, LogModal
} from './Modals';
import { SplitterModal } from './SplitterModal';
import { EditorModal } from './EditorModal';
import { PromptDesignerModal } from './PromptDesignerModal';
import { ZipActionModal } from './ZipActionModal';
import { EpubPreviewModal } from './EpubPreviewModal';
import { AutomationModal } from './AutomationModal'; // Imported
import { StoryInfo, FileItem, TranslationTier, LogEntry, AutomationConfig } from '../types';
import { Zap, Activity, Sparkles, RefreshCw } from 'lucide-react';

interface ModalManagerProps {
    // ... (Existing props)
    // Modal States
    showPasteModal: boolean;
    setShowPasteModal: (v: boolean) => void;
    showFindReplace: boolean;
    setShowFindReplace: (v: boolean) => void;
    confirmModal: any;
    setConfirmModal: (v: any) => void;
    importModal: any;
    setImportModal: (v: any) => void;
    splitterModal: any;
    setSplitterModal: (v: any) => void;
    zipActionModal: boolean;
    setZipActionModal: (v: boolean) => void;
    handleZipKeepSeparate: () => void;
    handleZipMergeAndSplit: () => void;
    showGuide: boolean;
    setShowGuide: (v: boolean) => void;
    showStartOptions: boolean;
    setShowStartOptions: (v: boolean) => void;
    showNameAnalysisModal: boolean;
    setShowNameAnalysisModal: (v: boolean) => void;
    showSmartStartModal: boolean;
    setShowSmartStartModal: (v: boolean) => void;
    showChangelog: boolean;
    setShowChangelog: (v: boolean) => void;
    editingFileId: string | null;
    setEditingFileId: (v: string | null) => void;
    showRetranslateModal: boolean;
    setShowRetranslateModal: (v: boolean) => void;
    
    // EPUB Preview
    showEpubModal: boolean;
    setShowEpubModal: (v: boolean) => void;
    handleEpubConfirm: (info: StoryInfo, cover: File | null) => void;
    
    // Logs
    showLogs: boolean;
    setShowLogs: (v: boolean) => void;
    systemLogs: LogEntry[];
    clearLogs: () => void;

    // Prompt Designer
    showPromptDesigner: boolean;
    setShowPromptDesigner: (v: boolean) => void;
    handlePromptDesignerConfirm: (config: any) => void;
    isOptimizingPrompt: boolean;
    selectedTemplateKey: string;
    setSelectedTemplateKey: (v: string) => void;

    // AUTOMATION (NEW)
    showAutomationModal: boolean;
    setShowAutomationModal: (v: boolean) => void;
    handleAutomationStart: (config: AutomationConfig) => void;
    handleAutomationStop: () => void; // New Prop
    automationState: { isRunning: boolean, currentStep: number, countdown: number, totalSteps: number, stepStatus: string };
    automationInitialConfig: { steps: number[], rules: string, tier: TranslationTier }; // New prop

    // Handlers & Data
    handlePasteConfirm: (title: string, content: string) => void;
    handleFindReplace: (find: string, replace: string, scope: 'all' | 'selected') => void;
    selectedCount: number;
    handleImportAppend: () => void;
    handleImportOverwrite: () => void;
    handleSplitConfirm: (files: FileItem[]) => void;
    handleConfirmStart: (tier: TranslationTier) => void;
    isSmartAutoMode: boolean;
    handleNameAnalysis: (config: any) => void;
    isAnalyzingNames: boolean;
    nameAnalysisProgress: any;
    storyInfo: StoryInfo;
    totalFiles: number;
    handleSmartStartRun: (useSearch: boolean) => void;
    handleSkipSmartStart: () => void;
    setStoryInfo: (v: any) => void;
    autoOptimizePrompt: boolean;
    setAutoOptimizePrompt: (v: boolean) => void;
    smartStartStep: any;
    coverImage: File | null;
    setCoverImage: (v: File | null) => void;
    files: FileItem[];
    saveEditor: (id: string, content: string) => void;
    dictionary: string;
    promptTemplate: string;
    addToast: (msg: string, type: any) => void;
    setAdditionalDictionary: (v: any) => void;
    handleRetranslateConfirm: (keepOld: boolean, tier: TranslationTier) => void;
    handleFindReplaceInFile: (fileId: string, find: string, replace: string) => void;
}

export const ModalManager: React.FC<ModalManagerProps> = (props) => {
    
    const [retranslateKeepOld, setRetranslateKeepOld] = useState(true);

    const onAddToGlossary = (raw: string, edit: string) => {
        const entry = `${raw}=${edit}`;
        props.setAdditionalDictionary((prev: string) => (prev ? prev + '\n' + entry : entry));
        props.addToast(`Đã thêm: ${entry}`, 'success');
    };

    const handleReplaceAllInEditor = (find: string, replace: string) => {
        if(props.editingFileId) {
            props.handleFindReplaceInFile(props.editingFileId, find, replace);
        }
    };

    const editingFile = props.files.find(f => f.id === props.editingFileId);

    return (
        <>
            <PasteModal isOpen={props.showPasteModal} onClose={() => props.setShowPasteModal(false)} onConfirm={props.handlePasteConfirm} />
            <FindReplaceModal isOpen={props.showFindReplace} onClose={() => props.setShowFindReplace(false)} onReplace={props.handleFindReplace} selectedCount={props.selectedCount} />
            <ConfirmationModal {...props.confirmModal} onCancel={() => props.setConfirmModal({ ...props.confirmModal, isOpen: false })} />
            <ImportModal isOpen={props.importModal.isOpen} count={props.importModal.pendingFiles.length} onAppend={props.handleImportAppend} onOverwrite={props.handleImportOverwrite} onCancel={() => props.setImportModal({ isOpen: false, pendingFiles: [] })} />
            <ZipActionModal isOpen={props.zipActionModal} onClose={() => props.setZipActionModal(false)} onKeepSeparate={props.handleZipKeepSeparate} onMergeAndSplit={props.handleZipMergeAndSplit} />
            <SplitterModal isOpen={props.splitterModal.isOpen} fileContent={props.splitterModal.content} fileName={props.splitterModal.name} onConfirmSplit={props.handleSplitConfirm} onCancel={() => props.setSplitterModal({ isOpen: false, content: '', name: '' })} />
            <GuideModal isOpen={props.showGuide} onClose={() => props.setShowGuide(false)} />
            <StartOptionsModal isOpen={props.showStartOptions} onClose={() => { props.setShowStartOptions(false); }} onConfirm={props.handleConfirmStart} isSmartMode={props.isSmartAutoMode} />
            <NameAnalysisModal isOpen={props.showNameAnalysisModal} onClose={() => props.setShowNameAnalysisModal(false)} onConfirm={props.handleNameAnalysis} isAnalyzing={props.isAnalyzingNames} progress={props.nameAnalysisProgress} storyInfo={props.storyInfo} totalFiles={props.totalFiles} />
            <SmartStartModal isOpen={props.showSmartStartModal} onClose={() => props.setShowSmartStartModal(false)} onConfirm={props.handleSmartStartRun} onSkip={props.handleSkipSmartStart} storyInfo={props.storyInfo} setStoryInfo={props.setStoryInfo} autoOptimize={props.autoOptimizePrompt} setAutoOptimize={props.setAutoOptimizePrompt} step={props.smartStartStep} />
            <ChangelogModal isOpen={props.showChangelog} onClose={() => props.setShowChangelog(false)} />
            <LogModal isOpen={props.showLogs} onClose={() => props.setShowLogs(false)} logs={props.systemLogs} clearLogs={props.clearLogs} />
            <EpubPreviewModal isOpen={props.showEpubModal} onClose={() => props.setShowEpubModal(false)} onConfirm={props.handleEpubConfirm} storyInfo={props.storyInfo} coverImage={props.coverImage} totalFiles={props.files.length} />
            <PromptDesignerModal isOpen={props.showPromptDesigner} onClose={() => props.setShowPromptDesigner(false)} onConfirm={props.handlePromptDesignerConfirm} storyInfo={props.storyInfo} setStoryInfo={props.setStoryInfo} selectedTemplateKey={props.selectedTemplateKey} setSelectedTemplateKey={props.setSelectedTemplateKey} isOptimizing={props.isOptimizingPrompt} />
            
            {/* NEW AUTOMATION MODAL */}
            <AutomationModal 
                isOpen={props.showAutomationModal} 
                onClose={() => props.setShowAutomationModal(false)} 
                onStart={props.handleAutomationStart}
                onStop={props.handleAutomationStop} // Pass the stop handler
                isRunning={props.automationState.isRunning}
                currentStep={props.automationState.currentStep}
                countdown={props.automationState.countdown}
                totalSteps={props.automationState.totalSteps}
                stepStatus={props.automationState.stepStatus}
                initialConfig={props.automationInitialConfig} 
            />

            {props.showRetranslateModal && ( 
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"> 
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"> 
                        <div className="p-6"> 
                            <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><RefreshCw className="w-5 h-5 text-indigo-500" /> Dịch lại {props.selectedCount} chương</h3> 
                            <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer mb-4 hover:bg-slate-100 transition-colors">
                                <input type="checkbox" checked={retranslateKeepOld} onChange={e => setRetranslateKeepOld(e.target.checked)} className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                                <div className="text-xs">
                                    <span className="font-bold text-slate-700 block">Giữ nội dung cũ?</span>
                                    <span className="text-slate-500">Giữ bản dịch cũ để tham khảo trong Editor (Split View) trong khi chờ bản mới.</span>
                                </div>
                            </label>
                            <p className="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider">Chọn cấp độ dịch:</p>
                            <div className="space-y-2">
                                <button onClick={() => props.handleRetranslateConfirm(retranslateKeepOld, 'flash')} className="w-full py-2 px-3 bg-sky-50 border border-sky-100 hover:bg-sky-100 text-sky-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-3">
                                    <div className="p-1 bg-white rounded-lg shadow-sm"><Zap className="w-4 h-4" /></div> Flash Mode (Nhanh)
                                </button>
                                <button onClick={() => props.handleRetranslateConfirm(retranslateKeepOld, 'normal')} className="w-full py-2 px-3 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-3 ring-1 ring-indigo-200">
                                    <div className="p-1 bg-white rounded-lg shadow-sm"><Activity className="w-4 h-4" /></div> Normal Mode (Khuyên dùng)
                                </button>
                                <button onClick={() => props.handleRetranslateConfirm(retranslateKeepOld, 'pro')} className="w-full py-2 px-3 bg-purple-50 border border-purple-100 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-3">
                                    <div className="p-1 bg-white rounded-lg shadow-sm"><Sparkles className="w-4 h-4" /></div> Pro Mode (Chất lượng cao)
                                </button>
                            </div>
                            <button onClick={() => props.setShowRetranslateModal(false)} className="w-full mt-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600"> Hủy bỏ </button> 
                        </div> 
                    </div> 
                </div> 
            )}

            {props.editingFileId && editingFile && (
                <EditorModal file={editingFile} onClose={() => props.setEditingFileId(null)} onSave={props.saveEditor} storyInfoContext={props.storyInfo.contextNotes || ""} dictionary={props.dictionary} promptTemplate={props.promptTemplate} onAddToGlossary={onAddToGlossary} onReplaceAll={handleReplaceAllInEditor} addToast={props.addToast} genres={props.storyInfo.genres} />
            )}
        </>
    );
};