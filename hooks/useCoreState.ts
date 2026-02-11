
import { useState, useRef, useEffect, useCallback } from 'react';
import { StoryInfo, FileItem, ModelQuota, BatchLimits, RatioLimits } from '../types';
import { DEFAULT_PROMPT, MODEL_CONFIGS } from '../constants';
import { loadFromStorage, saveToStorage, clearDatabase } from '../utils/storage';
import { quotaManager } from '../utils/quotaManager';
import { base64ToFile } from '../utils/fileHelpers';

const STORAGE_KEY = 'current_session_v1';

export const initialStoryInfo: StoryInfo = { 
    title: '', author: '', languages: ['Convert thô'], genres: ['Tiên Hiệp'], 
    mcPersonality: [], worldSetting: [], sectFlow: [], contextNotes: '', summary: '', additionalRules: '' 
};

export const useCoreState = (addToast: (msg: string, type: 'success'|'error'|'info' | 'warning') => void) => {
    const [files, setFiles] = useState<FileItem[]>([]);
    const [storyInfo, setStoryInfo] = useState<StoryInfo>(initialStoryInfo);
    const [promptTemplate, setPromptTemplate] = useState<string>(DEFAULT_PROMPT);
    const [additionalDictionary, setAdditionalDictionary] = useState<string>('');
    const [coverImage, setCoverImage] = useState<File | null>(null);
    const [autoSaveInterval, setAutoSaveInterval] = useState<number>(2);
    const [enabledModels, setEnabledModels] = useState<string[]>(MODEL_CONFIGS.map(m => m.id));
    const [modelConfigs, setModelConfigs] = useState<ModelQuota[]>(MODEL_CONFIGS);
    
    // NEW: Real-time Usage Stats
    const [modelUsages, setModelUsages] = useState(quotaManager.getUsageSnapshot());

    // Limits
    const [batchLimits, setBatchLimits] = useState<BatchLimits>({
        latin: { v3: 10, v25: 5, maxTotalChars: 220000 }, 
        complex: { v3: 10, v25: 5, maxTotalChars: 110000 } 
    });
    const [ratioLimits, setRatioLimits] = useState<RatioLimits>({
        vn: { min: 0.3, max: 1.4 },
        en: { min: 0.7, max: 1.4 },
        krjp: { min: 0.3, max: 3.2 },
        cn: { min: 2.3, max: 4.2 }
    });

    const [isResetting, setIsResetting] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const isResettingRef = useRef(false);
    
    // Subscribe to QuotaManager updates
    useEffect(() => {
        const unsubscribe = quotaManager.subscribe(() => {
            setModelUsages(quotaManager.getUsageSnapshot());
        });
        return unsubscribe;
    }, []);

    // Ref for saving to avoid stale closures in timeouts
    const stateRef = useRef({ files, promptTemplate, storyInfo, additionalDictionary, autoSaveInterval, enabledModels, modelConfigs, batchLimits, ratioLimits, coverImage });
    useEffect(() => { 
        stateRef.current = { files, promptTemplate, storyInfo, additionalDictionary, autoSaveInterval, enabledModels, modelConfigs, batchLimits, ratioLimits, coverImage }; 
    }, [files, promptTemplate, storyInfo, additionalDictionary, autoSaveInterval, enabledModels, modelConfigs, batchLimits, ratioLimits, coverImage]);

    // Load from storage
    useEffect(() => {
        if (navigator.storage && navigator.storage.persist) { 
            navigator.storage.persist().then(granted => {
                if (!granted) console.warn("Storage persistence denied. Data may be cleared by browser.");
            }); 
        }
        const loadData = async () => {
            try {
                const data = await loadFromStorage(STORAGE_KEY);
                if (data) {
                    if (data.files) setFiles(data.files);
                    if (data.promptTemplate) setPromptTemplate(data.promptTemplate);
                    if (data.storyInfo) setStoryInfo({ ...initialStoryInfo, ...data.storyInfo });
                    if (data.additionalDictionary) setAdditionalDictionary(data.additionalDictionary);
                    if (data.autoSaveInterval) setAutoSaveInterval(data.autoSaveInterval);
                    if (data.enabledModels) setEnabledModels(data.enabledModels);
                    if (data.batchLimits) setBatchLimits(data.batchLimits);
                    if (data.ratioLimits) setRatioLimits(data.ratioLimits);
                    if (data.coverImageBase64) {
                         try { setCoverImage(base64ToFile(data.coverImageBase64, "restored_cover.png")); } catch (e) {}
                    } else if (data.coverImage && data.coverImage instanceof Blob) {
                         setCoverImage(data.coverImage as File);
                    }
                    if (data.lastSaved) setLastSaved(new Date(data.lastSaved));
                    
                    // Sync quota manager
                    quotaManager.updateConfigs(MODEL_CONFIGS);
                    quotaManager.setEnabledModels(data.enabledModels || []);
                    // Update initial usages
                    setModelUsages(quotaManager.getUsageSnapshot());
                }
            } catch (err) { console.error("Restore failed:", err); }
        };
        loadData();
    }, []);

    // Sync enabled models to QuotaManager whenever changed
    useEffect(() => { quotaManager.setEnabledModels(enabledModels); }, [enabledModels]);

    const saveSession = useCallback(async () => {
        if (isResettingRef.current) return;
        // Allow saving even if files empty, as long as there is SOME info
        if (stateRef.current.files.length === 0 && !stateRef.current.storyInfo.title && !stateRef.current.additionalDictionary) return;
        
        setIsAutoSaving(true);
        try {
            const dataToSave = { ...stateRef.current, lastSaved: new Date().toISOString() };
            await saveToStorage(STORAGE_KEY, dataToSave);
            setLastSaved(new Date());
        } catch (e: any) { 
            console.error("Auto-save failed:", e); 
            // Optional: Notify user if save fails repeatedly
            if (e.name === 'QuotaExceededError') {
                addToast("Bộ nhớ trình duyệt đã đầy! Hãy xóa bớt file hoặc backup.", "error");
            }
        } 
        finally { setIsAutoSaving(false); }
    }, [addToast]);

    // --- DEBOUNCED AUTO SAVE (Save 2s after any change) ---
    useEffect(() => {
        const handler = setTimeout(() => {
            saveSession();
        }, 2000);
        return () => clearTimeout(handler);
    }, [files, storyInfo, promptTemplate, additionalDictionary, enabledModels, batchLimits, ratioLimits, saveSession]);

    // --- AGGRESSIVE SAVE LISTENERS (Fix Cốc Cốc/Background Tabs) ---
    useEffect(() => {
        const handleVisibilityChange = () => {
            // When user switches tabs or minimizes, save IMMEDIATELY
            if (document.visibilityState === 'hidden') {
                console.log("App hidden: Triggering forced save...");
                saveSession();
            }
        };

        const handlePageHide = () => {
            // Last chance to save before page unload/freeze
            saveSession();
        };

        // Listen for visibility change (Tab switch) and Page Hide (Close/Refresh)
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handlePageHide);
        window.addEventListener('blur', handleVisibilityChange); // Also trigger on window blur

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', handlePageHide);
            window.removeEventListener('blur', handleVisibilityChange);
        };
    }, [saveSession]);

    const performSoftReset = async () => {
        setIsResetting(true);
        isResettingRef.current = true;
        await new Promise(r => setTimeout(r, 50));
        try {
            await clearDatabase();
            localStorage.clear();
            quotaManager.reset();
            setFiles([]);
            setStoryInfo(initialStoryInfo);
            setPromptTemplate(DEFAULT_PROMPT);
            setAdditionalDictionary('');
            setCoverImage(null);
            setEnabledModels(MODEL_CONFIGS.map(m => m.id));
            setModelUsages(quotaManager.getUsageSnapshot()); // Reset usage UI
            addToast("Đã Reset toàn bộ dữ liệu!", "success");
        } catch (e) {
            addToast("Lỗi khi reset, vui lòng tải lại trang.", "error");
        } finally {
            isResettingRef.current = false;
            setIsResetting(false);
        }
    };

    return {
        files, setFiles,
        storyInfo, setStoryInfo,
        promptTemplate, setPromptTemplate,
        additionalDictionary, setAdditionalDictionary,
        coverImage, setCoverImage,
        autoSaveInterval, setAutoSaveInterval,
        enabledModels, setEnabledModels,
        modelConfigs, setModelConfigs,
        batchLimits, setBatchLimits,
        ratioLimits, setRatioLimits,
        isResetting, performSoftReset,
        isAutoSaving, lastSaved, saveSession,
        modelUsages, // EXPORTED HERE
        stateRef
    };
};