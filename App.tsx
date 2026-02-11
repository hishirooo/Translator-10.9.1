import React, {
    useState,
    useCallback,
    useMemo,
    useEffect,
    useRef,
} from "react";
import {
    FileItem,
    FileStatus,
    StoryInfo,
    ModelQuota,
    TranslationTier,
    BatchLimits,
    RatioLimits,
} from "./types";
import {
    DEFAULT_PROMPT,
    DEFAULT_DICTIONARY,
    AVAILABLE_PERSONALITIES,
    AVAILABLE_SETTINGS,
    AVAILABLE_FLOWS,
    MODEL_CONFIGS,
    TIER_MODELS,
    CONCURRENCY_CONFIG,
    BATCH_SIZE_CONFIG,
} from "./constants";
import {
    repairTranslations,
    optimizePrompt,
    analyzeStoryContext,
    translateBatch,
    translateBatchStream,
    testModelConnection,
    analyzeNameBatch,
    analyzeContextBatch,
    mergeContexts,
    GlobalRepairEntry,
    autoAnalyzeStory,
    getEffectiveModelsForTier,
    performAggregatedRepair,
    generateCoverImage,
    createCoverPrompt,
} from "./geminiService";
import {
    unzipFiles,
    parseEpub,
    parsePdf,
    createMergedFile,
    downloadTextFile,
    readFileAsText,
    downloadJsonFile,
    parseDocx,
    splitContentByRegex,
    splitContentByLength,
    downloadRawAsZip,
    downloadTranslatedAsZip,
    parseFilenameMetadata,
    renumberFiles,
    generateExportFileName,
    readDocumentContent,
    fileToBase64,
    base64ToFile,
    generateEpub,
    downloadEpubFile,
} from "./utils/fileHelpers";
import {
    findLinesWithForeignChars,
    mergeFixedLines,
    countForeignChars,
    replacePromptVariables,
    deduplicateDictionary,
    isEnglishContent,
    validateTranslationIntegrity,
    detectJunkChapter,
    formatBookStyle,
    getInvalidPronounLines,
    optimizeDictionary,
    optimizeContext,
    isVietnameseContent,
} from "./utils/textHelpers";
import { saveToStorage, loadFromStorage, clearDatabase } from "./utils/storage";
import { quotaManager } from "./utils/quotaManager";
import { MainUI } from "./components/MainUI";
import { ModalManager } from "./components/ModalManager";
import {
    ToastContainer,
    Toast,
    LogEntry,
    LoadingModal,
} from "./components/Modals";
import { AutomationConfig } from "./components/AutomationModal";
import { ApiKeyPoolModal } from "./components/ApiKeyPoolModal";
import { Loader2 } from "lucide-react";

const STORAGE_KEY = "current_session_v1";
const THEME_KEY = "app_theme_preference";
const ITEMS_PER_PAGE = 50;

const App: React.FC = () => {
    // ... (Initial States Omitted for Brevity - Keeping all existing state definitions)
    const initialStoryInfo: StoryInfo = {
        title: "",
        author: "",
        languages: ["Convert thô"],
        genres: ["Tiên Hiệp"],
        mcPersonality: [],
        worldSetting: [],
        sectFlow: [],
        contextNotes: "",
        summary: "",
    };

    // --- STATE MANAGEMENT ---
    const [isResetting, setIsResetting] = useState(false);
    const [files, setFiles] = useState<FileItem[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    // ... (All other existing states)
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
    const [showFilterPanel, setShowFilterPanel] = useState<boolean>(false);
    const [filterModels, setFilterModels] = useState<Set<string>>(new Set());
    const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState<number>(0);
    const [rangeStart, setRangeStart] = useState<string>("");
    const [rangeEnd, setRangeEnd] = useState<string>("");

    // Theme State
    const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

    // Modals State
    const [editingFileId, setEditingFileId] = useState<string | null>(null);
    const [showFindReplace, setShowFindReplace] = useState<boolean>(false);
    const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
    const [splitterModal, setSplitterModal] = useState<{
        isOpen: boolean;
        content: string;
        name: string;
    }>({ isOpen: false, content: "", name: "" });
    const [zipActionModal, setZipActionModal] = useState<boolean>(false);
    const [showGuide, setShowGuide] = useState<boolean>(false);
    const [showContextBuilder, setShowContextBuilder] = useState<boolean>(false);
    const [showSmartStartModal, setShowSmartStartModal] =
        useState<boolean>(false);
    const [smartStartStep, setSmartStartStep] = useState<
        "idle" | "optimizing" | "analyzing"
    >("idle");
    const [autoOptimizePrompt, setAutoOptimizePrompt] = useState<boolean>(true);
    const [isSmartAutoMode, setIsSmartAutoMode] = useState<boolean>(false);
    const [autoFixEnabled, setAutoFixEnabled] = useState<boolean>(false);
    const [showStartOptions, setShowStartOptions] = useState<boolean>(false);
    const [translationTier, setTranslationTier] =
        useState<TranslationTier>("normal");
    const [showNameAnalysisModal, setShowNameAnalysisModal] =
        useState<boolean>(false);
    const [isAnalyzingNames, setIsAnalyzingNames] = useState<boolean>(false);
    const [nameAnalysisProgress, setNameAnalysisProgress] = useState<{
        current: number;
        total: number;
        stage: string;
    }>({ current: 0, total: 0, stage: "" });
    const [showRetranslateModal, setShowRetranslateModal] =
        useState<boolean>(false);
    const [showLogs, setShowLogs] = useState<boolean>(false);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDanger: boolean;
        confirmText?: string;
    }>({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => { },
        isDanger: false,
    });
    const [importModal, setImportModal] = useState<{
        isOpen: boolean;
        pendingFiles: FileItem[];
        tempInfo?: any;
    }>({ isOpen: false, pendingFiles: [] });
    const [showChangelog, setShowChangelog] = useState<boolean>(false);
    const [showPromptDesigner, setShowPromptDesigner] = useState<boolean>(false);
    const [importProgress, setImportProgress] = useState<{
        current: number;
        total: number;
        message: string;
    } | null>(null);
    const [actionProgress, setActionProgress] = useState<{
        current: number;
        total: number;
        message: string;
    } | null>(null);
    const [showEpubModal, setShowEpubModal] = useState<boolean>(false);
    const [showApiKeyPool, setShowApiKeyPool] = useState<boolean>(false);

    // NEW: AUTOMATION STATE
    const [showAutomationModal, setShowAutomationModal] =
        useState<boolean>(false);
    const [automationState, setAutomationState] = useState<{
        isRunning: boolean;
        currentStep: number;
        pendingSteps: number[];
        config: AutomationConfig | null;
        countdown: number;
        totalSteps: number;
        stepStatus: string;
    }>({
        isRunning: false,
        currentStep: 0,
        pendingSteps: [],
        config: null,
        countdown: 0,
        totalSteps: 0,
        stepStatus: "",
    });

    // Data State
    const [promptTemplate, setPromptTemplate] = useState<string>(DEFAULT_PROMPT);
    const [viewOriginalPrompt, setViewOriginalPrompt] = useState<boolean>(false);
    const [systemLogs, setSystemLogs] = useState<LogEntry[]>([]);
    const [testingModelId, setTestingModelId] = useState<string | null>(null);

    // UPDATED: Batch Limit v3=10
    const [batchLimits, setBatchLimits] = useState<BatchLimits>({
        latin: { v3: 10, v25: 5, maxTotalChars: 220000 },
        complex: { v3: 10, v25: 5, maxTotalChars: 110000 },
    });

    // UPDATED: Expanded Ratio Limits
    const [ratioLimits, setRatioLimits] = useState<RatioLimits>({
        vn: { min: 0.3, max: 1.4 },
        en: { min: 0.7, max: 1.4 },
        krjp: { min: 0.3, max: 3.2 },
        cn: { min: 2.3, max: 4.2 },
    });

    const lastContextRef = useRef<string>("");
    const lastContextIndexRef = useRef<number>(-1);
    const isFixPhaseRef = useRef<boolean>(false);
    // Ref to track if automation is waiting for background task (like translation)
    const isAutomationWaitingRef = useRef<boolean>(false);

    const isDefaultPromptUI = useMemo(
        () =>
            !promptTemplate ||
            promptTemplate.trim() === "" ||
            promptTemplate.trim() === DEFAULT_PROMPT,
        [promptTemplate]
    );
    const hasLogErrors = useMemo(
        () => systemLogs.some((l) => l.type === "error"),
        [systemLogs]
    );

    useEffect(() => {
        const storedTheme = localStorage.getItem(THEME_KEY);
        if (storedTheme) {
            setIsDarkMode(storedTheme === "dark");
        } else {
            const prefersDark = window.matchMedia(
                "(prefers-color-scheme: dark)"
            ).matches;
            setIsDarkMode(prefersDark);
        }
    }, []);
    const toggleDarkMode = () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        localStorage.setItem(THEME_KEY, newMode ? "dark" : "light");
    };

    useEffect(() => {
        if (showSmartStartModal) {
            setAutoOptimizePrompt(isDefaultPromptUI);
        }
    }, [showSmartStartModal, isDefaultPromptUI]);
    const [storyInfo, setStoryInfo] = useState<StoryInfo>(initialStoryInfo);
    const [quickInput, setQuickInput] = useState("");
    const [coverImage, setCoverImage] = useState<File | null>(null);
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
    const [isGeneratingCover, setIsGeneratingCover] = useState(false);
    const [additionalDictionary, setAdditionalDictionary] = useState<string>("");
    const [dictTab, setDictTab] = useState<"custom" | "default">("custom");
    const [autoSaveInterval, setAutoSaveInterval] = useState<number>(2);
    const [enabledModels, setEnabledModels] = useState<string[]>(
        MODEL_CONFIGS.map((m) => m.id)
    );
    const [modelConfigs, setModelConfigs] = useState<ModelQuota[]>(MODEL_CONFIGS);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [activeBatches, setActiveBatches] = useState<number>(0);
    const [isOptimizingPrompt, setIsOptimizingPrompt] = useState<boolean>(false);
    const [processingQueue, setProcessingQueue] = useState<string[]>([]);
    const [showSettings, setShowSettings] = useState<boolean>(true);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<number | null>(null);
    const [modelUsages, setModelUsages] = useState<any>({});
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const [isAutoAnalyzing, setIsAutoAnalyzing] = useState(false);
    const [autoAnalyzeStatus, setAutoAnalyzeStatus] = useState<string>("");
    const isResettingRef = useRef(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [pendingSmartAuto, setPendingSmartAuto] = useState(false);
    const stateRef = useRef({
        files,
        promptTemplate,
        storyInfo,
        additionalDictionary,
        autoSaveInterval,
        enabledModels,
        modelConfigs,
        batchLimits,
        ratioLimits,
        coverImage,
    });
    const autoSaveTimerRef = useRef<number | null>(null);

    const addToast = (
        message: string,
        type: "success" | "error" | "info" | "warning" = "info"
    ) => {
        const id = crypto.randomUUID();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(
            () => setToasts((prev) => prev.filter((t) => t.id !== id)),
            5000
        );
        if (type === "error" || type === "success") {
            setSystemLogs((prev) =>
                [{ id, timestamp: new Date(), message, type }, ...prev].slice(0, 500)
            );
        }
    };
    const addLog = (
        message: string,
        type: "success" | "error" | "info" = "info"
    ) => {
        const id = crypto.randomUUID();
        setSystemLogs((prev) =>
            [{ id, timestamp: new Date(), message, type }, ...prev].slice(0, 500)
        );
    };
    const removeToast = (id: string) =>
        setToasts((prev) => prev.filter((t) => t.id !== id));

    useEffect(() => {
        stateRef.current = {
            files,
            promptTemplate,
            storyInfo,
            additionalDictionary,
            autoSaveInterval,
            enabledModels,
            modelConfigs,
            batchLimits,
            ratioLimits,
            coverImage,
        };
    }, [
        files,
        promptTemplate,
        storyInfo,
        additionalDictionary,
        autoSaveInterval,
        enabledModels,
        modelConfigs,
        batchLimits,
        ratioLimits,
        coverImage,
    ]);
    useEffect(() => {
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist();
        }
        const loadData = async () => {
            try {
                const data = await loadFromStorage(STORAGE_KEY);
                if (data) {
                    if (data.files) setFiles(data.files);
                    if (data.promptTemplate) setPromptTemplate(data.promptTemplate);
                    if (data.storyInfo) {
                        const mergedInfo = {
                            title: data.storyInfo.title || "",
                            author: data.storyInfo.author || "",
                            languages: data.storyInfo.languages || ["Convert thô"],
                            genres: data.storyInfo.genres || ["Tiên Hiệp"],
                            mcPersonality: data.storyInfo.mcPersonality || [],
                            worldSetting: data.storyInfo.worldSetting || [],
                            sectFlow: data.storyInfo.sectFlow || [],
                            contextNotes: data.storyInfo.contextNotes || "",
                            summary: data.storyInfo.summary || "",
                            imagePrompt: data.storyInfo.imagePrompt || "",
                            additionalRules: data.storyInfo.additionalRules || "",
                        };
                        setStoryInfo(mergedInfo);
                    }
                    if (data.additionalDictionary)
                        setAdditionalDictionary(data.additionalDictionary);
                    if (data.autoSaveInterval) setAutoSaveInterval(data.autoSaveInterval);
                    if (data.enabledModels) {
                        const validIds = MODEL_CONFIGS.map((m) => m.id);
                        const validEnabled = data.enabledModels.filter((id: string) =>
                            validIds.includes(id)
                        );
                        setEnabledModels(validEnabled.length > 0 ? validEnabled : validIds);
                    }
                    if (data.batchLimits) {
                        const latinV3 = data.batchLimits.latin?.v3 || 10;
                        setBatchLimits({
                            latin: { ...data.batchLimits.latin, v3: latinV3 },
                            complex: {
                                ...data.batchLimits.complex,
                                v3: data.batchLimits.complex?.v3 || 10,
                            },
                        });
                    }
                    if (data.ratioLimits) {
                        if (data.ratioLimits.vn) {
                            setRatioLimits(data.ratioLimits);
                        } else {
                            setRatioLimits({
                                vn: data.ratioLimits.latin || { min: 0.3, max: 1.4 },
                                en: { min: 0.7, max: 1.4 },
                                krjp: { min: 0.3, max: 3.2 },
                                cn: data.ratioLimits.complex || { min: 2.3, max: 4.2 },
                            });
                        }
                    }
                    if (data.coverImage && data.coverImage instanceof Blob) {
                        setCoverImage(data.coverImage as File);
                    }
                    setModelConfigs(MODEL_CONFIGS);
                    quotaManager.updateConfigs(MODEL_CONFIGS);
                    if (data.lastSaved) setLastSaved(new Date(data.lastSaved));
                } else {
                    quotaManager.updateConfigs(MODEL_CONFIGS);
                }
            } catch (err) {
                console.error("Failed to restore session:", err);
            }
        };
        loadData();
        const unsubscribe = quotaManager.subscribe(() => {
            const usages: any = {};
            MODEL_CONFIGS.forEach(
                (m) => (usages[m.id] = quotaManager.getModelUsage(m.id))
            );
            setModelUsages(usages);
        });
        return () => {
            unsubscribe();
        };
    }, []);
    useEffect(() => {
        quotaManager.updateConfigs(modelConfigs);
    }, [modelConfigs]);
    useEffect(() => {
        if (coverImage) {
            const url = URL.createObjectURL(coverImage);
            setCoverPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setCoverPreviewUrl(null);
        }
    }, [coverImage]);
    const saveSession = useCallback(async () => {
        if (isResettingRef.current) return;
        if (
            stateRef.current.files.length === 0 &&
            !stateRef.current.storyInfo.title
        )
            return;
        setIsAutoSaving(true);
        try {
            const dataToSave = {
                ...stateRef.current,
                lastSaved: new Date().toISOString(),
            };
            await saveToStorage(STORAGE_KEY, dataToSave);
            setLastSaved(new Date());
        } catch (e) {
            console.error("Auto-save failed:", e);
        } finally {
            setIsAutoSaving(false);
        }
    }, []);
    useEffect(() => {
        if (autoSaveInterval > 0) {
            autoSaveTimerRef.current = window.setInterval(() => {
                if (!isResettingRef.current) saveSession();
            }, Math.max(1, autoSaveInterval) * 60 * 1000);
        }
        const handleSave = () => {
            if (!isResettingRef.current) saveSession();
        };
        window.addEventListener("beforeunload", handleSave);
        window.addEventListener("blur", handleSave);
        return () => {
            if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
            window.removeEventListener("beforeunload", handleSave);
            window.removeEventListener("blur", handleSave);
        };
    }, [saveSession, autoSaveInterval]);

    const prevCompletedCountRef = useRef(0);
    useEffect(() => {
        const completedCount = files.filter(
            (f) => f.status === FileStatus.COMPLETED
        ).length;
        if (
            completedCount > prevCompletedCountRef.current &&
            !isResettingRef.current
        )
            saveSession();
        prevCompletedCountRef.current = completedCount;
    }, [files, saveSession]);
    const effectiveDictionary = useMemo(() => {
        if (additionalDictionary && additionalDictionary.trim().length > 0) {
            return DEFAULT_DICTIONARY + "\n" + additionalDictionary;
        }
        return DEFAULT_DICTIONARY;
    }, [additionalDictionary]);

    // STATS & PROGRESS
    const stats = useMemo(() => {
        return {
            total: files.length,
            completed: files.filter((f) => f.status === FileStatus.COMPLETED).length,
            failed: files.filter((f) => f.status === FileStatus.ERROR).length,
            englishError: files.filter(
                (f) =>
                    f.status === FileStatus.ERROR && f.errorMessage?.includes("English")
            ).length,
            pending: files.filter((f) => f.status === FileStatus.IDLE).length,
            processing: files.filter(
                (f) =>
                    f.status === FileStatus.PROCESSING ||
                    f.status === FileStatus.REPAIRING
            ).length,
            rawRemaining: files.filter(
                (f) => f.status === FileStatus.COMPLETED && f.remainingRawCharCount > 0
            ).length,
            shortCount: files.filter((f) => f.content.length < 1200).length,
            errorOrRaw: files.filter(
                (f) =>
                    f.status === FileStatus.ERROR ||
                    (f.status === FileStatus.COMPLETED && f.remainingRawCharCount > 0) ||
                    f.status === FileStatus.PROCESSING ||
                    f.status === FileStatus.REPAIRING
            ).length,
            modelCounts: {
                "3pro": files.filter(
                    (f) =>
                        f.status === FileStatus.COMPLETED &&
                        f.usedModel?.includes("gemini-3-pro")
                ).length,
                "25pro": files.filter(
                    (f) =>
                        f.status === FileStatus.COMPLETED &&
                        f.usedModel?.includes("gemini-2.5-pro")
                ).length,
                "3flash": files.filter(
                    (f) =>
                        f.status === FileStatus.COMPLETED &&
                        f.usedModel?.includes("gemini-3-flash")
                ).length,
                "25flash": files.filter(
                    (f) =>
                        f.status === FileStatus.COMPLETED &&
                        f.usedModel?.includes("gemini-2.5-flash")
                ).length,
            },
        };
    }, [files]);
    const progressPercentage = useMemo(() => {
        if (files.length === 0) return 0;
        return Math.round((stats.completed / files.length) * 100);
    }, [stats, files.length]);

    // ... (Handlers and other functions omitted for brevity, logic below is for processBatch/useEffect)
    // ... (Keeping everything else exactly the same, only changing the Queue Processing Logic)

    // ... [Handlers: handleManualCleanup, handleQuickParse, etc. - UNCHANGED] ...
    const handleManualCleanup = (scope: "all" | "selected") => {
        let count = 0;
        const newFiles = files.map((f) => {
            if (scope === "selected" && !selectedFiles.has(f.id)) return f;
            if (f.translatedContent && f.status === FileStatus.COMPLETED) {
                const cleaned = formatBookStyle(f.translatedContent);
                if (cleaned !== f.translatedContent) {
                    count++;
                    const newRawCount = countForeignChars(cleaned);
                    return {
                        ...f,
                        translatedContent: cleaned,
                        remainingRawCharCount: newRawCount,
                    };
                }
            }
            return f;
        });
        if (count > 0) {
            setFiles(newFiles);
            addToast(
                `Trợ Lý Local đã lọc rác & định dạng chuẩn cho ${count} file (Xóa *, #, =, ---, Chuẩn hóa tiêu đề).`,
                "success"
            );
        } else {
            addToast(
                `Trợ Lý Local: Các file đã sạch và chuẩn form sách in, không cần can thiệp.`,
                "info"
            );
        }
    };
    const handleQuickParse = () => {
        if (!quickInput.trim()) return;
        const items = quickInput
            .split(/[,;\n]+/)
            .map((s) => s.trim())
            .filter((s) => s);
        const newGenres = [...storyInfo.genres];
        const newPersonalities = [...storyInfo.mcPersonality];
        const newSettings = [...storyInfo.worldSetting];
        const newFlows = [...storyInfo.sectFlow];
        let addedCount = 0;
        items.forEach((item) => {
            const lowerItem = item.toLowerCase();
            if (
                AVAILABLE_PERSONALITIES.some((p) => p.toLowerCase().includes(lowerItem))
            ) {
                if (!newPersonalities.includes(item)) newPersonalities.push(item);
            } else if (
                AVAILABLE_SETTINGS.some((s) => s.toLowerCase().includes(lowerItem))
            ) {
                if (!newSettings.includes(item)) newSettings.push(item);
            } else if (
                AVAILABLE_FLOWS.some((f) => f.toLowerCase().includes(lowerItem))
            ) {
                if (!newFlows.includes(item)) newFlows.push(item);
            } else {
                if (!newGenres.includes(item)) newGenres.push(item);
            }
            addedCount++;
        });
        setStoryInfo({
            ...storyInfo,
            genres: newGenres,
            mcPersonality: newPersonalities,
            worldSetting: newSettings,
            sectFlow: newFlows,
        });
        setQuickInput("");
        addToast(`Đã thêm ${addedCount} thẻ thông tin`, "success");
    };
    const handlePromptDesignerConfirm = async (config: {
        useSearch: boolean;
        useContext: boolean;
        useDictionary: boolean;
        additionalRules: string;
    }) => {
        if (!storyInfo.title && storyInfo.genres.length === 0) {
            addToast("Vui lòng nhập Tên truyện/Thể loại", "error");
            return;
        }
        if (isOptimizingPrompt) return;
        setIsOptimizingPrompt(true);
        try {
            const baseTemplate = DEFAULT_PROMPT;
            const contextSnippet = config.useContext
                ? storyInfo.contextNotes || ""
                : "";
            const dictSnippet = config.useDictionary
                ? additionalDictionary || ""
                : "";
            const optimized = await optimizePrompt(
                baseTemplate,
                storyInfo,
                contextSnippet,
                dictSnippet,
                config.additionalRules
            );
            setPromptTemplate(optimized);
            setStoryInfo((prev) => ({
                ...prev,
                additionalRules: config.additionalRules,
            }));
            addToast("Đã tối ưu hóa Prompt thành công!", "success");
            setShowPromptDesigner(false);
            if (automationState.isRunning) {
                resumeAutomationWithCooldown();
            }
        } catch (error: any) {
            addToast(`Lỗi: ${error.message}`, "error");
        } finally {
            setIsOptimizingPrompt(false);
        }
    };
    const handleOptimizePrompt = () => {
        setShowPromptDesigner(true);
    };

    const handleAutoAnalyze = async () => {
        if (files.length === 0) {
            addToast("Vui lòng tải file truyện trước", "error");
            return;
        }
        if (isAutoAnalyzing) return;
        setIsAutoAnalyzing(true);
        setAutoAnalyzeStatus("Đang khởi động phân tích song song (Dual-Core)...");
        try {
            const hasExistingCover = !!coverImage;
            const { info, cover, imagePrompt } = await autoAnalyzeStory(
                files,
                (status) => setAutoAnalyzeStatus(status),
                hasExistingCover
            );
            const newStoryInfo = { ...storyInfo };
            if (info.title) newStoryInfo.title = info.title;
            if (info.author && !newStoryInfo.author)
                newStoryInfo.author = info.author;
            if (info.language_source) {
                const detected = info.language_source;
                const map: Record<string, string> = {
                    Trung: "Tiếng Trung",
                    China: "Tiếng Trung",
                    Chinese: "Tiếng Trung",
                    Anh: "Tiếng Anh",
                    English: "Tiếng Anh",
                    Hàn: "Tiếng Hàn",
                    Korean: "Tiếng Hàn",
                    Nhật: "Tiếng Nhật",
                    Japanese: "Tiếng Nhật",
                };
                const mapped = map[detected] || detected;
                if (!newStoryInfo.languages.includes(mapped))
                    newStoryInfo.languages = [mapped];
            }
            if (info.genres && Array.isArray(info.genres))
                newStoryInfo.genres = info.genres;
            if (info.personality && Array.isArray(info.personality))
                newStoryInfo.mcPersonality = info.personality;
            if (info.setting && Array.isArray(info.setting))
                newStoryInfo.worldSetting = info.setting;
            if (info.flow && Array.isArray(info.flow))
                newStoryInfo.sectFlow = info.flow;
            if (info.summary) {
                newStoryInfo.summary = info.summary;
            }
            if (info.image_prompt) {
                newStoryInfo.imagePrompt = info.image_prompt;
            }
            if (info.suggested_rules) {
                newStoryInfo.additionalRules =
                    (newStoryInfo.additionalRules
                        ? newStoryInfo.additionalRules + "\n"
                        : "") + info.suggested_rules;
                addToast("Đã bổ sung quy tắc dịch đề xuất từ AI.", "info");
            }
            setStoryInfo(newStoryInfo);
            if (cover) {
                setCoverImage(cover);
                addToast("Đã tạo ảnh bìa AI thành công!", "success");
            } else if (hasExistingCover) {
                addToast("Đã cập nhật thông tin (Giữ nguyên ảnh bìa cũ).", "success");
            } else {
                addToast("Đã phân tích thông tin. (Chưa tạo được ảnh bìa)", "warning");
            }
        } catch (e: any) {
            addToast(`Lỗi phân tích: ${e.message}`, "error");
        } finally {
            setIsAutoAnalyzing(false);
            setAutoAnalyzeStatus("");
        }
    };

    const handleRegenerateCover = async () => {
        if (isGeneratingCover) return;
        setIsGeneratingCover(true);
        addToast("Đang tạo lại ảnh bìa...", "info");
        try {
            const freshPrompt = await createCoverPrompt(storyInfo);
            const cover = await generateCoverImage(freshPrompt);
            if (cover) {
                setCoverImage(cover);
                setStoryInfo((prev) => ({ ...prev, imagePrompt: freshPrompt }));
                addToast("Đã tạo ảnh bìa mới!", "success");
            } else {
                addToast("Không thể tạo ảnh bìa. Vui lòng thử lại.", "error");
            }
        } catch (e: any) {
            addToast(`Lỗi tạo ảnh: ${e.message}`, "error");
        } finally {
            setIsGeneratingCover(false);
        }
    };
    const sortFiles = (list: FileItem[]) => {
        const re = /(\d+)/;
        return [...list].sort((a, b) => {
            const aParts = a.name.split(re);
            const bParts = b.name.split(re);
            const len = Math.min(aParts.length, bParts.length);
            for (let i = 0; i < len; i++) {
                const aPart = aParts[i];
                const bPart = bParts[i];
                if (aPart === bPart) continue;
                const aNum = parseInt(aPart, 10);
                const bNum = parseInt(bPart, 10);
                if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
                return aPart.localeCompare(bPart);
            }
            return aParts.length - bParts.length;
        });
    };
    const handleNameAnalysis = async (config: {
        mode: "only_char" | "full" | "deep_context";
        scope: "smart" | "range" | "full";
        rangeStart: number;
        rangeEnd: number;
        updatedStoryInfo: StoryInfo;
        useSearch: boolean;
        additionalRules?: string;
        sampling?: { start: number; middle: number; end: number };
    }) => {
        if (files.length === 0) return;
        setStoryInfo(config.updatedStoryInfo);
        setIsAnalyzingNames(true);
        setNameAnalysisProgress({
            current: 0,
            total: 1,
            stage: "Đang chuẩn bị dữ liệu...",
        });
        addLog("🚀 Bắt đầu Phân tích HyperBatch (Parallel Mode)...", "info");
        let filesToAnalyze = sortFiles([...files]);
        const totalFileCount = filesToAnalyze.length;
        if (config.scope === "smart") {
            const sStart = config.sampling?.start || 100;
            const sMid = config.sampling?.middle || 100;
            const sEnd = config.sampling?.end || 100;
            const totalSample = sStart + sMid + sEnd;
            if (totalFileCount > totalSample) {
                const startBatch = filesToAnalyze.slice(0, sStart);
                const endBatch = filesToAnalyze.slice(-sEnd);
                const midIndex = Math.floor(totalFileCount / 2);
                const midStartIdx = Math.max(sStart, midIndex - Math.floor(sMid / 2));
                const midEndIdx = Math.min(totalFileCount - sEnd, midStartIdx + sMid);
                const midBatch = filesToAnalyze.slice(midStartIdx, midEndIdx);
                const uniqueMap = new Map();
                [...startBatch, ...midBatch, ...endBatch].forEach((f) =>
                    uniqueMap.set(f.id, f)
                );
                filesToAnalyze = Array.from(uniqueMap.values());
                filesToAnalyze = sortFiles(filesToAnalyze);
            }
        } else if (config.scope === "range") {
            const startIdx = Math.max(0, config.rangeStart - 1);
            const endIdx = Math.min(totalFileCount, config.rangeEnd);
            filesToAnalyze = filesToAnalyze.slice(startIdx, endIdx);
        }
        if (filesToAnalyze.length === 0) {
            addToast("Không có file nào trong phạm vi đã chọn.", "error");
            setIsAnalyzingNames(false);
            return;
        }
        addLog(`📁 Đã chọn ${filesToAnalyze.length} file để phân tích.`, "info");
        const CHUNK_SIZE = 800000;
        const allContent = filesToAnalyze.map((f) => f.content).join("\n");
        const chunks: string[] = [];
        for (let i = 0; i < allContent.length; i += CHUNK_SIZE) {
            chunks.push(allContent.substring(i, i + CHUNK_SIZE));
        }
        setNameAnalysisProgress({
            current: 0,
            total: chunks.length,
            stage: `Đang phân tích 0/${chunks.length} phần`,
        });
        addLog(
            `📦 Chia thành ${chunks.length} phần lớn (800k chars) để xử lý song song.`,
            "info"
        );
        const results: string[] = [];
        try {
            const CONCURRENCY = 2;
            for (let i = 0; i < chunks.length; i += CONCURRENCY) {
                const batch = chunks.slice(i, i + CONCURRENCY);
                const totalBatches = Math.ceil(chunks.length / CONCURRENCY);
                const batchNum = Math.floor(i / CONCURRENCY) + 1;
                setNameAnalysisProgress({
                    current: i + 1,
                    total: chunks.length,
                    stage: `Đang phân tích song song (Batch ${batchNum}/${totalBatches})...`,
                });
                addLog(
                    `⚡ Đang chạy Batch ${batchNum}/${totalBatches} (Chế độ Phân Tán)...`,
                    "info"
                );
                const batchPromises = batch.map((chunk, idx) => {
                    const modelId =
                        (i + idx) % 2 === 0 ? "gemini-3-pro-preview" : "gemini-2.5-pro";
                    if (config.mode === "deep_context") {
                        return analyzeContextBatch(
                            chunk,
                            config.updatedStoryInfo,
                            effectiveDictionary,
                            config.useSearch,
                            [modelId],
                            config.additionalRules || ""
                        );
                    } else {
                        return analyzeNameBatch(
                            chunk,
                            config.updatedStoryInfo,
                            config.mode as "only_char" | "full",
                            config.useSearch,
                            config.additionalRules || "",
                            [modelId]
                        );
                    }
                });
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
                if (i + CONCURRENCY < chunks.length) {
                    addLog("⏳ Cooldown 2s trước Batch tiếp theo...", "info");
                    await new Promise((r) => setTimeout(r, 2000));
                }
            }
            if (config.mode === "deep_context") {
                setNameAnalysisProgress({
                    current: chunks.length,
                    total: chunks.length,
                    stage: "Đang hợp nhất (AI Merge)...",
                });
                addLog(
                    "🧠 Đang dùng AI (3.0 Pro) để hợp nhất các bản phân tích...",
                    "info"
                );
                const mergedContext = await mergeContexts(
                    results,
                    config.updatedStoryInfo
                );
                const newContextEntry = `\n\n[PHÂN TÍCH NGỮ CẢNH CHUYÊN SÂU - ${new Date().toLocaleTimeString()}]\n${mergedContext}`;
                setStoryInfo((prev) => ({
                    ...prev,
                    contextNotes: prev.contextNotes
                        ? prev.contextNotes + newContextEntry
                        : mergedContext,
                }));
                addLog("✅ Hoàn tất hợp nhất Series Bible.", "success");
                addToast("Đã cập nhật Series Bible (Ngữ Cảnh)!", "success");
                downloadTextFile(
                    `${config.updatedStoryInfo.title || "Context"}_NguCanh.txt`,
                    mergedContext
                );
            } else {
                addLog("🧹 Đang làm sạch và lọc trùng (Deduplication)...", "info");
                const combinedText = results.join("\n");
                const cleanDictionary = deduplicateDictionary(combinedText);
                const header = `\n# --- TÊN RIÊNG (PHÂN TÍCH THỦ CÔNG: ${config.mode === "only_char" ? "NHÂN VẬT" : "FULL"
                    }) ---\n`;
                setAdditionalDictionary((prev) => {
                    const cleanPrev = prev ? prev.trim() : "";
                    return cleanPrev + header + cleanDictionary;
                });
                setDictTab("custom");
                addLog(`🎉 Phân tích hoàn tất! Đã thêm vào Từ điển.`, "success");
                addToast("Đã cập nhật Từ điển!", "success");
                downloadTextFile(
                    `${config.updatedStoryInfo.title || "TuDien"}_TuDien.txt`,
                    cleanDictionary
                );
            }
            if (automationState.isRunning) {
                resumeAutomationWithCooldown();
            }
        } catch (e: any) {
            addLog(`❌ Lỗi phân tích: ${e.message}`, "error");
            addToast(`Lỗi phân tích: ${e.message}`, "error");
        }
        setIsAnalyzingNames(false);
        setShowNameAnalysisModal(false);
    };

    // ... (Standard File Helpers: processFiles, handleSplitConfirm, etc.)
    const processFiles = async (fileList: File[]) => {
        if (fileList.length === 0) return;
        setImportProgress({
            current: 0,
            total: fileList.length,
            message: "Đang chuẩn bị...",
        });
        const processedNewFiles: FileItem[] = [];
        let updatedStoryInfo = { ...storyInfo };
        let infoFound = false;
        let needsExplicitSplit = false;

        try {
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                setImportProgress({
                    current: i,
                    total: fileList.length,
                    message: `Đang đọc ${file.name}...`,
                });
                await new Promise((r) => setTimeout(r, 20));
                if (file.name.endsWith(".zip")) {
                    try {
                        const { title, author } = parseFilenameMetadata(file.name);
                        if (title && !updatedStoryInfo.title) {
                            updatedStoryInfo.title = title;
                            if (author) updatedStoryInfo.author = author;
                            infoFound = true;
                        }
                        const extractedFiles = await unzipFiles(
                            file,
                            (current, total, percent) => {
                                setImportProgress({
                                    current: percent,
                                    total: 100,
                                    message: `Đang mở chương ${current} / ${total}`,
                                });
                            }
                        );
                        processedNewFiles.push(...extractedFiles);
                    } catch (e) {
                        addToast(`Lỗi ZIP: ${file.name}`, "error");
                    }
                } else if (file.name.endsWith(".epub")) {
                    try {
                        const result = await parseEpub(file, (current, total, percent) => {
                            setImportProgress({
                                current: percent,
                                total: 100,
                                message: `Đang đọc chương ${current} / ${total}`,
                            });
                        });
                        if (result.info.title && !updatedStoryInfo.title) {
                            updatedStoryInfo.title = result.info.title;
                            if (result.info.author && !updatedStoryInfo.author) {
                                updatedStoryInfo.author = result.info.author;
                            }
                            infoFound = true;
                        }
                        if (result.coverBlob) {
                            setCoverImage(
                                new File([result.coverBlob], "cover.jpg", {
                                    type: result.coverBlob.type,
                                })
                            );
                        }
                        if (result.needsSplit && result.files.length === 1) {
                            needsExplicitSplit = true;
                            processedNewFiles.push(result.files[0]);
                        } else {
                            processedNewFiles.push(...result.files);
                        }
                    } catch (e: any) {
                        addToast(`Lỗi EPUB: ${e.message}`, "error");
                    }
                } else if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) {
                    try {
                        const { content, title, author } = await parseDocx(file);
                        if (title && !updatedStoryInfo.title) {
                            updatedStoryInfo.title = title;
                            infoFound = true;
                        }
                        if (author && !updatedStoryInfo.author) {
                            updatedStoryInfo.author = author;
                            infoFound = true;
                        }
                        if (!infoFound) {
                            const meta = parseFilenameMetadata(file.name);
                            if (meta.title) updatedStoryInfo.title = meta.title;
                            if (meta.author) updatedStoryInfo.author = meta.author;
                            infoFound = true;
                        }
                        processedNewFiles.push({
                            id: crypto.randomUUID(),
                            name: file.name,
                            content: content,
                            translatedContent: null,
                            status: FileStatus.IDLE,
                            retryCount: 0,
                            originalCharCount: content.length,
                            remainingRawCharCount: 0,
                        });
                    } catch (e: any) {
                        addToast(`Lỗi DOCX: ${e.message}`, "error");
                    }
                } else if (file.name.endsWith(".pdf")) {
                    try {
                        const { content, files, title, author } = await parsePdf(
                            file,
                            (percent, msg) =>
                                setImportProgress({
                                    current: percent,
                                    total: 100,
                                    message: msg,
                                })
                        );
                        if (title && !updatedStoryInfo.title) {
                            updatedStoryInfo.title = title;
                            infoFound = true;
                        }
                        if (author && !updatedStoryInfo.author) {
                            updatedStoryInfo.author = author;
                            infoFound = true;
                        }
                        if (!infoFound) {
                            const meta = parseFilenameMetadata(file.name);
                            if (meta.title) updatedStoryInfo.title = meta.title;
                            if (meta.author) updatedStoryInfo.author = meta.author;
                            infoFound = true;
                        }
                        if (files.length > 0) {
                            processedNewFiles.push(...files);
                        } else {
                            processedNewFiles.push({
                                id: crypto.randomUUID(),
                                name: file.name,
                                content: content,
                                translatedContent: null,
                                status: FileStatus.IDLE,
                                retryCount: 0,
                                originalCharCount: content.length,
                                remainingRawCharCount: 0,
                            });
                        }
                    } catch (e: any) {
                        addToast(`Lỗi PDF: ${e.message}`, "error");
                    }
                } else if (file.name.endsWith(".txt")) {
                    const content = await readFileAsText(file);
                    processedNewFiles.push({
                        id: crypto.randomUUID(),
                        name: file.name,
                        content: content,
                        translatedContent: null,
                        status: FileStatus.IDLE,
                        retryCount: 0,
                        originalCharCount: content.length,
                        remainingRawCharCount: 0,
                    });
                }
            }
            if (processedNewFiles.length === 0) {
                setImportProgress(null);
                return;
            }
            const hasLargeFile = processedNewFiles.some(
                (f) => f.content.length > 10000
            );
            if (processedNewFiles.length > 1 && hasLargeFile && !needsExplicitSplit) {
                setImportModal({
                    isOpen: false,
                    pendingFiles: processedNewFiles,
                    tempInfo: infoFound ? updatedStoryInfo : null,
                });
                setZipActionModal(true);
                setImportProgress(null);
                return;
            }
            if (needsExplicitSplit || hasLargeFile) {
                setImportProgress({
                    current: 100,
                    total: 100,
                    message: "Phát hiện chương gộp. Đang hợp nhất để tách lại...",
                });
                await new Promise((r) => setTimeout(r, 100));
                const sortedForMerge = sortFiles(processedNewFiles);
                const hugeContent = sortedForMerge.map((f) => f.content).join("\n\n");
                const mergedTitle = infoFound
                    ? updatedStoryInfo.title
                    : sortedForMerge[0].name;
                if (infoFound) setStoryInfo(updatedStoryInfo);
                setSplitterModal({
                    isOpen: true,
                    content: hugeContent,
                    name: mergedTitle,
                });
                setImportProgress(null);
                return;
            }
            if (stateRef.current.files.length > 0) {
                setImportModal({
                    isOpen: true,
                    pendingFiles: processedNewFiles,
                    tempInfo: infoFound ? updatedStoryInfo : null,
                });
            } else {
                const sorted = sortFiles(processedNewFiles);
                setFiles(sorted);
                if (infoFound) setStoryInfo(updatedStoryInfo);
                addToast(`Đã thêm ${processedNewFiles.length} file`, "success");
            }
        } catch (e: any) {
            addToast(`Lỗi nhập file: ${e.message}`, "error");
        } finally {
            setImportProgress(null);
        }
    };

    const handleSplitConfirm = (splitFiles: FileItem[]) => {
        setSplitterModal({ isOpen: false, content: "", name: "" });
        if (splitFiles.length === 0) {
            addToast("Không tách được chương nào", "error");
            return;
        }
        if (stateRef.current.files.length > 0) {
            setImportModal({
                isOpen: true,
                pendingFiles: splitFiles,
                tempInfo: null,
            });
        } else {
            setFiles(splitFiles);
            addToast(`Đã tách thành ${splitFiles.length} chương`, "success");
        }
    };
    const handleImportAppend = () => {
        let nextIndex = 1;
        if (files.length > 0) {
            const lastFile = files[files.length - 1];
            const match = lastFile.name.match(/^(\d{5})\s/);
            if (match) {
                nextIndex = parseInt(match[1], 10) + 1;
            } else {
                nextIndex = files.length + 1;
            }
        }
        const renumberedFiles = renumberFiles(importModal.pendingFiles, nextIndex);
        const merged = [...files, ...renumberedFiles];
        setFiles(sortFiles(merged));
        setImportModal({ isOpen: false, pendingFiles: [] });
        addToast(
            `Đã thêm nối tiếp ${importModal.pendingFiles.length} file`,
            "success"
        );
    };
    const handleImportOverwrite = () => {
        setFiles(sortFiles(importModal.pendingFiles));
        if (importModal.tempInfo) {
            setStoryInfo({
                ...importModal.tempInfo,
                languages: ["Convert thô"],
                genres: ["Tiên Hiệp"],
                mcPersonality: [],
                worldSetting: [],
                sectFlow: [],
                contextNotes: "",
                summary: "",
            });
            setAdditionalDictionary("");
            setCoverImage(null);
        }
        setImportModal({ isOpen: false, pendingFiles: [] });
        addToast(
            `Đã tạo truyện mới với ${importModal.pendingFiles.length} file`,
            "success"
        );
    };
    const handlePasteConfirm = (title: string, content: string) => {
        const contentLen = content.length;
        if (contentLen > 10000) {
            setSplitterModal({
                isOpen: true,
                content: content,
                name: title || "Truyện dán",
            });
            return;
        }
        const newFile: FileItem = {
            id: crypto.randomUUID(),
            name: title || `Chương ${files.length + 1}`,
            content: content,
            translatedContent: null,
            status: FileStatus.IDLE,
            retryCount: 0,
            originalCharCount: contentLen,
            remainingRawCharCount: 0,
        };
        if (files.length > 0) {
            setImportModal({ isOpen: true, pendingFiles: [newFile], tempInfo: null });
        } else {
            setFiles([newFile]);
            addToast("Đã thêm nội dung", "success");
        }
    };
    const handleZipKeepSeparate = () => {
        setZipActionModal(false);
        const pending = importModal.pendingFiles;
        const info = importModal.tempInfo;
        if (pending.length === 0) return;
        if (stateRef.current.files.length > 0) {
            setImportModal({ isOpen: true, pendingFiles: pending, tempInfo: info });
        } else {
            setFiles(sortFiles(pending));
            if (info) setStoryInfo(info);
            addToast(
                `Đã nhập ${pending.length} file (Giữ nguyên cấu trúc)`,
                "success"
            );
            setImportModal({ isOpen: false, pendingFiles: [] });
        }
    };
    const handleZipMergeAndSplit = () => {
        setZipActionModal(false);
        const pending = importModal.pendingFiles;
        const info = importModal.tempInfo;
        if (pending.length === 0) return;
        const sortedForMerge = sortFiles(pending);
        const hugeContent = sortedForMerge.map((f) => f.content).join("\n\n");
        const mergedTitle = info ? info.title : sortedForMerge[0].name;
        if (info) setStoryInfo(info);
        setSplitterModal({ isOpen: true, content: hugeContent, name: mergedTitle });
        setImportModal({ isOpen: false, pendingFiles: [] });
    };
    const requestResetApp = () => {
        setConfirmModal({
            isOpen: true,
            title: "Reset Toàn Bộ App?",
            message:
                "Hệ thống sẽ xóa sạch dữ liệu và trở về trạng thái ban đầu. (Không cần tải lại trang)",
            isDanger: true,
            confirmText: "Reset Ngay",
            onConfirm: performSoftReset,
        });
    };
    const performSoftReset = async () => {
        setIsResetting(true);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        isResettingRef.current = true;
        if (autoSaveTimerRef.current) {
            clearInterval(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
        await new Promise((r) => setTimeout(r, 50));
        try {
            await clearDatabase();
            localStorage.clear();
            quotaManager.reset();
            setFiles([]);
            setSelectedFiles(new Set());
            setLastSelectedId(null);
            setStoryInfo(initialStoryInfo);
            setPromptTemplate(DEFAULT_PROMPT);
            setAdditionalDictionary("");
            setCoverImage(null);
            setCoverPreviewUrl(null);
            setSystemLogs([]);
            setBatchLimits({
                latin: { v3: 10, v25: 5, maxTotalChars: 220000 },
                complex: { v3: 10, v25: 5, maxTotalChars: 110000 },
            });
            setRatioLimits({
                vn: { min: 0.3, max: 1.4 },
                en: { min: 0.7, max: 1.4 },
                krjp: { min: 0.3, max: 3.2 },
                cn: { min: 2.3, max: 4.2 },
            });
            await new Promise((r) => setTimeout(r, 500));
            addToast("Đã Reset toàn bộ dữ liệu!", "success");
        } catch (e) {
            console.error("Lỗi khi reset:", e);
            addToast("Lỗi khi reset, vui lòng tải lại trang thủ công.", "error");
        } finally {
            isResettingRef.current = false;
            setIsResetting(false);
        }
    };
    const requestDeleteAll = () => {
        setConfirmModal({
            isOpen: true,
            title: "Xóa Tất Cả File?",
            message: `Bạn có chắc chắn muốn xóa ${files.length} chương truyện không?`,
            isDanger: true,
            confirmText: "Xóa Hết",
            onConfirm: () => {
                setFiles([]);
                setSelectedFiles(new Set());
                setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                addToast("Đã xóa danh sách file", "success");
            },
        });
    };
    const handleSmartDelete = () => {
        if (selectedFiles.size > 0) {
            setConfirmModal({
                isOpen: true,
                title: `Xóa ${selectedFiles.size} chương đã chọn?`,
                message:
                    "Hành động này sẽ xóa các chương bạn đã chọn khỏi danh sách làm việc.",
                isDanger: true,
                confirmText: "Xóa Đã Chọn",
                onConfirm: () => {
                    setFiles((prev) => prev.filter((f) => !selectedFiles.has(f.id)));
                    setSelectedFiles(new Set());
                    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                    addToast(`Đã xóa ${selectedFiles.size} file`, "success");
                },
            });
        } else {
            requestDeleteAll();
        }
    };
    const handleScanJunk = () => {
        if (filterStatuses.has("selected") && selectedFiles.size > 0) {
            setSelectedFiles(new Set());
            setFilterStatuses(new Set());
            addToast("Đã hủy chế độ xem rác. Trở về danh sách đầy đủ.", "info");
            return;
        }
        const junkIds = new Set<string>();
        files.forEach((f) => {
            if (detectJunkChapter(f.name, f.content)) junkIds.add(f.id);
        });
        if (junkIds.size > 0) {
            setSelectedFiles(junkIds);
            setFilterStatuses(new Set(["selected"]));
            setCurrentPage(0);
            addToast(
                `Đã tìm thấy ${junkIds.size} chương rác. (Nhấn lại nút này để bỏ chọn)`,
                "warning"
            );
        } else {
            addToast("Không tìm thấy chương rác nào rõ ràng.", "success");
        }
    };
    const handleDownloadSelected = () => {
        if (selectedFiles.size === 0) {
            addToast("Vui lòng chọn ít nhất 1 file", "error");
            return;
        }
        const selectedList = files.filter((f) => selectedFiles.has(f.id));
        const completedList = selectedList.filter(
            (f) => f.status === FileStatus.COMPLETED
        );
        if (completedList.length === 0) {
            addToast("Các file đã chọn chưa hoàn thành dịch", "error");
            return;
        }
        setActionProgress({
            current: 0,
            total: 100,
            message: "Đang chuẩn bị nội dung...",
        });
        setTimeout(() => {
            const content = createMergedFile(selectedList);
            if (!content) {
                addToast("Nội dung rỗng", "error");
                setActionProgress(null);
                return;
            }
            const fileName =
                selectedList.length === 1
                    ? `${selectedList[0].name}.txt`
                    : generateExportFileName(
                        storyInfo.title,
                        storyInfo.author,
                        "_Selected.txt"
                    );
            downloadTextFile(fileName, content);
            addToast(
                `Đã tải xuống ${completedList.length} chương đã chọn (Đã làm sạch)`,
                "success"
            );
            setActionProgress(null);
        }, 100);
    };
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) processFiles(Array.from(e.target.files));
        e.target.value = "";
    };
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files));
    };
    const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setCoverImage(e.target.files[0]);
    };
    const handleDictionaryUpload = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        let combined = "";
        for (let i = 0; i < files.length; i++) {
            combined += (await readDocumentContent(files[i])) + "\n";
        }
        setAdditionalDictionary((prev) => {
            const rawCombined = prev ? prev + "\n" + combined : combined;
            const cleanCombined = deduplicateDictionary(rawCombined);
            return cleanCombined;
        });
        setDictTab("custom");
        addToast("Đã thêm và lọc trùng từ điển!", "success");
        e.target.value = "";
    };
    const handleDictionaryDownload = () => {
        const content = additionalDictionary || DEFAULT_DICTIONARY;
        downloadTextFile(`${storyInfo.title || "Dictionary"}_TuDien.txt`, content);
    };
    const handlePromptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const content = await readDocumentContent(file);
            setPromptTemplate(content);
            addToast("Đã tải Prompt tùy chỉnh", "success");
        } catch (err) {
            addToast("Lỗi đọc file Prompt", "error");
        }
        e.target.value = "";
    };
    const handleBackup = async () => {
        let coverBase64 = null;
        if (coverImage) {
            try {
                coverBase64 = await fileToBase64(coverImage);
            } catch (e) {
                console.warn("Lỗi mã hóa ảnh bìa:", e);
            }
        }
        const dataToSave = {
            ...stateRef.current,
            coverImageBase64: coverBase64,
            lastSaved: new Date().toISOString(),
        };
        const { coverImage: _, ...safeData } = dataToSave;
        downloadJsonFile(
            `Backup_${storyInfo.title || "Data"}_${new Date().toISOString().split("T")[0]
            }.json`,
            safeData
        );
        addToast("Đã xuất file Backup (.json) kèm Ảnh bìa", "success");
    };
    const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await readFileAsText(file);
            const data = JSON.parse(text);
            if (data.files && Array.isArray(data.files)) {
                setFiles(data.files);
                if (data.storyInfo) setStoryInfo(data.storyInfo);
                if (data.promptTemplate) setPromptTemplate(data.promptTemplate);
                if (data.additionalDictionary)
                    setAdditionalDictionary(data.additionalDictionary);
                if (data.modelConfigs) {
                    setModelConfigs(data.modelConfigs);
                    quotaManager.updateConfigs(data.modelConfigs);
                }
                if (data.batchLimits) {
                    const latinV3 = data.batchLimits.latin?.v3 || 10;
                    setBatchLimits({
                        latin: { ...data.batchLimits.latin, v3: latinV3 },
                        complex: {
                            ...data.batchLimits.complex,
                            v3: data.batchLimits.complex?.v3 || 10,
                        },
                    });
                }
                if (data.ratioLimits) {
                    if (data.ratioLimits.vn) {
                        setRatioLimits(data.ratioLimits);
                    } else {
                        setRatioLimits({
                            vn: data.ratioLimits.latin || { min: 0.3, max: 1.4 },
                            en: { min: 0.7, max: 1.4 },
                            krjp: { min: 0.3, max: 3.2 },
                            cn: data.ratioLimits.complex || { min: 2.3, max: 4.2 },
                        });
                    }
                }
                if (data.coverImageBase64) {
                    try {
                        const restoredFile = base64ToFile(
                            data.coverImageBase64,
                            "restored_cover.png"
                        );
                        setCoverImage(restoredFile);
                    } catch (e) {
                        console.warn("Lỗi khôi phục ảnh bìa:", e);
                    }
                }
                const restoredState = {
                    ...data,
                    coverImage: data.coverImageBase64
                        ? base64ToFile(data.coverImageBase64, "cover.png")
                        : null,
                };
                await saveToStorage(STORAGE_KEY, restoredState);
                addToast("Khôi phục dữ liệu thành công!", "success");
            } else {
                addToast("File Backup không hợp lệ", "error");
            }
        } catch (err: any) {
            addToast(`Lỗi khôi phục: ${err.message}`, "error");
        }
        e.target.value = "";
    };
    const handleResetPromptRequest = () => {
        setConfirmModal({
            isOpen: true,
            title: "Khôi phục Prompt Mặc Định?",
            message:
                'Hành động này sẽ xóa toàn bộ các tùy chỉnh và "Kiến trúc" riêng biệt của bộ truyện này để quay về Prompt gốc hệ thống.',
            isDanger: false,
            confirmText: "Khôi Phục Ngay",
            onConfirm: () => {
                setPromptTemplate(DEFAULT_PROMPT);
                setConfirmModal((p) => ({ ...p, isOpen: false }));
                addToast("Đã khôi phục Prompt mặc định!", "success");
            },
        });
    };
    const toggleModel = (modelId: string) => {
        setEnabledModels((prev) =>
            prev.includes(modelId)
                ? prev.length === 1
                    ? prev
                    : prev.filter((id) => id !== modelId)
                : [...prev, modelId]
        );
    };
    const handleManualResetQuota = () => {
        setConfirmModal({
            isOpen: true,
            title: "Reset Bộ Đếm Quota (RPD)?",
            message:
                "Hành động này sẽ đặt lại bộ đếm lượt dùng hôm nay về 0 cho TẤT CẢ model.\n\nLƯU Ý: Chỉ thực hiện khi bạn chắc chắn Google đã reset quota (thường là 14h-15h chiều VN) mà App chưa tự cập nhật.",
            isDanger: false,
            confirmText: "Xác Nhận Reset",
            onConfirm: () => {
                quotaManager.resetDailyQuotas();
                addToast("Đã reset bộ đếm giới hạn ngày thành công.", "success");
                setConfirmModal((prev) => ({ ...prev, isOpen: false }));
            },
        });
    };
    const handleTestModel = async (modelId: string) => {
        if (testingModelId) return;
        setTestingModelId(modelId);
        try {
            const result = await testModelConnection(modelId);
            addToast(result.message, result.success ? "success" : "error");
        } catch (e: any) {
            addToast(`Lỗi test: ${e.message}`, "error");
        } finally {
            setTestingModelId(null);
        }
    };
    const handleRetranslateConfirm = (
        keepOld: boolean,
        tier: TranslationTier
    ) => {
        const selectedIds = Array.from(selectedFiles);
        if (selectedIds.length === 0) return;
        setTranslationTier(tier);
        setFiles((prev) =>
            prev.map((f) => {
                if (selectedFiles.has(f.id)) {
                    return {
                        ...f,
                        status: FileStatus.IDLE,
                        translatedContent: keepOld ? f.translatedContent : null,
                        remainingRawCharCount: keepOld ? f.remainingRawCharCount : 0,
                        errorMessage: undefined,
                        retryCount: 0,
                        usedModel: undefined,
                    };
                }
                return f;
            })
        );
        setProcessingQueue((prev) => {
            const newQueue = [...prev];
            selectedIds.forEach((id) => {
                if (!newQueue.includes(id)) newQueue.push(id);
            });
            return newQueue;
        });
        setShowRetranslateModal(false);
        setIsProcessing(true);
        if (!startTime) setStartTime(Date.now());
        setEndTime(null);
        addToast(
            `Đã thêm ${selectedIds.length} file vào hàng đợi dịch lại (Tier: ${tier})`,
            "info"
        );
    };
    const handleContextFileUpload = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const content = await readDocumentContent(file);
            setStoryInfo((prev) => ({ ...prev, contextNotes: content }));
            addToast("Đã nhập ngữ cảnh", "success");
        } catch (err) {
            addToast("Lỗi đọc file", "error");
        }
        e.target.value = "";
    };
    const handleContextDownload = () => {
        const content = storyInfo.contextNotes || "";
        if (!content.trim()) {
            addToast("Chưa có ngữ cảnh để tải", "error");
            return;
        }
        downloadTextFile(`${storyInfo.title || "Context"}_NguCanh.txt`, content);
    };
    const handleRescueCopy = async (e: React.MouseEvent, file: FileItem) => {
        e.stopPropagation();
        const localDict = optimizeDictionary(effectiveDictionary, file.content);
        const localContext = optimizeContext(
            storyInfo.contextNotes || "",
            file.content
        );
        const rescuePrompt = `*** BẠN LÀ HỆ THỐNG CỨU HỘ DỊCH THUẬT ***\nHãy dịch nội dung sau sang tiếng Việt.\n[NGỮ CẢNH]:\n${localContext}\n[TỪ ĐIỂN]:\n${localDict}\n[YÊU CẦU]: ${promptTemplate || DEFAULT_PROMPT
            }\n[NỘI DUNG RAW]:\n${file.content}`;
        try {
            await navigator.clipboard.writeText(rescuePrompt.trim());
            addToast("Đã copy gói cứu hộ! (Đã lọc Từ điển & Ngữ cảnh)", "success");
        } catch (err) {
            addToast("Không thể copy vào clipboard", "error");
        }
    };
    const handleManualFixSingle = async (e: React.MouseEvent, fileId: string) => {
        e.stopPropagation();
        const file = files.find((f) => f.id === fileId);
        if (!file) return;
        if (file.remainingRawCharCount > 100) {
            setFiles((prev) =>
                prev.map((f) =>
                    f.id === fileId
                        ? {
                            ...f,
                            status: FileStatus.IDLE,
                            retryCount: 0,
                            translatedContent: null,
                            remainingRawCharCount: 0,
                        }
                        : f
                )
            );
            setProcessingQueue((prev) => [...prev, fileId]);
            setIsProcessing(true);
            if (!startTime) setStartTime(Date.now());
            addToast(
                `Phát hiện lỗi nặng: Đã thêm vào hàng đợi dịch lại (Auto Fix).`,
                "info"
            );
        } else {
            if (
                file.status === FileStatus.REPAIRING ||
                file.status === FileStatus.PROCESSING
            )
                return;
            setFiles((prev) =>
                prev.map((f) =>
                    f.id === fileId ? { ...f, status: FileStatus.REPAIRING } : f
                )
            );
            addToast("Đang sửa lỗi nhỏ bằng Model Pro (Assistant Mode)...", "info");
            try {
                if (file.translatedContent) {
                    const badLines = findLinesWithForeignChars(file.translatedContent);
                    if (badLines.length > 0) {
                        const fixes = await repairTranslations(
                            badLines,
                            effectiveDictionary,
                            "pro",
                            storyInfo.contextNotes,
                            storyInfo,
                            promptTemplate,
                            (msg) => addLog(msg, "info"),
                            enabledModels
                        );
                        if (fixes.length > 0) {
                            const fixedContent = mergeFixedLines(
                                file.translatedContent,
                                fixes
                            );
                            const cleanContent = formatBookStyle(fixedContent);
                            const remainingRaw = countForeignChars(cleanContent);
                            setFiles((prev) =>
                                prev.map((f) =>
                                    f.id === file.id
                                        ? {
                                            ...f,
                                            status: FileStatus.COMPLETED,
                                            translatedContent: cleanContent,
                                            remainingRawCharCount: remainingRaw,
                                        }
                                        : f
                                )
                            );
                            addToast("Đã sửa xong!", "success");
                        } else {
                            addToast("Không thể sửa tự động.", "error");
                            setFiles((prev) =>
                                prev.map((f) =>
                                    f.id === file.id ? { ...f, status: FileStatus.COMPLETED } : f
                                )
                            );
                        }
                    } else {
                        setFiles((prev) =>
                            prev.map((f) =>
                                f.id === file.id
                                    ? {
                                        ...f,
                                        status: FileStatus.COMPLETED,
                                        remainingRawCharCount: 0,
                                    }
                                    : f
                            )
                        );
                        addToast("File đã sạch, không cần sửa.", "success");
                    }
                }
            } catch (err: any) {
                addToast(`Lỗi sửa: ${err.message}`, "error");
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === file.id ? { ...f, status: FileStatus.COMPLETED } : f
                    )
                );
            }
        }
    };

    // --- BATCH PROCESSING & AUTO FIX LOGIC ---
    const processBatch = useCallback(
        async (batchFiles: FileItem[], forceModelId?: string) => {
            const batchIds = new Set(batchFiles.map((f) => f.id));
            const batchStartTime = Date.now();
            setFiles((prev) =>
                prev.map((f) =>
                    batchIds.has(f.id)
                        ? { ...f, status: FileStatus.PROCESSING, errorMessage: undefined }
                        : f
                )
            );
            const promptToUse =
                promptTemplate && promptTemplate.trim().length > 0
                    ? promptTemplate
                    : DEFAULT_PROMPT;
            const currentBatchContext = lastContextRef.current;
            const batchNames = batchFiles.map((f) => f.name).join(", ");
            const currentTier = isFixPhaseRef.current ? "pro" : translationTier;
            addLog(
                `🚀 [BATCH START] Gửi ${batchFiles.length} file: ${batchNames} (Tier: ${currentTier})`,
                "info"
            );
            let effectiveModelPool: string[] = [];
            try {
                if (forceModelId) {
                    effectiveModelPool = [forceModelId];
                } else if (isFixPhaseRef.current) {
                    effectiveModelPool = TIER_MODELS.PRO_POOL.filter((id) =>
                        enabledModels.includes(id)
                    );
                } else {
                    effectiveModelPool = getEffectiveModelsForTier(
                        currentTier,
                        "translate",
                        enabledModels
                    );
                }
            } catch (e: any) {
                throw new Error("Tier Models unavailable.");
            }
            if (effectiveModelPool.length === 0) {
                if (currentTier === "pro") {
                    addLog(
                        "⚠️ Chế độ Pro: Tất cả Model Pro đã hết Quota hoặc bị tắt. Dừng lại.",
                        "error"
                    );
                    setFiles((prev) =>
                        prev.map((f) =>
                            batchIds.has(f.id) ? { ...f, status: FileStatus.IDLE } : f
                        )
                    );
                    setActiveBatches((prev) => Math.max(0, prev - 1));
                    setIsProcessing(false);
                    return;
                }
                addLog(
                    "⚠️ Tất cả Model trong Tier đã hết quota hoặc bị tắt. Vui lòng kiểm tra lại.",
                    "error"
                );
                setFiles((prev) =>
                    prev.map((f) =>
                        batchIds.has(f.id) ? { ...f, status: FileStatus.IDLE } : f
                    )
                );
                setActiveBatches((prev) => Math.max(0, prev - 1));
                setIsProcessing(false);
                return;
            }
            try {
                const inputData = batchFiles.map((f) => ({
                    id: f.id,
                    content: f.content,
                }));
                const { results, model, errorType, stats } = await translateBatchStream(
                    inputData,
                    promptToUse,
                    effectiveDictionary,
                    storyInfo.contextNotes || "",
                    effectiveModelPool,
                    currentBatchContext,
                    (fileId, partialContent) => {
                        setFiles((prev) =>
                            prev.map((f) => {
                                if (f.id === fileId) {
                                    return { ...f, translatedContent: partialContent };
                                }
                                return f;
                            })
                        );
                    },
                    (msg) => addLog(msg, "info"),
                    currentTier,
                    enabledModels,
                    storyInfo
                );
                const duration = Date.now() - batchStartTime;
                addLog(
                    `🤖 [BATCH SUCCESS] Dịch xong bằng model: ${model} trong ${(
                        duration / 1000
                    ).toFixed(1)}s`,
                    "success"
                );
                if (stats) {
                    addLog(
                        `🧠 [SMART CONTEXT] Đã lọc ngữ cảnh: ${stats.dictLines} từ vựng, ${stats.contextLines} dòng sự kiện.`,
                        "info"
                    );
                }
                if (batchFiles.length > 0) {
                    const sortedBatch = sortFiles([...batchFiles]);
                    const lastFile = sortedBatch[sortedBatch.length - 1];
                    const lastContent = results.get(lastFile.id);
                    if (lastContent && lastContent.length > 100) {
                        const globalIndex = files.findIndex((f) => f.id === lastFile.id);
                        if (globalIndex > lastContextIndexRef.current) {
                            lastContextIndexRef.current = globalIndex;
                            lastContextRef.current = lastContent.substring(
                                Math.max(0, lastContent.length - 5000)
                            );
                        }
                    }
                }
                setFiles((prev) =>
                    prev.map((f) => {
                        if (batchIds.has(f.id)) {
                            const translated = results.get(f.id);
                            if (translated || translated === "") {
                                if (
                                    errorType === "ENGLISH_HALLUCINATION" &&
                                    isEnglishContent(translated)
                                ) {
                                    addLog(
                                        `❌ [BATCH ERROR] File ${f.name} dịch ngược sang Tiếng Anh.`,
                                        "error"
                                    );
                                    return {
                                        ...f,
                                        status: FileStatus.ERROR,
                                        errorMessage: `Lỗi: Dịch ngược sang Tiếng Anh (Hallucination).`,
                                        retryCount: f.retryCount + 1,
                                        usedModel: model,
                                        processingDuration: duration,
                                    };
                                }
                                const rawCount = countForeignChars(translated);
                                if (rawCount > 0)
                                    addLog(
                                        `⚠️ [AUTO FIX] File ${f.name} còn ${rawCount} ký tự raw.`,
                                        "info"
                                    );
                                const sourceLang = storyInfo.languages && storyInfo.languages.length > 0 ? storyInfo.languages[0] : 'Convert thô';

                                const integrity = validateTranslationIntegrity(f.content, translated, ratioLimits, sourceLang);
                                if (!integrity.isValid) {
                                    addLog(
                                        `❌ [BATCH ERROR] File ${f.name}: ${integrity.reason}.`,
                                        "error"
                                    );
                                    return {
                                        ...f,
                                        status: FileStatus.ERROR,
                                        errorMessage: `Lỗi: ${integrity.reason}`,
                                        retryCount: f.retryCount + 1,
                                        usedModel: model,
                                        processingDuration: duration,
                                    };
                                }
                                return {
                                    ...f,
                                    status: FileStatus.COMPLETED,
                                    translatedContent: translated,
                                    remainingRawCharCount: rawCount,
                                    usedModel: model,
                                    processingDuration: duration,
                                };
                            } else {
                                addLog(
                                    `❌ [BATCH ERROR] File ${f.name} không có kết quả trả về.`,
                                    "error"
                                );
                                return {
                                    ...f,
                                    status: FileStatus.ERROR,
                                    errorMessage: "Lỗi Batch (AI không trả ID)",
                                    retryCount: f.retryCount + 1,
                                    processingDuration: duration,
                                };
                            }
                        }
                        return f;
                    })
                );
            } catch (err: any) {
                addLog(`💥 [BATCH FAILED] Lỗi toàn bộ Batch: ${err.message}`, "error");
                setFiles((prev) =>
                    prev.map((f) =>
                        batchIds.has(f.id)
                            ? {
                                ...f,
                                status: FileStatus.ERROR,
                                errorMessage: err.message,
                                retryCount: f.retryCount + 1,
                            }
                            : f
                    )
                );
            } finally {
                setActiveBatches((prev) => Math.max(0, prev - 1));
            }
        },
        [
            promptTemplate,
            effectiveDictionary,
            storyInfo.contextNotes,
            translationTier,
            files,
            enabledModels,
            ratioLimits,
            storyInfo,
        ]
    );

    // --- ENHANCED QUEUE PROCESSOR: ROUND-ROBIN DISPATCHER ---
    useEffect(() => {
        if (!isProcessing) return;

        let maxConcurrency = 1;
        let candidates: string[] = [];

        // 1. DETERMINE CANDIDATES & CONCURRENCY
        if (isFixPhaseRef.current) {
            // Fix Phase uses PRO pool
            candidates = TIER_MODELS.PRO_POOL.filter((id) =>
                enabledModels.includes(id)
            );
            maxConcurrency = 2; // Hard cap for fix
        } else {
            if (translationTier === "flash") {
                candidates = getEffectiveModelsForTier(
                    "flash",
                    "translate",
                    enabledModels
                );
                maxConcurrency = CONCURRENCY_CONFIG.FLASH;
            } else if (translationTier === "pro") {
                candidates = getEffectiveModelsForTier(
                    "pro",
                    "translate",
                    enabledModels
                );
                maxConcurrency = 1; // Strict serial for Pro Tier
            } else {
                // NORMAL TIER: Smart Load Balancer
                candidates = TIER_MODELS.PRO_POOL.filter((id) =>
                    enabledModels.includes(id)
                );
                // Check how many models are ALIVE (not depleted)
                const aliveModels = candidates.filter(
                    (id) => !quotaManager.isModelDepleted(id)
                );

                if (aliveModels.length === 0) {
                    setIsProcessing(false);
                    setIsSmartAutoMode(false);
                    setAutoFixEnabled(false);
                    addToast("Đã dừng: Tất cả Model Pro đã hết Quota (Dead).", "error");
                    saveSession();
                    setEndTime(Date.now());
                    setProcessingQueue([]);
                    isFixPhaseRef.current = false;
                    return;
                }
                // Dynamic Concurrency
                maxConcurrency = Math.min(
                    CONCURRENCY_CONFIG.NORMAL,
                    aliveModels.length
                );
            }
        }

        // 2. DISPATCH BATCHES
        if (activeBatches < maxConcurrency && processingQueue.length > 0) {
            // Use QuotaManager's Smart Load Balancer to pick the BEST model
            // It will prioritize models with waitTime=0, then those with shortest cooldown
            const selectedModelId = quotaManager.getBestModelForTask(candidates);

            if (!selectedModelId) {
                return; // Should be handled by loop guard, but safety check
            }

            const isComplex = storyInfo.languages.some((l) => {
                const low = l.toLowerCase();
                return (
                    low.includes("trung") ||
                    low.includes("chinese") ||
                    low.includes("nhật") ||
                    low.includes("japan") ||
                    low.includes("hàn") ||
                    low.includes("korea") ||
                    low.includes("raw") ||
                    low.includes("ngoại")
                );
            });
            const limits = isComplex ? batchLimits.complex : batchLimits.latin;
            const isV3 = selectedModelId.includes("gemini-3");
            const targetFileCount = isV3 ? limits.v3 : limits.v25;

            const promptLen = promptTemplate
                ? promptTemplate.length
                : DEFAULT_PROMPT.length;
            const contextLen = storyInfo.contextNotes
                ? storyInfo.contextNotes.length
                : 0;
            const dictLen = additionalDictionary ? additionalDictionary.length : 0;
            const estimatedOverhead =
                promptLen +
                Math.max(1000, Math.round(contextLen * 0.4)) +
                Math.max(1000, Math.round(dictLen * 0.4));
            const maxTotal = limits.maxTotalChars;
            const availableForFiles = Math.max(2000, maxTotal - estimatedOverhead);

            const nextBatch: string[] = [];
            let currentBatchChars = 0;

            for (let i = 0; i < processingQueue.length; i++) {
                if (nextBatch.length >= targetFileCount) break;
                const fileId = processingQueue[i];
                const file = files.find((f) => f.id === fileId);
                if (file) {
                    if (
                        file.content.length > availableForFiles &&
                        nextBatch.length === 0
                    ) {
                        nextBatch.push(fileId);
                        break;
                    }
                    if (currentBatchChars + file.content.length > availableForFiles)
                        break;
                    nextBatch.push(fileId);
                    currentBatchChars += file.content.length;
                }
            }

            if (nextBatch.length > 0) {
                const throttleDelay = activeBatches > 0 ? 1500 : 0;
                const remainingQueue = processingQueue.slice(nextBatch.length);
                setProcessingQueue(remainingQueue);
                setActiveBatches((prev) => prev + 1);
                const batchFiles = files.filter((f) => nextBatch.includes(f.id));

                // FORCE SPECIFIC MODEL ID TO ENSURE SMART LOAD BALANCING
                setTimeout(() => {
                    processBatch(batchFiles, selectedModelId);
                }, throttleDelay);
            }
        } else if (processingQueue.length === 0 && activeBatches === 0) {
            // ... (Completion Logic - Unchanged)
            const repairingFiles = files.filter(
                (f) => f.status === FileStatus.REPAIRING
            );
            if (repairingFiles.length > 0) {
                return;
            }
            const failedFiles = files.filter(
                (f) => f.status === FileStatus.ERROR && f.retryCount < 3
            );
            if (isSmartAutoMode && failedFiles.length > 0) {
                addToast(
                    `Smart Auto: Tự động thử lại ${failedFiles.length} file lỗi...`,
                    "info"
                );
                setFiles((prev) =>
                    prev.map((f) =>
                        f.status === FileStatus.ERROR
                            ? { ...f, status: FileStatus.IDLE, errorMessage: undefined }
                            : f
                    )
                );
                setProcessingQueue(failedFiles.map((f) => f.id));
                isFixPhaseRef.current = false;
                return;
            }
            const heavyRawFiles = files.filter(
                (f) =>
                    f.status === FileStatus.COMPLETED &&
                    f.remainingRawCharCount > 100 &&
                    f.retryCount < 2
            );
            if (isSmartAutoMode && heavyRawFiles.length > 0) {
                addToast(
                    `Smart Auto (Pro): Dịch lại ${heavyRawFiles.length} file lỗi nặng (>100 raw)...`,
                    "warning"
                );
                setFiles((prev) =>
                    prev.map((f) =>
                        heavyRawFiles.some((hr) => hr.id === f.id)
                            ? {
                                ...f,
                                status: FileStatus.IDLE,
                                translatedContent: null,
                                remainingRawCharCount: 0,
                                errorMessage: undefined,
                                retryCount: f.retryCount + 1,
                            }
                            : f
                    )
                );
                setProcessingQueue(heavyRawFiles.map((f) => f.id));
                isFixPhaseRef.current = true;
                return;
            }
            if (autoFixEnabled || isSmartAutoMode) {
                const fixTargets = files.filter(
                    (f) =>
                        f.status === FileStatus.COMPLETED && f.remainingRawCharCount > 0
                );
                const proModels = TIER_MODELS.PRO_POOL.filter((id) =>
                    enabledModels.includes(id)
                );
                const available = quotaManager.hasAvailableModels(proModels);
                if (fixTargets.length > 0 && available) {
                    setIsSmartAutoMode(false);
                    setAutoFixEnabled(false);
                    isFixPhaseRef.current = true;
                    handleFixRemainingRaw();
                    return;
                }
            }
            setIsProcessing(false);
            setIsSmartAutoMode(false);
            setAutoFixEnabled(false);
            setEndTime(Date.now());
            isFixPhaseRef.current = false;
            const hasIssues = files.some(
                (f) =>
                    f.status === FileStatus.ERROR ||
                    (f.status === FileStatus.COMPLETED && f.remainingRawCharCount > 0)
            );
            if (hasIssues) {
                addToast("Đã dừng. Vẫn còn file lỗi/sót raw, hãy kiểm tra!", "warning");
            } else {
                addToast("Hoàn tất toàn bộ quy trình.", "success");
            }
            lastContextRef.current = "";
            lastContextIndexRef.current = -1;
        }
    }, [
        isProcessing,
        processingQueue,
        activeBatches,
        files,
        processBatch,
        saveSession,
        isSmartAutoMode,
        storyInfo.languages,
        autoFixEnabled,
        translationTier,
        batchLimits,
        enabledModels,
        storyInfo.genres,
    ]);

    // ... (Rest of App.tsx remains identical)
    const executeProcessing = () => {
        let candidates =
            selectedFiles.size > 0
                ? files.filter((f) => selectedFiles.has(f.id))
                : files;
        if (candidates.length === 0) return;
        const filesToQueue = candidates.filter(
            (f) =>
                f.status === FileStatus.IDLE ||
                f.status === FileStatus.ERROR ||
                f.status === FileStatus.PROCESSING ||
                f.status === FileStatus.REPAIRING
        );
        if (filesToQueue.length === 0) {
            addToast("Đã xong (Không có file cần xử lý).", "info");
            return;
        }
        lastContextRef.current = "";
        lastContextIndexRef.current = -1;
        isFixPhaseRef.current = false;
        setProcessingQueue(filesToQueue.map((f) => f.id));
        setFiles((prev) =>
            prev.map((f) =>
                filesToQueue.some((q) => q.id === f.id)
                    ? {
                        ...f,
                        status: FileStatus.IDLE,
                        retryCount: f.status === FileStatus.ERROR ? 0 : f.retryCount,
                    }
                    : f
            )
        );
        setStartTime(Date.now());
        setEndTime(null);
        setIsProcessing(true);
        setActiveBatches(0);
        const stuckCount = filesToQueue.filter(
            (f) =>
                f.status === FileStatus.PROCESSING || f.status === FileStatus.REPAIRING
        ).length;
        addToast(
            `Bắt đầu dịch ${filesToQueue.length} file (Reset ${stuckCount} file treo)...`,
            "info"
        );
    };
    const checkStartPrerequisites = (): boolean => {
        const hasContext = !!(
            storyInfo.contextNotes && storyInfo.contextNotes.trim().length > 20
        );
        const isOptimized = !!(
            promptTemplate && promptTemplate.trim() !== DEFAULT_PROMPT.trim()
        );
        return hasContext && isOptimized;
    };
    const runSmartAutomation = async () => {
        if (files.length === 0) {
            addToast("Chưa có file nào", "error");
            return;
        }
        setIsSmartAutoMode(true);
        if (checkStartPrerequisites()) {
            setShowStartOptions(true);
        } else {
            setPendingSmartAuto(true);
            if (!promptTemplate || promptTemplate.trim() === DEFAULT_PROMPT.trim()) {
                setAutoOptimizePrompt(true);
            }
            setShowSmartStartModal(true);
            addToast("Trợ lý AI cần tìm hiểu truyện trước khi chạy tự động.", "info");
        }
    };
    const handleFixRemainingRaw = async () => {
        const rawTargets = files.filter(
            (f) => f.status === FileStatus.COMPLETED && f.remainingRawCharCount > 0
        );
        const targets = [...rawTargets];
        if (targets.length === 0) {
            addToast("Không có file nào cần sửa", "info");
            return;
        }
        setEndTime(null);
        setIsProcessing(true);
        setStartTime(Date.now());
        const fixModels = TIER_MODELS.PRO_POOL.filter((id) =>
            enabledModels.includes(id)
        );
        let rawLineCount = 0;
        const allBadLines: GlobalRepairEntry[] = [];
        setFiles((prev) =>
            prev.map((f) =>
                targets.some((t) => t.id === f.id)
                    ? { ...f, status: FileStatus.REPAIRING }
                    : f
            )
        );
        targets.forEach((f) => {
            if (f.translatedContent) {
                const rawLines = findLinesWithForeignChars(f.translatedContent);
                rawLineCount += rawLines.length;
                rawLines.forEach((l) => {
                    allBadLines.push({
                        fileId: f.id,
                        lineIndex: l.index,
                        originalLine: l.originalLine,
                    });
                });
            }
        });
        const fixMsg = [];
        if (rawLineCount > 0) fixMsg.push(`${rawLineCount} dòng Raw`);
        addToast(
            `Smart Fix: Bắt đầu sửa ${allBadLines.length} dòng lỗi (${fixMsg.join(
                ", "
            )}) trong ${targets.length} file...`,
            "info"
        );
        addLog(
            `🔍 Smart Fix bắt đầu (Pro Mode). Tổng ${allBadLines.length} lỗi...`,
            "info"
        );
        if (allBadLines.length === 0) {
            addToast(
                "Không tìm thấy dòng lỗi cụ thể (có thể do ký tự ẩn).",
                "warning"
            );
            setFiles((prev) =>
                prev.map((f) =>
                    f.status === FileStatus.REPAIRING
                        ? { ...f, status: FileStatus.COMPLETED }
                        : f
                )
            );
            setIsProcessing(false);
            isFixPhaseRef.current = false;
            return;
        }
        try {
            const applyFixesToState = (
                batchFixes: Map<string, Map<number, string>>
            ) => {
                setFiles((prev) => {
                    const newFiles = [...prev];
                    batchFixes.forEach((fileFixes, id) => {
                        const fIndex = newFiles.findIndex((f) => f.id === id);
                        if (fIndex !== -1 && newFiles[fIndex].translatedContent) {
                            const f = newFiles[fIndex];
                            const fixArray = Array.from(fileFixes.entries()).map(
                                ([idx, txt]) => ({ index: idx, text: txt })
                            );
                            const fixedContent = mergeFixedLines(
                                f.translatedContent!,
                                fixArray
                            );
                            const cleanContent = formatBookStyle(fixedContent);
                            const remainingRaw = countForeignChars(cleanContent);
                            newFiles[fIndex] = {
                                ...f,
                                translatedContent: cleanContent,
                                remainingRawCharCount: remainingRaw,
                            };
                        }
                    });
                    return newFiles;
                });
                saveSession();
            };
            const fixesMap = await performAggregatedRepair(
                allBadLines,
                effectiveDictionary,
                "pro",
                storyInfo.contextNotes,
                storyInfo,
                promptTemplate,
                (msg) => addLog(msg, "info"),
                enabledModels,
                applyFixesToState
            );
            let processedCount = 0;
            setFiles((prev) => {
                const newFiles = [...prev];
                fixesMap.forEach((fileFixes, id) => {
                    const fIndex = newFiles.findIndex((f) => f.id === id);
                    if (fIndex !== -1 && newFiles[fIndex].translatedContent) {
                        const f = newFiles[fIndex];
                        const fixArray = Array.from(fileFixes.entries()).map(
                            ([idx, txt]) => ({ index: idx, text: txt })
                        );
                        const fixedContent = mergeFixedLines(
                            f.translatedContent!,
                            fixArray
                        );
                        const cleanContent = formatBookStyle(fixedContent);
                        const remainingRaw = countForeignChars(cleanContent);
                        newFiles[fIndex] = {
                            ...f,
                            translatedContent: cleanContent,
                            remainingRawCharCount: remainingRaw,
                        };
                        processedCount += fixArray.length;
                    }
                });
                return newFiles;
            });
        } catch (e: any) {
            addLog(`❌ Lỗi sửa hàng loạt: ${e.message}`, "error");
        }
        setFiles((prev) =>
            prev.map((f) =>
                f.status === FileStatus.REPAIRING
                    ? { ...f, status: FileStatus.COMPLETED }
                    : f
            )
        );
        setIsProcessing(false);
        setEndTime(Date.now());
        isFixPhaseRef.current = false;
        addToast(
            "Hoàn tất quy trình Sửa & Định dạng (Aggregated Repair)",
            "success"
        );
        if (automationState.isRunning) {
            resumeAutomationWithCooldown();
        }
    };
    const handleSmartFix = () => {
        const heavyRawFiles = files.filter(
            (f) => f.status === FileStatus.COMPLETED && f.remainingRawCharCount > 100
        );
        const stuckFiles = files.filter(
            (f) =>
                f.status === FileStatus.PROCESSING || f.status === FileStatus.REPAIRING
        );
        const errorFiles = files.filter((f) => f.status === FileStatus.ERROR);
        const lightRawFiles = files.filter(
            (f) =>
                f.status === FileStatus.COMPLETED &&
                f.remainingRawCharCount > 0 &&
                f.remainingRawCharCount <= 100
        );
        if (
            heavyRawFiles.length === 0 &&
            stuckFiles.length === 0 &&
            errorFiles.length === 0 &&
            lightRawFiles.length === 0
        ) {
            addToast("Không tìm thấy file lỗi cần sửa.", "info");
            return;
        }
        let queueIds: string[] = [];
        if (heavyRawFiles.length > 0) {
            setFiles((prev) =>
                prev.map((f) => {
                    if (heavyRawFiles.some((h) => h.id === f.id)) {
                        return {
                            ...f,
                            status: FileStatus.IDLE,
                            translatedContent: null,
                            remainingRawCharCount: 0,
                            retryCount: 0,
                            usedModel: undefined,
                        };
                    }
                    return f;
                })
            );
            queueIds.push(...heavyRawFiles.map((f) => f.id));
        }
        const resetTargets = [...stuckFiles, ...errorFiles];
        if (resetTargets.length > 0) {
            setFiles((prev) =>
                prev.map((f) => {
                    if (resetTargets.some((r) => r.id === f.id)) {
                        return {
                            ...f,
                            status: FileStatus.IDLE,
                            usedModel: undefined,
                            retryCount: 0,
                        };
                    }
                    return f;
                })
            );
            queueIds.push(...resetTargets.map((f) => f.id));
        }
        const msg = [];
        if (heavyRawFiles.length > 0)
            msg.push(`${heavyRawFiles.length} file lỗi nặng`);
        if (resetTargets.length > 0)
            msg.push(`${resetTargets.length} file treo/lỗi`);
        if (lightRawFiles.length > 0)
            msg.push(`${lightRawFiles.length} file lỗi nhẹ`);
        addToast(`Smart Fix (Pro): Bắt đầu xử lý ${msg.join(", ")}...`, "warning");
        if (queueIds.length > 0) {
            setProcessingQueue(queueIds);
            setStartTime(Date.now());
            setEndTime(null);
            setIsProcessing(true);
            setActiveBatches(0);
            setIsSmartAutoMode(true);
            setAutoFixEnabled(true);
            isFixPhaseRef.current = true;
        } else if (lightRawFiles.length > 0) {
            setIsSmartAutoMode(true);
            setAutoFixEnabled(true);
            isFixPhaseRef.current = true;
            handleFixRemainingRaw();
        }
    };
    const visibleFiles = useMemo(() => {
        let filtered = files;
        if (filterStatuses.size > 0 || filterModels.size > 0) {
            filtered = files.filter((f) => {
                let statusMatch = true;
                if (filterStatuses.size > 0) {
                    if (filterStatuses.has("selected")) {
                        if (!selectedFiles.has(f.id)) return false;
                        if (filterStatuses.size === 1) return true;
                    }
                    const isCompleted = f.status === FileStatus.COMPLETED;
                    const isError = f.status === FileStatus.ERROR;
                    const isEnglishError = isError && f.errorMessage?.includes("English");
                    const isRaw = isCompleted && f.remainingRawCharCount > 0;
                    const isClean = isCompleted && f.remainingRawCharCount === 0;
                    const isProcessing =
                        f.status === FileStatus.PROCESSING ||
                        f.status === FileStatus.REPAIRING;
                    const isPending = f.status === FileStatus.IDLE;
                    const isShort = f.content.length < 1200;
                    const isErrorFilterMatch =
                        filterStatuses.has("error") &&
                        ((isError && !isEnglishError) || isProcessing);
                    const matchesStandardStatus =
                        (filterStatuses.has("completed") && isClean) ||
                        (filterStatuses.has("raw") && isRaw) ||
                        isErrorFilterMatch ||
                        (filterStatuses.has("english") && isEnglishError) ||
                        (filterStatuses.has("processing") && isProcessing) ||
                        (filterStatuses.has("pending") && isPending) ||
                        (filterStatuses.has("short") && isShort);
                    let isLowRatio = false;
                    if (filterStatuses.has("low_ratio")) {
                        if (isCompleted && f.translatedContent) {
                            const ratio =
                                f.originalCharCount > 0
                                    ? f.translatedContent.length / f.originalCharCount
                                    : 0;
                            const isLatin =
                                isVietnameseContent(f.content) || isEnglishContent(f.content);
                            const min = isLatin ? ratioLimits.vn.min : ratioLimits.cn.min;
                            if (ratio < min) isLowRatio = true;
                        }
                    }
                    if (filterStatuses.size > (filterStatuses.has("selected") ? 1 : 0)) {
                        statusMatch = matchesStandardStatus || isLowRatio;
                    }
                }
                let modelMatch = true;
                if (filterModels.size > 0) {
                    if (!f.usedModel) modelMatch = false;
                    else {
                        const m = f.usedModel;
                        modelMatch =
                            (filterModels.has("3pro") && m.includes("gemini-3-pro")) ||
                            (filterModels.has("25pro") && m.includes("gemini-2.5-pro")) ||
                            (filterModels.has("3flash") && m.includes("gemini-3-flash")) ||
                            (filterModels.has("25flash") && m.includes("gemini-2.5-flash"));
                    }
                }
                return statusMatch && modelMatch;
            });
        }
        if (currentPage === 0) return filtered;
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return filtered.slice(startIndex, endIndex);
    }, [
        files,
        filterStatuses,
        filterModels,
        currentPage,
        selectedFiles,
        ratioLimits,
    ]);
    const totalPages = Math.ceil(files.length / ITEMS_PER_PAGE);
    const getFileStatusMatches = (f: FileItem): string[] => {
        const matches: string[] = [];
        const isCompleted = f.status === FileStatus.COMPLETED;
        const isError = f.status === FileStatus.ERROR;
        const isEnglishError = isError && f.errorMessage?.includes("English");
        const isRaw = isCompleted && f.remainingRawCharCount > 0;
        const isClean = isCompleted && f.remainingRawCharCount === 0;
        const isProcessing =
            f.status === FileStatus.PROCESSING || f.status === FileStatus.REPAIRING;
        const isPending = f.status === FileStatus.IDLE;
        const isShort = f.content.length < 1200;
        if (isClean) matches.push("completed");
        if (isRaw) matches.push("raw");
        if ((isError && !isEnglishError) || isProcessing) matches.push("error");
        if (isEnglishError) matches.push("english");
        if (isPending) matches.push("pending");
        if (isShort) matches.push("short");
        if (isCompleted && f.translatedContent) {
            const ratio =
                f.originalCharCount > 0
                    ? f.translatedContent.length / f.originalCharCount
                    : 0;
            const isLatin =
                isVietnameseContent(f.content) || isEnglishContent(f.content);
            const min = isLatin ? ratioLimits.vn.min : ratioLimits.cn.min;
            if (ratio < min) matches.push("low_ratio");
        }
        return matches;
    };
    const toggleFilterStatus = (key: string) => {
        setFilterStatuses((prev) => {
            const next = new Set(prev);
            const isAdding = !next.has(key);
            if (isAdding) {
                next.add(key);
                if (key !== "selected") {
                    const matchingIds = new Set(selectedFiles);
                    files.forEach((f) => {
                        if (getFileStatusMatches(f).includes(key)) {
                            matchingIds.add(f.id);
                        }
                    });
                    setSelectedFiles(matchingIds);
                    addToast(`Đã chọn tự động các file thuộc nhóm: ${key}`, "info");
                }
            } else {
                next.delete(key);
            }
            return next;
        });
    };
    const toggleFilterModel = (key: string) => {
        setFilterModels((prev) => {
            const next = new Set(prev);
            const isAdding = !next.has(key);
            if (isAdding) {
                next.add(key);
                const matchingIds = new Set(selectedFiles);
                let count = 0;
                files.forEach((f) => {
                    if (!f.usedModel) return;
                    const m = f.usedModel;
                    const isMatch =
                        (key === "3pro" && m.includes("gemini-3-pro")) ||
                        (key === "25pro" && m.includes("gemini-2.5-pro")) ||
                        (key === "3flash" && m.includes("gemini-3-flash")) ||
                        (key === "25flash" && m.includes("gemini-2.5-flash"));
                    if (isMatch) {
                        matchingIds.add(f.id);
                        count++;
                    }
                });
                if (count > 0) {
                    setSelectedFiles(matchingIds);
                    addToast(`Đã chọn tự động ${count} file dùng model ${key}`, "info");
                }
            } else {
                next.delete(key);
            }
            return next;
        });
    };
    const clearFilters = () => {
        setFilterStatuses(new Set());
        setFilterModels(new Set());
        setShowFilterPanel(false);
        setSelectedFiles(new Set());
    };
    const handleStartButton = () => {
        if (files.length === 0) {
            addToast("Chưa có file", "error");
            return;
        }
        if (checkStartPrerequisites()) {
            setShowStartOptions(true);
        } else {
            setPendingSmartAuto(false);
            if (!promptTemplate || promptTemplate.trim() === DEFAULT_PROMPT.trim()) {
                setAutoOptimizePrompt(true);
            }
            setShowSmartStartModal(true);
            addToast(
                "Vui lòng thiết lập Ngữ cảnh & Prompt để đạt chất lượng tốt nhất.",
                "info"
            );
        }
    };
    const handleConfirmStart = (tier: TranslationTier) => {
        setTranslationTier(tier);
        setShowStartOptions(false);
        if (isSmartAutoMode) {
            setAutoFixEnabled(true);
            executeProcessing();
        } else {
            setAutoFixEnabled(true);
            executeProcessing();
        }
    };
    const handleDownloadMerged = () => {
        setActionProgress({
            current: 0,
            total: 100,
            message: "Đang gộp và định dạng nội dung (Local AI)...",
        });
        setTimeout(() => {
            const content = createMergedFile(files);
            if (!content) {
                addToast("Chưa có nội dung", "error");
                setActionProgress(null);
                return;
            }
            const fileName = generateExportFileName(
                storyInfo.title,
                storyInfo.author,
                ".txt"
            );
            downloadTextFile(fileName, content);
            addToast("Đã tải xuống file Gộp (Đã lọc rác & định dạng)", "success");
            setActionProgress(null);
        }, 100);
    };
    const handleDownloadRaw = async () => {
        if (files.length === 0) {
            addToast("Không có file nào", "error");
            return;
        }
        try {
            setActionProgress({
                current: 0,
                total: 100,
                message: "Đang chuẩn bị ZIP Raw (Auto Clean)...",
            });
            const fileName = generateExportFileName(
                storyInfo.title,
                storyInfo.author,
                "_Raw.zip"
            );
            await downloadRawAsZip(files, fileName, (percent, msg) => {
                setActionProgress({ current: percent, total: 100, message: msg });
            });
            addToast("Đã tải xuống file ZIP raw (Đã lọc rác)", "success");
        } catch (e: any) {
            addToast(`Lỗi tạo ZIP: ${e.message}`, "error");
        } finally {
            setActionProgress(null);
        }
    };
    const handleDownloadTranslatedZip = async () => {
        if (files.length === 0) {
            addToast("Không có file nào", "error");
            return;
        }
        try {
            setActionProgress({
                current: 0,
                total: 100,
                message: "Đang chuẩn bị ZIP Dịch (Auto Clean)...",
            });
            const fileName = generateExportFileName(
                storyInfo.title,
                storyInfo.author,
                "_Dich.zip"
            );
            await downloadTranslatedAsZip(files, fileName, (percent, msg) => {
                setActionProgress({ current: percent, total: 100, message: msg });
            });
            addToast(
                "Đã tải xuống file ZIP các chương dịch (Đã lọc rác & định dạng)",
                "success"
            );
        } catch (e: any) {
            addToast(`Lỗi: ${e.message}`, "error");
        } finally {
            setActionProgress(null);
        }
    };
    const handleDownloadEpub = async () => {
        if (files.length === 0) {
            addToast("Chưa có file nào", "error");
            return;
        }
        const readyFiles = files.filter(
            (f) => f.status === FileStatus.COMPLETED && f.translatedContent
        );
        if (readyFiles.length === 0) {
            addToast("Chưa có chương dịch hoàn tất", "error");
            return;
        }
        setShowEpubModal(true);
    };
    const performEpubGeneration = async (
        updatedInfo: StoryInfo,
        updatedCover: File | null
    ) => {
        setShowEpubModal(false);
        const readyFiles = files.filter(
            (f) => f.status === FileStatus.COMPLETED && f.translatedContent
        );
        if (readyFiles.length === 0) return;
        setActionProgress({
            current: 0,
            total: 100,
            message: "Đang tạo Ebook chuẩn (Batch Processing)...",
        });
        try {
            setStoryInfo(updatedInfo);
            if (updatedCover !== coverImage) setCoverImage(updatedCover);
            const blob = await generateEpub(
                readyFiles,
                updatedInfo,
                updatedCover,
                updatedInfo.summary || "",
                (percent) =>
                    setActionProgress({
                        current: percent,
                        total: 100,
                        message: `Đang đóng gói EPUB ${percent}%`,
                    })
            );
            const fileName = generateExportFileName(
                updatedInfo.title,
                updatedInfo.author,
                ".epub"
            );
            downloadEpubFile(fileName, blob);
            addToast(
                "Đã xuất bản EPUB thành công (Chuẩn Google Play/Kindle)!",
                "success"
            );
        } catch (e: any) {
            addToast(`Lỗi tạo EPUB: ${e.message}`, "error");
        } finally {
            setActionProgress(null);
        }
    };
    const handleSkipSmartStart = () => {
        setShowSmartStartModal(false);
        setShowStartOptions(true);
    };
    const handleSmartStartRun = async (
        useSearch: boolean,
        additionalRules: string,
        sampling: { start: number; middle: number; end: number }
    ) => {
        if (!storyInfo.title) {
            addToast("Vui lòng nhập tên truyện", "error");
            return;
        }
        try {
            setSmartStartStep("analyzing");
            addToast("Bắt đầu phân tích ngữ cảnh mẫu...", "info");
            const glossaryResult = await analyzeStoryContext(
                files,
                storyInfo,
                promptTemplate,
                effectiveDictionary,
                useSearch,
                additionalRules,
                sampling
            );
            if (glossaryResult.includes("Dữ liệu phân tích dừng tại")) {
                addToast(
                    "Phân tích một phần (Hết Quota/Lỗi). Đã lưu dữ liệu tạm.",
                    "warning"
                );
            }
            const currentDict = additionalDictionary || "";
            const prefix = currentDict.trim() ? "\n\n" : "";
            const newFullDictionary = currentDict.trim() + prefix + glossaryResult;
            const newContextNotes =
                (storyInfo.contextNotes || "") +
                (storyInfo.contextNotes ? "\n\n" : "") +
                glossaryResult;
            setAdditionalDictionary(newFullDictionary);
            setStoryInfo((prev) => ({
                ...prev,
                contextNotes: newContextNotes,
                additionalRules: additionalRules,
            }));
            setDictTab("custom");
            const postAnalysisStoryInfo = {
                ...storyInfo,
                contextNotes: newContextNotes,
                additionalRules: additionalRules,
            };
            let finalPromptToSave = promptTemplate;
            if (autoOptimizePrompt) {
                setSmartStartStep("optimizing");
                addToast(
                    "Đang kiến trúc Prompt dựa trên ngữ cảnh vừa tìm được...",
                    "info"
                );
                const optimized = await optimizePrompt(
                    DEFAULT_PROMPT,
                    postAnalysisStoryInfo,
                    newContextNotes,
                    newFullDictionary,
                    additionalRules
                );
                setPromptTemplate(optimized);
                finalPromptToSave = optimized;
            }
            const dataToSave = {
                ...stateRef.current,
                promptTemplate: finalPromptToSave,
                additionalDictionary: newFullDictionary,
                storyInfo: postAnalysisStoryInfo,
                lastSaved: new Date().toISOString(),
            };
            await saveToStorage(STORAGE_KEY, dataToSave);
            setLastSaved(new Date());
            setSmartStartStep("idle");
            setShowSmartStartModal(false);
            if (!glossaryResult.includes("Dữ liệu phân tích dừng tại")) {
                addToast("Đã cập nhật bộ quy tắc & Series Bible mới!", "success");
            }
            setShowStartOptions(true);
            setPendingSmartAuto(false);
            if (automationState.isRunning) {
                resumeAutomationWithCooldown();
            }
        } catch (e: any) {
            setSmartStartStep("idle");
            addToast(`Lỗi Smart Start: ${e.message}`, "error");
        }
    };
    const stopProcessing = () => {
        setIsProcessing(false);
        setIsSmartAutoMode(false);
        setAutoFixEnabled(false);
        setProcessingQueue([]);
        setEndTime(Date.now());
        setFiles((prev) =>
            prev.map((f) =>
                f.status === FileStatus.PROCESSING || f.status === FileStatus.REPAIRING
                    ? { ...f, status: FileStatus.IDLE, usedModel: undefined }
                    : f
            )
        );
        setActiveBatches(0);
        isFixPhaseRef.current = false;
        addToast("Đã dừng và reset hàng đợi", "info");
    };
    const handleRemoveFile = (id: string) => {
        setFiles((prev) => prev.filter((f) => f.id !== id));
        setSelectedFiles((prev) => {
            const n = new Set(prev);
            n.delete(id);
            return n;
        });
    };
    const handleSelectFile = (id: string, shiftKey: boolean) => {
        const newSelected = new Set(selectedFiles);
        if (shiftKey && lastSelectedId) {
            const idx1 = files.findIndex((f) => f.id === lastSelectedId);
            const idx2 = files.findIndex((f) => f.id === id);
            const start = Math.min(idx1, idx2);
            const end = Math.max(idx1, idx2);
            for (let i = start; i < end + 1; i++) newSelected.add(files[i].id);
        } else {
            if (newSelected.has(id)) newSelected.delete(id);
            else newSelected.add(id);
            setLastSelectedId(id);
        }
        setSelectedFiles(newSelected);
    };
    const selectAll = () => {
        if (selectedFiles.size === files.length) setSelectedFiles(new Set());
        else setSelectedFiles(new Set(files.map((f) => f.id)));
    };
    const handleRangeSelect = () => {
        const start = parseInt(rangeStart);
        const end = parseInt(rangeEnd);
        if (
            isNaN(start) ||
            isNaN(end) ||
            start < 1 ||
            end < 1 ||
            start > files.length ||
            end > files.length ||
            start > end
        ) {
            addToast(`Vui lòng nhập khoảng hợp lệ (1-${files.length})`, "error");
            return;
        }
        const newSelected = new Set(selectedFiles);
        for (let i = start - 1; i < end; i++) {
            if (files[i]) newSelected.add(files[i].id);
        }
        setSelectedFiles(newSelected);
        addToast(`Đã chọn ${end - start + 1} file`, "info");
    };
    const openEditor = (file: FileItem) => {
        setEditingFileId(file.id);
    };
    const saveEditor = (fileId: string, newContent: string) => {
        if (fileId) {
            const newRawCount = countForeignChars(newContent);
            setFiles((prev) =>
                prev.map((f) =>
                    f.id === fileId
                        ? {
                            ...f,
                            translatedContent: newContent,
                            status: FileStatus.COMPLETED,
                            remainingRawCharCount: newRawCount,
                            errorMessage: undefined,
                            retryCount: 0,
                        }
                        : f
                )
            );
            setEditingFileId(null);
            addToast("Đã lưu và cập nhật trạng thái", "success");
        }
    };
    // NEW: Save raw (original) content of a file
    const saveRawEditor = (fileId: string, newRawContent: string) => {
        if (fileId) {
            setFiles((prev) =>
                prev.map((f) =>
                    f.id === fileId
                        ? {
                            ...f,
                            content: newRawContent,
                            originalCharCount: newRawContent.length,
                        }
                        : f
                )
            );
        }
    };
    const requestRetranslateSingle = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedFiles(new Set([id]));
        setShowRetranslateModal(true);
    };
    const handleFindReplace = (
        pairs: { find: string; replace: string }[],
        scope: "all" | "selected"
    ) => {
        let count = 0;
        setFiles((prev) =>
            prev.map((f) => {
                if (scope === "selected" && !selectedFiles.has(f.id)) return f;
                if (f.translatedContent) {
                    let newContent = f.translatedContent;
                    let changed = false;
                    for (const { find, replace } of pairs) {
                        if (!find) continue;
                        try {
                            const regex = new RegExp(
                                find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                                "g"
                            );
                            const temp = newContent.replace(regex, replace);
                            if (temp !== newContent) {
                                newContent = temp;
                                changed = true;
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    }
                    if (changed) {
                        count++;
                        const newRawCount = countForeignChars(newContent);
                        return {
                            ...f,
                            translatedContent: newContent,
                            remainingRawCharCount: newRawCount,
                        };
                    }
                }
                return f;
            })
        );
        addToast(`Đã thay thế trong ${count} file`, "success");
    };
    const handleFindReplaceInFile = (
        fileId: string,
        findStr: string,
        replaceStr: string
    ) => {
        if (!findStr) return;
        setFiles((prev) =>
            prev.map((f) => {
                if (f.id === fileId && f.translatedContent) {
                    const regex = new RegExp(
                        findStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                        "g"
                    );
                    const newContent = f.translatedContent.replace(regex, replaceStr);
                    if (newContent !== f.translatedContent) {
                        const newRawCount = countForeignChars(newContent);
                        return {
                            ...f,
                            translatedContent: newContent,
                            remainingRawCharCount: newRawCount,
                        };
                    }
                }
                return f;
            })
        );
    };

    // --- AUTOMATION LOGIC ---
    const handleAutomationStart = (config: AutomationConfig) => {
        if (config.additionalRules) {
            setStoryInfo((prev) => ({
                ...prev,
                additionalRules: config.additionalRules,
            }));
        }
        setTranslationTier(config.tier);
        setAutomationState({
            isRunning: true,
            currentStep: 0,
            pendingSteps: config.steps,
            config: config,
            countdown: 0,
            totalSteps: config.steps.length,
            stepStatus: "Starting...",
        });
        setTimeout(() => processNextAutomationStep(config.steps), 500);
    };

    const processNextAutomationStep = async (remainingSteps: number[]) => {
        if (remainingSteps.length === 0) {
            setAutomationState((prev) => ({
                ...prev,
                isRunning: false,
                currentStep: 0,
            }));
            addToast("Quy trình tự động hóa hoàn tất!", "success");
            return;
        }
        const nextStep = remainingSteps[0];
        const futureSteps = remainingSteps.slice(1);
        setAutomationState((prev) => ({
            ...prev,
            currentStep: nextStep,
            pendingSteps: futureSteps,
        }));
        try {
            switch (nextStep) {
                case 1:
                    setAutomationState((p) => ({
                        ...p,
                        stepStatus: "Đang chạy Auto Phân Tích...",
                    }));
                    await handleAutoAnalyze();
                    processNextAutomationStep(futureSteps);
                    break;
                case 2:
                    setAutomationState((p) => ({
                        ...p,
                        stepStatus: "Chờ người dùng kiểm tra phân tích...",
                    }));
                    setTimeout(() => setShowNameAnalysisModal(true), 100);
                    break;
                case 3:
                    if (!storyInfo.title && storyInfo.genres.length === 0) {
                        addToast("Bỏ qua bước 3 (Thiếu metadata)", "warning");
                        processNextAutomationStep(futureSteps);
                    } else {
                        setAutomationState((p) => ({
                            ...p,
                            stepStatus: "Chờ người dùng kiểm tra Prompt...",
                        }));
                        setTimeout(() => setShowPromptDesigner(true), 100);
                    }
                    break;
                case 4:
                    setShowAutomationModal(false);
                    addToast("⚡ Auto: Bắt đầu quy trình Dịch thuật nền...", "info");
                    setAutomationState((p) => ({
                        ...p,
                        stepStatus: "Đang dịch thuật...",
                    }));
                    isAutomationWaitingRef.current = true;
                    executeProcessing();
                    return;
                case 5:
                    setShowAutomationModal(false);
                    addToast("🛠️ Auto: Bắt đầu quy trình Smart Fix nền...", "info");
                    setAutomationState((p) => ({ ...p, stepStatus: "Đang sửa lỗi..." }));
                    isAutomationWaitingRef.current = true;
                    handleSmartFix();
                    return;
                case 6:
                    setShowAutomationModal(false);
                    setAutomationState((p) => ({
                        ...p,
                        stepStatus: "Đang dọn dẹp định dạng...",
                    }));
                    handleManualCleanup("all");
                    resumeAutomationWithCooldown();
                    break;
            }
        } catch (e: any) {
            addToast(`Lỗi Auto Step ${nextStep}: ${e.message}`, "error");
            setAutomationState((p) => ({ ...p, isRunning: false }));
        }
    };

    const resumeAutomationWithCooldown = () => {
        const remainingSteps = automationState.pendingSteps;
        if (remainingSteps.length === 0) {
            processNextAutomationStep([]);
            return;
        }
        let seconds = 60;
        setAutomationState((prev) => ({ ...prev, countdown: seconds }));
        if (!showAutomationModal) {
            addToast(
                `Auto: Hoàn thành bước hiện tại. Nghỉ ${seconds}s hồi phục API...`,
                "warning"
            );
        }
        const timer = setInterval(() => {
            seconds--;
            setAutomationState((prev) => ({ ...prev, countdown: seconds }));
            if (seconds <= 0) {
                clearInterval(timer);
                processNextAutomationStep(remainingSteps);
            }
        }, 1000);
    };

    useEffect(() => {
        if (
            automationState.isRunning &&
            isAutomationWaitingRef.current &&
            !isProcessing
        ) {
            isAutomationWaitingRef.current = false;
            resumeAutomationWithCooldown();
        }
    }, [isProcessing, automationState.isRunning]);

    if (isResetting) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-600 font-sans animate-in fade-in duration-300">
                {" "}
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />{" "}
                <h2 className="text-xl font-bold">Đang dọn dẹp hệ thống...</h2>{" "}
                <p className="text-sm text-slate-400 mt-2">
                    Đang xóa bộ nhớ đệm và tái cấu trúc dữ liệu.
                </p>{" "}
            </div>
        );
    }

    return (
        <div
            className={`h-[100dvh] max-h-[100dvh] w-screen flex flex-col font-sans transition-colors duration-300 relative overflow-hidden ${isDarkMode
                    ? "dark bg-slate-950 text-slate-200"
                    : "bg-slate-50 text-slate-800"
                }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            {importProgress && (
                <LoadingModal isOpen={!!importProgress} progress={importProgress} />
            )}
            {actionProgress && (
                <LoadingModal isOpen={!!actionProgress} progress={actionProgress} />
            )}

            <ApiKeyPoolModal
                isOpen={showApiKeyPool}
                onClose={() => setShowApiKeyPool(false)}
                onToast={addToast}
            />

            <ModalManager
                showPasteModal={showPasteModal}
                setShowPasteModal={setShowPasteModal}
                showFindReplace={showFindReplace}
                setShowFindReplace={setShowFindReplace}
                confirmModal={confirmModal}
                setConfirmModal={setConfirmModal}
                importModal={importModal}
                setImportModal={setImportModal}
                splitterModal={splitterModal}
                setSplitterModal={setSplitterModal}
                zipActionModal={zipActionModal}
                setZipActionModal={setZipActionModal}
                handleZipKeepSeparate={handleZipKeepSeparate}
                handleZipMergeAndSplit={handleZipMergeAndSplit}
                showGuide={showGuide}
                setShowGuide={setShowGuide}
                showStartOptions={showStartOptions}
                setShowStartOptions={setShowStartOptions}
                showNameAnalysisModal={showNameAnalysisModal}
                setShowNameAnalysisModal={setShowNameAnalysisModal}
                showSmartStartModal={showSmartStartModal}
                setShowSmartStartModal={setShowSmartStartModal}
                showChangelog={showChangelog}
                setShowChangelog={setShowChangelog}
                editingFileId={editingFileId}
                setEditingFileId={setEditingFileId}
                showRetranslateModal={showRetranslateModal}
                setShowRetranslateModal={setShowRetranslateModal}
                showLogs={showLogs}
                setShowLogs={setShowLogs}
                systemLogs={systemLogs}
                clearLogs={() => setSystemLogs([])}
                showPromptDesigner={showPromptDesigner}
                setShowPromptDesigner={setShowPromptDesigner}
                handlePromptDesignerConfirm={handlePromptDesignerConfirm}
                isOptimizingPrompt={isOptimizingPrompt}
                handlePasteConfirm={handlePasteConfirm}
                handleFindReplace={handleFindReplace}
                selectedCount={selectedFiles.size}
                handleImportAppend={handleImportAppend}
                handleImportOverwrite={handleImportOverwrite}
                handleSplitConfirm={handleSplitConfirm}
                handleConfirmStart={handleConfirmStart}
                isSmartAutoMode={isSmartAutoMode}
                handleNameAnalysis={handleNameAnalysis}
                isAnalyzingNames={isAnalyzingNames}
                nameAnalysisProgress={nameAnalysisProgress}
                storyInfo={storyInfo}
                totalFiles={files.length}
                handleSmartStartRun={handleSmartStartRun}
                handleSkipSmartStart={handleSkipSmartStart}
                setStoryInfo={setStoryInfo}
                autoOptimizePrompt={autoOptimizePrompt}
                setAutoOptimizePrompt={setAutoOptimizePrompt}
                smartStartStep={smartStartStep}
                coverImage={coverImage}
                setCoverImage={setCoverImage}
                files={files}
                saveEditor={saveEditor}
                saveRawEditor={saveRawEditor}
                dictionary={additionalDictionary}
                promptTemplate={promptTemplate}
                addToast={addToast}
                setAdditionalDictionary={setAdditionalDictionary}
                handleFindReplaceInFile={handleFindReplaceInFile}
                handleRetranslateConfirm={handleRetranslateConfirm}
                showEpubModal={showEpubModal}
                setShowEpubModal={setShowEpubModal}
                handleEpubConfirm={performEpubGeneration}
                showAutomationModal={showAutomationModal}
                setShowAutomationModal={setShowAutomationModal}
                handleAutomationStart={handleAutomationStart}
                automationState={automationState}
            />
            <MainUI
                files={files}
                stats={stats}
                progressPercentage={progressPercentage}
                storyInfo={storyInfo}
                setStoryInfo={setStoryInfo}
                showSettings={showSettings}
                setShowSettings={setShowSettings}
                showLogs={showLogs}
                setShowLogs={setShowLogs}
                systemLogs={systemLogs}
                hasLogErrors={hasLogErrors}
                isDragging={isDragging}
                onShowChangelog={() => setShowChangelog(true)}
                isAutoSaving={isAutoSaving}
                lastSaved={lastSaved}
                enabledModels={enabledModels}
                modelConfigs={modelConfigs}
                modelUsages={modelUsages}
                toggleModel={toggleModel}
                handleManualResetQuota={handleManualResetQuota}
                handleTestModel={handleTestModel}
                testingModelId={testingModelId}
                startTime={startTime}
                endTime={endTime}
                coverPreviewUrl={coverPreviewUrl}
                handleCoverUpload={handleCoverUpload}
                handleAutoAnalyze={handleAutoAnalyze}
                isAutoAnalyzing={isAutoAnalyzing}
                autoAnalyzeStatus={autoAnalyzeStatus}
                quickInput={quickInput}
                setQuickInput={setQuickInput}
                handleQuickParse={handleQuickParse}
                handleRegenerateCover={handleRegenerateCover}
                isGeneratingCover={isGeneratingCover}
                handleBackup={handleBackup}
                handleRestore={handleRestore}
                requestResetApp={requestResetApp}
                handleContextDownload={handleContextDownload}
                handleContextFileUpload={handleContextFileUpload}
                setShowContextBuilder={setShowContextBuilder}
                setShowNameAnalysisModal={setShowNameAnalysisModal}
                isAnalyzingNames={isAnalyzingNames}
                setShowSmartStartModal={setShowSmartStartModal}
                viewOriginalPrompt={viewOriginalPrompt}
                setViewOriginalPrompt={setViewOriginalPrompt}
                handlePromptUpload={handlePromptUpload}
                resetPrompt={handleResetPromptRequest}
                promptTemplate={promptTemplate}
                setPromptTemplate={setPromptTemplate}
                handleOptimizePrompt={handleOptimizePrompt}
                isOptimizingPrompt={isOptimizingPrompt}
                handleDictionaryDownload={handleDictionaryDownload}
                handleDictionaryUpload={handleDictionaryUpload}
                dictTab={dictTab}
                setDictTab={setDictTab}
                additionalDictionary={additionalDictionary}
                setAdditionalDictionary={setAdditionalDictionary}
                setShowPromptDesigner={setShowPromptDesigner}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                totalPages={totalPages}
                visibleFiles={visibleFiles}
                selectedFiles={selectedFiles}
                handleSelectFile={handleSelectFile}
                handleManualFixSingle={handleManualFixSingle}
                handleRescueCopy={handleRescueCopy}
                requestRetranslateSingle={requestRetranslateSingle}
                openEditor={openEditor}
                handleRemoveFile={handleRemoveFile}
                handleFileUpload={handleFileUpload}
                setShowPasteModal={setShowPasteModal}
                selectAll={selectAll}
                rangeStart={rangeStart}
                setRangeStart={setRangeStart}
                rangeEnd={rangeEnd}
                setRangeEnd={setRangeEnd}
                handleRangeSelect={handleRangeSelect}
                setShowFindReplace={setShowFindReplace}
                runSmartAutomation={runSmartAutomation}
                isProcessing={isProcessing}
                handleSmartFix={handleSmartFix}
                showFilterPanel={showFilterPanel}
                setShowFilterPanel={setShowFilterPanel}
                filterModels={filterModels}
                filterStatuses={filterStatuses}
                toggleFilterModel={toggleFilterModel}
                toggleFilterStatus={toggleFilterStatus}
                clearFilters={clearFilters}
                handleScanJunk={handleScanJunk}
                handleManualCleanup={handleManualCleanup}
                setShowRetranslateModal={setShowRetranslateModal}
                handleSmartDelete={handleSmartDelete}
                requestDeleteAll={requestDeleteAll}
                handleDownloadRaw={handleDownloadRaw}
                handleDownloadTranslatedZip={handleDownloadTranslatedZip}
                handleDownloadMerged={handleDownloadMerged}
                handleDownloadSelected={handleDownloadSelected}
                handleDownloadEpub={handleDownloadEpub}
                stopProcessing={stopProcessing}
                handleStartButton={handleStartButton}
                setShowGuide={setShowGuide}
                batchLimits={batchLimits}
                setBatchLimits={setBatchLimits}
                ratioLimits={ratioLimits}
                setRatioLimits={setRatioLimits}
                isDarkMode={isDarkMode}
                toggleDarkMode={toggleDarkMode}
                showApiKeyPool={showApiKeyPool}
                setShowApiKeyPool={setShowApiKeyPool}
                setShowAutomationModal={setShowAutomationModal}
                automationState={automationState}
                handleRetranslateConfirm={handleRetranslateConfirm}
            />
        </div>
    );
};

export default App;
