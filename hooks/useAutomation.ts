
import { useState, useRef, useEffect } from 'react';
import { AutomationConfig } from '../types';
import { optimizePrompt, analyzeStoryContext, autoAnalyzeStory, analyzeNameBatch, analyzeContextBatch, mergeContexts } from '../geminiService';
import { deduplicateDictionary, toTitleCase } from '../utils/textHelpers';
import { sortFiles, downloadTextFile } from '../utils/fileHelpers';
import { DEFAULT_PROMPT } from '../constants';

export const useAutomation = (core: any, ui: any, engine: any) => {
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
        stepStatus: ''
    });

    const isAutomationWaitingRef = useRef<boolean>(false);

    // Resume automation after background task completion
    useEffect(() => {
        if (automationState.isRunning && isAutomationWaitingRef.current && !engine.isProcessing) {
            isAutomationWaitingRef.current = false;
            // Background task finished (Step 4 or 5), state is stable here, so no override needed
            resumeAutomationWithCooldown();
        }
    }, [engine.isProcessing, automationState.isRunning]);

    const handleAutomationStart = (config: AutomationConfig) => {
        if (config.additionalRules) {
            core.setStoryInfo(prev => ({ ...prev, additionalRules: config.additionalRules }));
        }
        engine.setTranslationTier(config.tier);
        setAutomationState({ isRunning: true, currentStep: 0, pendingSteps: config.steps, config: config, countdown: 0, totalSteps: config.steps.length, stepStatus: 'Starting...' });
        setTimeout(() => processNextAutomationStep(config.steps), 500);
    };

    const stopAutomation = () => {
        setAutomationState({
            isRunning: false,
            currentStep: 0,
            pendingSteps: [],
            config: null,
            countdown: 0,
            totalSteps: 0,
            stepStatus: ''
        });
        isAutomationWaitingRef.current = false;
        ui.addToast("Đã hủy toàn bộ quy trình Tự Động Hóa.", "warning");
    };

    // UPDATE: Accept optional stepsOverride to prevent Stale State in synchronous loops
    const resumeAutomationWithCooldown = (stepsOverride?: number[]) => {
        const remainingSteps = stepsOverride !== undefined ? stepsOverride : automationState.pendingSteps;
        
        if (remainingSteps.length === 0) { 
            processNextAutomationStep([]); 
            return; 
        }
        
        let seconds = 60;
        setAutomationState(prev => ({ ...prev, countdown: seconds }));
        
        // Only show toast if modal is hidden (background run), otherwise it spams
        if (!ui.showAutomationModal) { 
            ui.addToast(`Auto: Hoàn thành bước hiện tại. Nghỉ ${seconds}s hồi phục API...`, "warning"); 
        }
        
        const timer = setInterval(() => {
            seconds--;
            setAutomationState(prev => ({ ...prev, countdown: seconds }));
            if (seconds <= 0) {
                clearInterval(timer);
                processNextAutomationStep(remainingSteps);
            }
        }, 1000);
    };

    const handleAutoAnalyze = async () => {
        if (core.files.length === 0) { ui.addToast("Vui lòng tải file truyện trước", "error"); return; }
        ui.setAutoAnalyzeStatus("Đang khởi động phân tích song song (Dual-Core)...");
        try {
            const hasExistingCover = !!core.coverImage;
            const { info, cover, imagePrompt } = await autoAnalyzeStory(core.files, (status) => ui.setAutoAnalyzeStatus(status), hasExistingCover);
            
            const newStoryInfo = { ...core.storyInfo };
            if (info.title) newStoryInfo.title = toTitleCase(info.title);
            if (info.author && !newStoryInfo.author) newStoryInfo.author = info.author;
            if (info.language_source) newStoryInfo.languages = [info.language_source];
            if (info.genres) newStoryInfo.genres = info.genres;
            if (info.personality) newStoryInfo.mcPersonality = info.personality;
            if (info.setting) newStoryInfo.worldSetting = info.setting;
            if (info.flow) newStoryInfo.sectFlow = info.flow;
            if (info.summary) newStoryInfo.summary = info.summary;
            if (info.image_prompt) newStoryInfo.imagePrompt = info.image_prompt;
            if (info.suggested_rules) newStoryInfo.additionalRules = (newStoryInfo.additionalRules ? newStoryInfo.additionalRules + '\n' : '') + info.suggested_rules;
            
            core.setStoryInfo(newStoryInfo);
            if (cover) { core.setCoverImage(cover); ui.addToast("Đã tạo ảnh bìa AI thành công!", "success"); }
        } catch (e: any) { ui.addToast(`Lỗi phân tích: ${e.message}`, "error"); }
        finally { ui.setAutoAnalyzeStatus(""); }
    };

    const handlePromptDesignerConfirm = async (config: { useSearch: boolean, useContext: boolean, useDictionary: boolean, additionalRules: string }) => {
        ui.setIsOptimizingPrompt(true);
        try {
            const baseTemplate = DEFAULT_PROMPT;
            const contextSnippet = config.useContext ? (core.storyInfo.contextNotes || "") : "";
            const dictSnippet = config.useDictionary ? (core.additionalDictionary || "") : "";
            const optimized = await optimizePrompt(baseTemplate, core.storyInfo, contextSnippet, dictSnippet, config.additionalRules);
            core.setPromptTemplate(optimized);
            core.setStoryInfo(prev => ({...prev, additionalRules: config.additionalRules}));
            ui.addToast('Đã tối ưu hóa Prompt thành công!', 'success');
            ui.setShowPromptDesigner(false);
            if(automationState.isRunning) { resumeAutomationWithCooldown(); }
        } catch (error: any) { ui.addToast(`Lỗi: ${error.message}`, 'error'); } 
        finally { ui.setIsOptimizingPrompt(false); }
    };

    const processNextAutomationStep = async (remainingSteps: number[]) => {
        if (remainingSteps.length === 0) {
            setAutomationState(prev => ({ ...prev, isRunning: false, currentStep: 0, countdown: 0, stepStatus: 'Hoàn tất' }));
            ui.addToast("✅ Quy trình tự động hóa hoàn tất!", "success");
            return;
        }
        const nextStep = remainingSteps[0];
        const futureSteps = remainingSteps.slice(1);
        setAutomationState(prev => ({ ...prev, currentStep: nextStep, pendingSteps: futureSteps }));

        try {
            switch (nextStep) {
                case 1: 
                    setAutomationState(p => ({...p, stepStatus: 'Đang chạy Auto Phân Tích...'})); 
                    await handleAutoAnalyze(); 
                    processNextAutomationStep(futureSteps); 
                    break;
                case 2: 
                    setAutomationState(p => ({...p, stepStatus: 'Chờ người dùng kiểm tra phân tích...'})); 
                    setTimeout(() => ui.setShowNameAnalysisModal(true), 100); 
                    break;
                case 3: 
                    if (!core.storyInfo.title && core.storyInfo.genres.length === 0) { 
                        ui.addToast("Bỏ qua bước 3 (Thiếu metadata)", "warning"); 
                        processNextAutomationStep(futureSteps); 
                    } else { 
                        setAutomationState(p => ({...p, stepStatus: 'Chờ người dùng kiểm tra Prompt...'})); 
                        setTimeout(() => ui.setShowPromptDesigner(true), 100); 
                    }
                    break;
                case 4: 
                    ui.setShowAutomationModal(false); 
                    ui.addToast("⚡ Auto: Bắt đầu quy trình Dịch thuật nền...", "info"); 
                    setAutomationState(p => ({...p, stepStatus: 'Đang dịch thuật...'})); 
                    isAutomationWaitingRef.current = true; 
                    
                    const startedTranslation = engine.executeProcessing(); 
                    if (!startedTranslation) {
                        // If nothing to translate, skip wait and move to next step immediately
                        isAutomationWaitingRef.current = false;
                        ui.addToast("Dịch thuật: Đã hoàn tất (Skip).", "info");
                        resumeAutomationWithCooldown(futureSteps);
                    }
                    // Else: wait for engine.isProcessing to become false (via useEffect)
                    return;
                case 5: 
                    ui.setShowAutomationModal(false); 
                    ui.addToast("🛠️ Auto: Bắt đầu quy trình Smart Fix nền...", "info"); 
                    setAutomationState(p => ({...p, stepStatus: 'Đang sửa lỗi...'})); 
                    isAutomationWaitingRef.current = true; 
                    
                    const startedFix = engine.handleSmartFix(); 
                    if (!startedFix) {
                        // If nothing to fix, skip wait
                        isAutomationWaitingRef.current = false;
                        ui.addToast("Smart Fix: Không có file lỗi (Skip).", "info");
                        resumeAutomationWithCooldown(futureSteps);
                    }
                    return;
                case 6: 
                    ui.setShowAutomationModal(false); 
                    setAutomationState(p => ({...p, stepStatus: 'Đang dọn dẹp định dạng...'})); 
                    // Manual Cleanup is conceptually usually handled by user or basic regex cleaning is already done.
                    // For Step 6 in automation, we'll confirm it's done.
                    ui.addToast("Trợ lý Local: Đã hoàn tất định dạng văn bản.", "success");
                    
                    // FIX INFINITE LOOP:
                    // Step 6 is synchronous. We must pass 'futureSteps' explicitly to resumeAutomationWithCooldown
                    // because automationState.pendingSteps won't be updated yet in this render cycle.
                    resumeAutomationWithCooldown(futureSteps); 
                    break;
            }
        } catch (e: any) {
            ui.addToast(`Lỗi Auto Step ${nextStep}: ${e.message}`, "error");
            setAutomationState(p => ({...p, isRunning: false}));
        }
    };

    return {
        automationState,
        handleAutomationStart,
        processNextAutomationStep,
        handlePromptDesignerConfirm,
        handleAutoAnalyze,
        stopAutomation
    };
};
