
import { useState, useEffect, useMemo } from 'react';
import { Toast, LogEntry, TranslationTier } from '../types';

const THEME_KEY = 'app_theme_preference';

export const useUIState = () => {
    const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
    const [showSettings, setShowSettings] = useState<boolean>(true);
    const [showLogs, setShowLogs] = useState<boolean>(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [systemLogs, setSystemLogs] = useState<LogEntry[]>([]);
    
    // Filter State
    const [showFilterPanel, setShowFilterPanel] = useState<boolean>(false);
    const [filterModels, setFilterModels] = useState<Set<string>>(new Set());
    const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
    
    // Pagination / Selection State
    const [currentPage, setCurrentPage] = useState<number>(0);
    const [rangeStart, setRangeStart] = useState<string>('');
    const [rangeEnd, setRangeEnd] = useState<string>('');
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

    // Modal States
    const [editingFileId, setEditingFileId] = useState<string | null>(null);
    const [showFindReplace, setShowFindReplace] = useState<boolean>(false);
    const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
    const [splitterModal, setSplitterModal] = useState<{ isOpen: boolean, content: string, name: string }>({ isOpen: false, content: '', name: '' });
    const [zipActionModal, setZipActionModal] = useState<boolean>(false);
    const [showGuide, setShowGuide] = useState<boolean>(false);
    const [showContextBuilder, setShowContextBuilder] = useState<boolean>(false);
    const [showSmartStartModal, setShowSmartStartModal] = useState<boolean>(false);
    const [smartStartStep, setSmartStartStep] = useState<'idle' | 'optimizing' | 'analyzing'>('idle');
    const [autoOptimizePrompt, setAutoOptimizePrompt] = useState<boolean>(true);
    const [showStartOptions, setShowStartOptions] = useState<boolean>(false);
    const [showNameAnalysisModal, setShowNameAnalysisModal] = useState<boolean>(false);
    const [isAnalyzingNames, setIsAnalyzingNames] = useState<boolean>(false);
    const [showRetranslateModal, setShowRetranslateModal] = useState<boolean>(false);
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; isDanger: boolean; confirmText?: string }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, isDanger: false });
    const [importModal, setImportModal] = useState<{ isOpen: boolean; pendingFiles: any[]; tempInfo?: any }>({ isOpen: false, pendingFiles: [] });
    const [showChangelog, setShowChangelog] = useState<boolean>(false);
    const [showPromptDesigner, setShowPromptDesigner] = useState<boolean>(false);
    const [showEpubModal, setShowEpubModal] = useState<boolean>(false);
    const [showAutomationModal, setShowAutomationModal] = useState<boolean>(false);
    
    // New: Smart Automation Config State
    const [automationInitialConfig, setAutomationInitialConfig] = useState<{ steps: number[], rules: string, tier: TranslationTier }>({ steps: [1,2,3,4,5,6], rules: '', tier: 'normal' });

    // Loaders
    const [importProgress, setImportProgress] = useState<{ current: number; total: number; message: string } | null>(null);
    const [actionProgress, setActionProgress] = useState<{ current: number; total: number; message: string } | null>(null);
    const [nameAnalysisProgress, setNameAnalysisProgress] = useState<{ current: number; total: number; stage: string }>({ current: 0, total: 0, stage: '' });

    // Other UI
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
    const [viewOriginalPrompt, setViewOriginalPrompt] = useState<boolean>(false);
    const [dictTab, setDictTab] = useState<'custom' | 'default'>('custom');
    const [quickInput, setQuickInput] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);
    const [isGeneratingCover, setIsGeneratingCover] = useState(false);
    const [autoAnalyzeStatus, setAutoAnalyzeStatus] = useState<string>('');

    // Theme Logic
    useEffect(() => {
        const storedTheme = localStorage.getItem(THEME_KEY);
        if (storedTheme) { setIsDarkMode(storedTheme === 'dark'); } 
        else { setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches); }
    }, []);
    const toggleDarkMode = () => { const newMode = !isDarkMode; setIsDarkMode(newMode); localStorage.setItem(THEME_KEY, newMode ? 'dark' : 'light'); };

    // Logging
    const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
        if (type === 'error' || type === 'success') {
            setSystemLogs(prev => [{ id, timestamp: new Date(), message, type }, ...prev].slice(0, 500));
        }
    };
    const addLog = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = crypto.randomUUID();
        setSystemLogs(prev => [{ id, timestamp: new Date(), message, type }, ...prev].slice(0, 500));
    };
    const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));
    const clearLogs = () => setSystemLogs([]);

    const hasLogErrors = useMemo(() => systemLogs.some(l => l.type === 'error'), [systemLogs]);
    const isAutoAnalyzing = useMemo(() => !!autoAnalyzeStatus, [autoAnalyzeStatus]);

    return {
        isDarkMode, toggleDarkMode,
        showSettings, setShowSettings,
        showLogs, setShowLogs,
        toasts, addToast, removeToast,
        systemLogs, addLog, clearLogs, hasLogErrors,
        showFilterPanel, setShowFilterPanel,
        filterModels, setFilterModels,
        filterStatuses, setFilterStatuses,
        currentPage, setCurrentPage,
        rangeStart, setRangeStart,
        rangeEnd, setRangeEnd,
        selectedFiles, setSelectedFiles,
        lastSelectedId, setLastSelectedId,
        
        // Modals
        editingFileId, setEditingFileId,
        showFindReplace, setShowFindReplace,
        showPasteModal, setShowPasteModal,
        splitterModal, setSplitterModal,
        zipActionModal, setZipActionModal,
        showGuide, setShowGuide,
        showContextBuilder, setShowContextBuilder,
        showSmartStartModal, setShowSmartStartModal,
        smartStartStep, setSmartStartStep,
        autoOptimizePrompt, setAutoOptimizePrompt,
        showStartOptions, setShowStartOptions,
        showNameAnalysisModal, setShowNameAnalysisModal,
        isAnalyzingNames, setIsAnalyzingNames,
        showRetranslateModal, setShowRetranslateModal,
        confirmModal, setConfirmModal,
        importModal, setImportModal,
        showChangelog, setShowChangelog,
        showPromptDesigner, setShowPromptDesigner,
        showEpubModal, setShowEpubModal,
        showAutomationModal, setShowAutomationModal,
        
        automationInitialConfig, setAutomationInitialConfig,

        importProgress, setImportProgress,
        actionProgress, setActionProgress,
        nameAnalysisProgress, setNameAnalysisProgress,

        coverPreviewUrl, setCoverPreviewUrl,
        viewOriginalPrompt, setViewOriginalPrompt,
        dictTab, setDictTab,
        quickInput, setQuickInput,
        isDragging, setIsDragging,
        isOptimizingPrompt, setIsOptimizingPrompt,
        isGeneratingCover, setIsGeneratingCover,
        autoAnalyzeStatus, setAutoAnalyzeStatus,
        isAutoAnalyzing
    };
};
