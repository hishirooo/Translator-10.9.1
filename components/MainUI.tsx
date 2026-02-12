
import React, { useState, useMemo } from 'react';
import {
    LayoutDashboard, BookOpen, PenTool,
    Plus, Clipboard, CheckSquare, ArrowRight, Check, Search, Sparkles, Loader2,
    Hammer, ListFilter, Eraser, Bot, RefreshCw, Trash2, FileDown, FileArchive,
    FileText, Play, Book, Zap, PauseCircle, Archive, ArchiveRestore
} from 'lucide-react';
import { Header } from './Header';
import { DashboardPage } from './DashboardPage';
import { KnowledgePage } from './KnowledgePage';
import { WorkspacePage } from './WorkspacePage';
import { getInvalidPronounLines } from '../utils/textHelpers';
import { AutomationConfig } from '../types';
import { DEFAULT_PROMPT } from '../constants';

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

    // API Key Pool Props
    showApiKeyPool?: boolean;
    setShowApiKeyPool?: (v: boolean) => void;

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
    handleRescueCopy: (e: React.MouseEvent, file: FileItem) => void;
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
    setAutomationInitialConfig: (v: { steps: number[], rules: string, tier: TranslationTier }) => void;

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

    // SMART AUTOMATION LOGIC (from 10.9.1)
    const handleSmartAutomationClick = () => {
        const currentRules = props.storyInfo.additionalRules || "";

        const hasMetadata = !!(props.storyInfo.title && props.storyInfo.title.trim().length > 0) && (props.storyInfo.genres.length > 0);

        const hasDict = props.additionalDictionary && props.additionalDictionary.trim().length > 10;
        const hasCtx = props.storyInfo.contextNotes && props.storyInfo.contextNotes.trim().length > 10;
        const hasContextData = hasDict || hasCtx;

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

        if (stepsToRun.length === 0) stepsToRun = [4, 5, 6];

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
                    showApiKeyPool={props.showApiKeyPool}
                    setShowApiKeyPool={props.setShowApiKeyPool}
                    handleBackup={props.handleBackup}
                    handleRestore={props.handleRestore}
                    requestResetApp={props.requestResetApp}
                />

                <div className="bg-slate-50/80 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-800/80 shadow-sm pt-1.5 pb-0">
                    <div className="max-w-7xl mx-auto px-4 flex gap-3">
                        <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-2.5 px-4 rounded-t-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 ease-out border-x border-t ${activeTab === 'dashboard' ? 'bg-gradient-to-br from-indigo-50/80 to-white/80 dark:from-indigo-900/30 dark:to-slate-900/90 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50 shadow-[0_-2px_6px_rgba(0,0,0,0.02)]' : 'bg-transparent text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-indigo-600 dark:hover:text-indigo-400 hover:scale-[1.02]'}`}> <div className={`p-1 rounded-lg ${activeTab === 'dashboard' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}> <LayoutDashboard className="w-4 h-4" /> </div> Thông Tin </button>
                        <button onClick={() => setActiveTab('knowledge')} className={`flex-1 py-2.5 px-4 rounded-t-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 ease-out border-x border-t ${activeTab === 'knowledge' ? 'bg-gradient-to-br from-amber-50/80 to-white/80 dark:from-amber-900/30 dark:to-slate-900/90 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/50 shadow-[0_-2px_6px_rgba(0,0,0,0.02)]' : 'bg-transparent text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-amber-600 dark:hover:text-amber-400 hover:scale-[1.02]'}`}> <div className={`p-1 rounded-lg ${activeTab === 'knowledge' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}> <BookOpen className="w-4 h-4" /> </div> Tri Thức </button>
                        <button onClick={() => setActiveTab('workspace')} className={`flex-1 py-2.5 px-4 rounded-t-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 ease-out border-x border-t ${activeTab === 'workspace' ? 'bg-gradient-to-br from-sky-50/80 to-white/80 dark:from-sky-900/30 dark:to-slate-900/90 text-sky-700 dark:text-sky-400 border-sky-100 dark:border-sky-900/50 shadow-[0_-2px_6px_rgba(0,0,0,0.02)]' : 'bg-transparent text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-sky-600 dark:hover:text-sky-400 hover:scale-[1.02]'}`}> <div className={`p-1 rounded-lg ${activeTab === 'workspace' ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}> <PenTool className="w-4 h-4" /> </div> Biên Tập <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${activeTab === 'workspace' ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{props.files.length}</span> </button>
                    </div>
                </div>
            </div>

            {/* 3. Page Content */}
            <main className="flex-1 min-h-0 bg-slate-50 dark:bg-slate-950 relative overflow-hidden flex flex-col">
                {activeTab === 'dashboard' && <div className="flex-1 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-300"><DashboardPage {...props} /></div>}
                {activeTab === 'knowledge' && <div className="flex-1 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-300"><KnowledgePage {...props} /></div>}
                {activeTab === 'workspace' && <WorkspacePage {...props} />}
            </main>

            {/* 4. GLOBAL BOTTOM ACTION BAR - REDESIGNED (10.8.9 Style) */}
            <div className="shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50 p-2 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.4)] z-30">
                <div className="max-w-7xl mx-auto flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar">
                    {/* ADD FILES Section */}
                    <div className="flex items-center gap-1 shrink-0 px-2 py-1 bg-sky-50/50 dark:bg-sky-900/10 rounded-xl border border-sky-200/30 dark:border-sky-800/30">
                        <label className="toolbar-btn group hover:bg-sky-100 dark:hover:bg-sky-900/30 hover:text-sky-600 dark:hover:text-sky-400">
                            <Plus className="w-5 h-5 mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase">Thêm</span>
                            <input type="file" multiple accept=".txt,.zip,.epub,.docx,.doc,.pdf" className="hidden" onChange={props.handleFileUpload} />
                        </label>
                        <button onClick={() => props.setShowPasteModal(true)} className="toolbar-btn group hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-400">
                            <Clipboard className="w-5 h-5 mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase">Paste</span>
                        </button>
                    </div>

                    <div className="w-px h-8 bg-gradient-to-b from-transparent via-slate-300 dark:via-slate-600 to-transparent shrink-0"></div>

                    {/* SELECTION Section */}
                    <div className="flex items-center gap-1 shrink-0 px-2 py-1 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-200/30 dark:border-indigo-800/30">
                        <button onClick={props.selectAll} className="toolbar-btn group hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400" title="Chọn tất cả">
                            <CheckSquare className="w-5 h-5 mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase">All</span>
                        </button>
                        <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 h-11">
                            <div className="flex flex-col items-center px-0.5">
                                <span className="text-[7px] font-bold text-indigo-500 dark:text-indigo-400 uppercase">Start</span>
                                <input type="number" placeholder="1" className="w-12 text-center text-xs bg-transparent outline-none font-bold text-slate-700 dark:text-slate-200" value={props.rangeStart} onChange={(e) => props.setRangeStart(e.target.value)} />
                            </div>
                            <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-600 mx-0.5" />
                            <div className="flex flex-col items-center px-0.5">
                                <span className="text-[7px] font-bold text-indigo-500 dark:text-indigo-400 uppercase">End</span>
                                <input type="number" placeholder="50" className="w-12 text-center text-xs bg-transparent outline-none font-bold text-slate-700 dark:text-slate-200" value={props.rangeEnd} onChange={(e) => props.setRangeEnd(e.target.value)} />
                            </div>
                            <button onClick={props.handleRangeSelect} className="ml-1 w-7 h-7 bg-indigo-500 text-white hover:bg-indigo-600 rounded-md flex items-center justify-center transition-colors shadow-sm active:scale-95" title="Chọn theo dải">
                                <Check className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    <div className="w-px h-8 bg-gradient-to-b from-transparent via-slate-300 dark:via-slate-600 to-transparent shrink-0"></div>

                    {/* PROCESSING TOOLS Section */}
                    <div className="flex items-center gap-1 shrink-0 px-2 py-1 bg-purple-50/50 dark:bg-purple-900/10 rounded-xl border border-purple-200/30 dark:border-purple-800/30">
                        {/* AUTO Button (uses 10.9.1 smart logic) */}
                        <button
                            onClick={handleSmartAutomationClick}
                            disabled={props.isProcessing && !props.automationState.isRunning}
                            className={`toolbar-btn relative ${props.automationState.isRunning
                                ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white animate-pulse shadow-lg shadow-orange-300/50 dark:shadow-orange-600/30'
                                : 'bg-gradient-to-br from-yellow-300 to-amber-400 hover:from-yellow-400 hover:to-amber-500 text-amber-900 shadow-md shadow-amber-200/50 dark:shadow-amber-800/30'}`}
                        >
                            {props.automationState.isRunning ? <Loader2 className="w-5 h-5 animate-spin mb-0.5" /> : <Zap className="w-5 h-5 mb-0.5 fill-current" />}
                            <span className="text-[9px] font-black uppercase">Auto</span>
                        </button>

                        <button onClick={() => props.setShowFindReplace(true)} className="toolbar-btn group hover:bg-sky-100 dark:hover:bg-sky-900/30 hover:text-sky-600 dark:hover:text-sky-400">
                            <Search className="w-5 h-5 mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase">Tìm</span>
                        </button>

                        <button onClick={props.handleSmartFix} disabled={props.isProcessing} className={`toolbar-btn group relative ${fixableCount > 0 ? 'bg-amber-100/50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-200 dark:hover:bg-amber-900/40' : 'hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-400'}`}>
                            <Hammer className="w-5 h-5 mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase">Fix</span>
                            {fixableCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white text-[9px] flex items-center justify-center rounded-full font-bold shadow animate-bounce">
                                    {fixableCount}
                                </span>
                            )}
                        </button>

                        <button onClick={() => props.setShowFilterPanel(!props.showFilterPanel)} className={`toolbar-btn group ${props.showFilterPanel || props.filterModels.size > 0 || props.filterStatuses.size > 0 ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700' : 'hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400'}`}>
                            <ListFilter className="w-5 h-5 mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase">Filter</span>
                        </button>

                        <button onClick={() => props.handleManualCleanup(props.selectedFiles.size > 0 ? 'selected' : 'all')} className="toolbar-btn group hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400">
                            <Bot className="w-5 h-5 mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase">Local</span>
                        </button>

                        <button onClick={() => props.selectedFiles.size > 0 ? props.setShowRetranslateModal(true) : alert("Chọn file để dịch lại")} className="toolbar-btn group hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400">
                            <RefreshCw className="w-5 h-5 mb-0.5 group-hover:scale-110 group-hover:rotate-180 transition-all duration-300" />
                            <span className="text-[9px] font-bold uppercase">Dịch Lại</span>
                        </button>

                        <button onClick={() => props.selectedFiles.size > 0 ? props.handleSmartDelete() : props.requestDeleteAll()} className="toolbar-btn group hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-600 dark:hover:text-rose-400">
                            <Trash2 className="w-5 h-5 mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase">Xóa</span>
                        </button>
                    </div>

                    <div className="w-px h-8 bg-gradient-to-b from-transparent via-slate-300 dark:via-slate-600 to-transparent shrink-0"></div>

                    {/* EXPORT Section */}
                    <div className="flex items-center gap-1 shrink-0 px-2 py-1 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200/30 dark:border-emerald-800/30">
                        <button onClick={props.handleDownloadRaw} className="toolbar-btn group hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600 dark:hover:text-sky-400">
                            <FileDown className="w-5 h-5 mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase">Raw</span>
                        </button>
                        <button onClick={props.handleDownloadTranslatedZip} className="toolbar-btn group hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400">
                            <FileArchive className="w-5 h-5 mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase">Zip</span>
                        </button>
                        <button onClick={props.handleDownloadMerged} className="toolbar-btn group hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400">
                            <FileText className="w-5 h-5 mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase">Gộp</span>
                        </button>
                        <button onClick={props.handleDownloadEpub} className="toolbar-btn group bg-rose-100/50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-200 dark:hover:bg-rose-900/40">
                            <Book className="w-5 h-5 mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase">EPUB</span>
                        </button>
                    </div>

                    <div className="w-px h-8 bg-gradient-to-b from-transparent via-slate-300 dark:via-slate-600 to-transparent shrink-0"></div>

                    {/* DATA Section */}
                    <div className="flex items-center gap-1 shrink-0 px-2 py-1 bg-violet-50/50 dark:bg-violet-900/10 rounded-xl border border-violet-200/30 dark:border-violet-800/30">
                        <button onClick={props.handleBackup} className="toolbar-btn group hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400" title="Backup (.json)">
                            <Archive className="w-5 h-5 mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase">Save</span>
                        </button>
                        <label className="toolbar-btn group hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer" title="Restore Data">
                            <ArchiveRestore className="w-5 h-5 mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase">Load</span>
                            <input type="file" accept=".json" className="hidden" onChange={props.handleRestore} />
                        </label>
                        <button onClick={props.requestResetApp} className="toolbar-btn group hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-600 dark:hover:text-rose-400" title="Reset Toàn Bộ App">
                            <Trash2 className="w-5 h-5 mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase">Reset</span>
                        </button>
                    </div>

                    {/* START/STOP Button */}
                    <button
                        onClick={props.isProcessing ? props.stopProcessing : props.handleStartButton}
                        className={`flex items-center gap-2 px-8 h-12 ml-2 rounded-2xl font-bold text-white transition-all active:scale-95 shrink-0 ${props.isProcessing
                            ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 shadow-lg shadow-rose-300/50 dark:shadow-rose-900/50'
                            : 'bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-600 hover:from-emerald-400 hover:via-sky-400 hover:to-indigo-500 shadow-lg shadow-indigo-300/50 dark:shadow-indigo-900/50 animate-[pulse_3s_ease-in-out_infinite]'
                            }`}
                    >
                        {props.isProcessing ? <PauseCircle className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                        <span className="font-black tracking-wide">{props.isProcessing ? "DỪNG" : "BẮT ĐẦU"}</span>
                    </button>
                </div>
            </div>

            <style jsx>{`
                .toolbar-btn {
                    @apply flex flex-col items-center justify-center w-12 h-11 rounded-lg text-slate-500 dark:text-slate-400 transition-all cursor-pointer active:scale-95 border border-transparent;
                }
            `}</style>
        </div>
    );
};
