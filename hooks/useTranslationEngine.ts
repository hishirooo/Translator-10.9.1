
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FileItem, FileStatus, TranslationTier, GlobalRepairEntry } from '../types';
import { TIER_MODELS, DEFAULT_PROMPT, DEFAULT_DICTIONARY, CONCURRENCY_CONFIG } from '../constants';
import { quotaManager } from '../utils/quotaManager';
import { getEffectiveModelsForTier, translateBatchStream, performAggregatedRepair, repairTranslations } from '../geminiService';
import { sortFiles } from '../utils/fileHelpers';
import { findLinesWithForeignChars, countForeignChars, validateTranslationIntegrity, mergeFixedLines, formatBookStyle, isEnglishContent } from '../utils/textHelpers';

export const useTranslationEngine = (core: any, ui: any) => {
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [activeBatches, setActiveBatches] = useState<number>(0);
    const [processingQueue, setProcessingQueue] = useState<string[]>([]);
    const [translationTier, setTranslationTier] = useState<TranslationTier>('normal');
    const [isSmartAutoMode, setIsSmartAutoMode] = useState<boolean>(false);
    const [autoFixEnabled, setAutoFixEnabled] = useState<boolean>(false);
    
    const [startTime, setStartTime] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<number | null>(null);
    
    // Refs
    const lastContextRef = useRef<string>("");
    const lastContextIndexRef = useRef<number>(-1);
    const isFixPhaseRef = useRef<boolean>(false);

    // Helpers
    const effectiveDictionary = core.additionalDictionary ? DEFAULT_DICTIONARY + '\n' + core.additionalDictionary : DEFAULT_DICTIONARY;

    const stopProcessing = useCallback(() => {
        setIsProcessing(false);
        setIsSmartAutoMode(false);
        setAutoFixEnabled(false);
        setProcessingQueue([]);
        setEndTime(Date.now());
        core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => (f.status === FileStatus.PROCESSING || f.status === FileStatus.REPAIRING) ? { ...f, status: FileStatus.IDLE, usedModel: undefined } : f));
        setActiveBatches(0);
        isFixPhaseRef.current = false;
        ui.addToast('Đã dừng và reset hàng đợi', 'info');
    }, [core, ui]);

    const processBatch = useCallback(async (batchFiles: FileItem[], forceModelId?: string) => {
        const batchIds = new Set(batchFiles.map(f => f.id));
        const batchStartTime = Date.now();
        
        core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => batchIds.has(f.id) ? { ...f, status: FileStatus.PROCESSING, errorMessage: undefined } : f));
        
        const promptToUse = core.promptTemplate && core.promptTemplate.trim().length > 0 ? core.promptTemplate : DEFAULT_PROMPT;
        const currentBatchContext = lastContextRef.current;
        const batchNames = batchFiles.map(f => f.name).join(', ');
        const currentTier = isFixPhaseRef.current ? 'pro' : translationTier;
        
        ui.addLog(`🚀 [BATCH START] Gửi ${batchFiles.length} file: ${batchNames} (Tier: ${currentTier})`, "info");
        
        let effectiveModelPool: string[] = [];
        try {
            if (forceModelId) { effectiveModelPool = [forceModelId]; }
            else if (isFixPhaseRef.current) { effectiveModelPool = TIER_MODELS.PRO_POOL.filter(id => core.enabledModels.includes(id)); }
            else { effectiveModelPool = getEffectiveModelsForTier(currentTier, 'translate', core.enabledModels); }
        } catch (e: any) { throw new Error("Tier Models unavailable."); }

        if (effectiveModelPool.length === 0) {
            ui.addLog("⚠️ Tất cả Model trong Tier đã hết quota hoặc bị tắt. Dừng Auto.", "error");
            core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => batchIds.has(f.id) ? { ...f, status: FileStatus.IDLE } : f));
            setActiveBatches(prev => Math.max(0, prev - 1));
            stopProcessing(); // Emergency Stop
            return;
        }

        try {
            const inputData = batchFiles.map(f => ({ id: f.id, content: f.content }));
            
            const { results, model, errorType, stats } = await translateBatchStream(
                inputData, promptToUse, effectiveDictionary, core.storyInfo.contextNotes || "", effectiveModelPool, currentBatchContext,
                (fileId, partialContent) => {
                    core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => f.id === fileId ? { ...f, translatedContent: partialContent } : f));
                },
                (msg) => ui.addLog(msg, 'info'),
                currentTier, core.enabledModels, core.storyInfo
            );

            const duration = Date.now() - batchStartTime;
            ui.addLog(`🤖 [BATCH SUCCESS] Dịch xong bằng model: ${model} trong ${(duration/1000).toFixed(1)}s`, "success");
            
            // Update Context
            if (batchFiles.length > 0) {
                const sortedBatch = sortFiles([...batchFiles]);
                const lastFile = sortedBatch[sortedBatch.length - 1];
                const lastContent = results.get(lastFile.id);
                if (lastContent && lastContent.length > 100) {
                    const globalIndex = core.files.findIndex((f: FileItem) => f.id === lastFile.id);
                    if (globalIndex > lastContextIndexRef.current) {
                        lastContextIndexRef.current = globalIndex;
                        lastContextRef.current = lastContent.substring(Math.max(0, lastContent.length - 5000));
                    }
                }
            }

            // Finalize Files
            // EXTRACT SOURCE LANGUAGE FROM METADATA
            const sourceLang = core.storyInfo.languages[0] || "Convert thô";

            core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => {
                if (batchIds.has(f.id)) {
                    const translated = results.get(f.id);
                    if (translated || translated === "") {
                        if (errorType === "ENGLISH_HALLUCINATION" && isEnglishContent(translated)) {
                            ui.addLog(`❌ [BATCH ERROR] File ${f.name} dịch ngược sang Tiếng Anh.`, "error");
                            return { ...f, status: FileStatus.ERROR, errorMessage: `Lỗi: Dịch ngược sang Tiếng Anh (Hallucination).`, retryCount: f.retryCount + 1, usedModel: model, processingDuration: duration };
                        }
                        const rawCount = countForeignChars(translated);
                        // PASS SOURCE LANGUAGE TO VALIDATION
                        const integrity = validateTranslationIntegrity(f.content, translated, core.ratioLimits, sourceLang);
                        if (!integrity.isValid) {
                            ui.addLog(`❌ [BATCH ERROR] File ${f.name}: ${integrity.reason}.`, "error");
                            return { ...f, status: FileStatus.ERROR, errorMessage: `Lỗi: ${integrity.reason}`, retryCount: f.retryCount + 1, usedModel: model, processingDuration: duration };
                        }
                        return { ...f, status: FileStatus.COMPLETED, translatedContent: translated, remainingRawCharCount: rawCount, usedModel: model, processingDuration: duration };
                    } else {
                        ui.addLog(`❌ [BATCH ERROR] File ${f.name} không có kết quả trả về.`, "error");
                        return { ...f, status: FileStatus.ERROR, errorMessage: "Lỗi Batch (AI không trả ID)", retryCount: f.retryCount + 1, processingDuration: duration };
                    }
                }
                return f;
            }));

        } catch (err: any) {
            ui.addLog(`💥 [BATCH FAILED] Lỗi toàn bộ Batch: ${err.message}`, "error");
            core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => batchIds.has(f.id) ? { ...f, status: FileStatus.ERROR, errorMessage: err.message, retryCount: f.retryCount + 1 } : f));
            
            // EMERGENCY STOP LOGIC
            const msg = err.message?.toLowerCase() || "";
            if (msg.includes("quota") || msg.includes("exhausted") || msg.includes("depleted") || msg.includes("tất cả model") || msg.includes("resource")) {
                 ui.addToast("DỪNG KHẨN CẤP: Hệ thống Model đã sập (Hết Quota).", "error");
                 stopProcessing(); 
            }

        } finally {
            setActiveBatches(prev => Math.max(0, prev - 1));
        }
    }, [core.promptTemplate, effectiveDictionary, core.storyInfo.contextNotes, translationTier, core.files, core.enabledModels, core.ratioLimits, core.storyInfo, isFixPhaseRef.current, stopProcessing]);

    // QUEUE PROCESSOR
    useEffect(() => {
        if (!isProcessing) return;

        let maxConcurrency = 1;
        let candidates: string[] = [];

        if (isFixPhaseRef.current) {
            candidates = TIER_MODELS.PRO_POOL.filter(id => core.enabledModels.includes(id));
            maxConcurrency = 2;
        } else {
            if (translationTier === 'flash') {
                candidates = getEffectiveModelsForTier('flash', 'translate', core.enabledModels);
                maxConcurrency = CONCURRENCY_CONFIG.FLASH;
            } else if (translationTier === 'pro') {
                candidates = getEffectiveModelsForTier('pro', 'translate', core.enabledModels);
                maxConcurrency = 1; 
            } else {
                candidates = TIER_MODELS.PRO_POOL.filter(id => core.enabledModels.includes(id));
                const aliveModels = candidates.filter(id => !quotaManager.isModelDepleted(id));
                if (aliveModels.length === 0) {
                    stopProcessing();
                    ui.addToast("Đã dừng: Tất cả Model Pro đã hết Quota (Dead).", "error");
                    return;
                }
                maxConcurrency = Math.min(CONCURRENCY_CONFIG.NORMAL, aliveModels.length);
            }
        }

        if (activeBatches < maxConcurrency && processingQueue.length > 0) {
            const selectedModelId = quotaManager.getBestModelForTask(candidates);
            if (!selectedModelId) return; // Wait for available model

            const isComplex = core.storyInfo.languages.some((l: string) => { const low = l.toLowerCase(); return low.includes('trung') || low.includes('chinese') || low.includes('raw'); });
            const limits = isComplex ? core.batchLimits.complex : core.batchLimits.latin;
            const isV3 = selectedModelId.includes('gemini-3');
            const targetFileCount = isV3 ? limits.v3 : limits.v25;

            const nextBatch: string[] = [];
            let currentBatchChars = 0;
            
            for (let i = 0; i < processingQueue.length; i++) {
                if (nextBatch.length >= targetFileCount) break;
                const fileId = processingQueue[i];
                const file = core.files.find((f: FileItem) => f.id === fileId);
                if (file) {
                    if (currentBatchChars + file.content.length > limits.maxTotalChars) break;
                    nextBatch.push(fileId);
                    currentBatchChars += file.content.length;
                }
            }

            if (nextBatch.length > 0) {
                const throttleDelay = activeBatches > 0 ? 1500 : 0;
                const remainingQueue = processingQueue.slice(nextBatch.length);
                setProcessingQueue(remainingQueue);
                setActiveBatches(prev => prev + 1);
                const batchFiles = core.files.filter((f: FileItem) => nextBatch.includes(f.id));
                
                setTimeout(() => { processBatch(batchFiles, selectedModelId); }, throttleDelay);
            }
        } else if (processingQueue.length === 0 && activeBatches === 0) {
            // Completion Logic
            const repairingFiles = core.files.filter((f: FileItem) => f.status === FileStatus.REPAIRING);
            if (repairingFiles.length > 0) return;

            const failedFiles = core.files.filter((f: FileItem) => f.status === FileStatus.ERROR && f.retryCount < 3);
            if (isSmartAutoMode && failedFiles.length > 0) {
                ui.addToast(`Smart Auto: Tự động thử lại ${failedFiles.length} file lỗi...`, 'info');
                core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => f.status === FileStatus.ERROR ? { ...f, status: FileStatus.IDLE, errorMessage: undefined } : f));
                setProcessingQueue(failedFiles.map((f: FileItem) => f.id));
                isFixPhaseRef.current = false;
                return;
            }

            const heavyRawFiles = core.files.filter((f: FileItem) => f.status === FileStatus.COMPLETED && f.remainingRawCharCount > 100 && f.retryCount < 2);
            if (isSmartAutoMode && heavyRawFiles.length > 0) {
                ui.addToast(`Smart Auto (Pro): Dịch lại ${heavyRawFiles.length} file lỗi nặng (>100 raw)...`, 'warning');
                core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => heavyRawFiles.some(hr => hr.id === f.id) ? { ...f, status: FileStatus.IDLE, translatedContent: null, remainingRawCharCount: 0, errorMessage: undefined, retryCount: f.retryCount + 1 } : f));
                setProcessingQueue(heavyRawFiles.map((f: FileItem) => f.id));
                isFixPhaseRef.current = true;
                return;
            }

            if (autoFixEnabled || isSmartAutoMode) {
                const fixTargets = core.files.filter((f: FileItem) => f.status === FileStatus.COMPLETED && f.remainingRawCharCount > 0);
                const proModels = TIER_MODELS.PRO_POOL.filter(id => core.enabledModels.includes(id));
                const available = quotaManager.hasAvailableModels(proModels);
                if (fixTargets.length > 0 && available) {
                    setIsSmartAutoMode(false);
                    setAutoFixEnabled(false);
                    isFixPhaseRef.current = true;
                    handleFixRemainingRaw();
                    return;
                }
            }

            stopProcessing();
            const hasIssues = core.files.some((f: FileItem) => f.status === FileStatus.ERROR || (f.status === FileStatus.COMPLETED && f.remainingRawCharCount > 0));
            if (hasIssues) { ui.addToast('Đã dừng. Vẫn còn file lỗi/sót raw, hãy kiểm tra!', 'warning'); } 
            else { ui.addToast('Hoàn tất toàn bộ quy trình.', 'success'); }
            lastContextRef.current = "";
            lastContextIndexRef.current = -1;
        }
    }, [isProcessing, processingQueue, activeBatches, core.files, processBatch, isSmartAutoMode, translationTier, core.batchLimits, core.enabledModels, stopProcessing]);

    const executeProcessing = (): boolean => {
        let candidates = ui.selectedFiles.size > 0 ? core.files.filter((f: FileItem) => ui.selectedFiles.has(f.id)) : core.files;
        if (candidates.length === 0) return false;
        
        const filesToQueue = candidates.filter((f: FileItem) => f.status === FileStatus.IDLE || f.status === FileStatus.ERROR || f.status === FileStatus.PROCESSING || f.status === FileStatus.REPAIRING);
        if (filesToQueue.length === 0) { ui.addToast("Đã xong (Không có file cần xử lý).", 'info'); return false; }
        
        lastContextRef.current = "";
        lastContextIndexRef.current = -1;
        isFixPhaseRef.current = false;
        
        setProcessingQueue(filesToQueue.map((f: FileItem) => f.id));
        core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => (filesToQueue.some((q: FileItem) => q.id === f.id)) ? { ...f, status: FileStatus.IDLE, retryCount: (f.status === FileStatus.ERROR ? 0 : f.retryCount) } : f));
        setStartTime(Date.now());
        setEndTime(null);
        setIsProcessing(true);
        setActiveBatches(0);
        
        const stuckCount = filesToQueue.filter((f: FileItem) => f.status === FileStatus.PROCESSING || f.status === FileStatus.REPAIRING).length;
        ui.addToast(`Bắt đầu dịch ${filesToQueue.length} file (Reset ${stuckCount} file treo)...`, 'info');
        return true;
    };

    const handleFixRemainingRaw = async () => {
        const rawTargets = core.files.filter((f: FileItem) => f.status === FileStatus.COMPLETED && f.remainingRawCharCount > 0);
        const targets = [...rawTargets];
        if (targets.length === 0) { ui.addToast("Không có file nào cần sửa", 'info'); return; }
        
        setEndTime(null);
        setIsProcessing(true);
        setStartTime(Date.now());
        
        let rawLineCount = 0;
        const allBadLines: GlobalRepairEntry[] = [];
        core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => targets.some(t => t.id === f.id) ? { ...f, status: FileStatus.REPAIRING } : f));
        
        targets.forEach(f => {
            if (f.translatedContent) {
                const rawLines = findLinesWithForeignChars(f.translatedContent);
                rawLineCount += rawLines.length;
                rawLines.forEach(l => { allBadLines.push({ fileId: f.id, lineIndex: l.index, originalLine: l.originalLine }); });
            }
        });

        ui.addToast(`Smart Fix: Bắt đầu sửa ${allBadLines.length} dòng lỗi...`, 'info');
        ui.addLog(`🔍 Smart Fix bắt đầu (Pro Mode). Tổng ${allBadLines.length} lỗi...`, "info");

        if (allBadLines.length === 0) {
            ui.addToast("Không tìm thấy dòng lỗi cụ thể (có thể do ký tự ẩn).", "warning");
            core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => f.status === FileStatus.REPAIRING ? { ...f, status: FileStatus.COMPLETED } : f));
            setIsProcessing(false);
            isFixPhaseRef.current = false;
            return;
        }

        try {
            const fixesMap = await performAggregatedRepair(
                allBadLines, effectiveDictionary, 'pro', core.storyInfo.contextNotes, 
                core.storyInfo, core.promptTemplate, (msg) => ui.addLog(msg, 'info'), core.enabledModels
            );
            
            core.setFiles((prev: FileItem[]) => {
                const newFiles = [...prev];
                fixesMap.forEach((fileFixes, id) => {
                    const fIndex = newFiles.findIndex(f => f.id === id);
                    if (fIndex !== -1 && newFiles[fIndex].translatedContent) {
                        const f = newFiles[fIndex];
                        const fixArray = Array.from(fileFixes.entries()).map(([idx, txt]) => ({ index: idx, text: txt }));
                        const fixedContent = mergeFixedLines(f.translatedContent!, fixArray);
                        const cleanContent = formatBookStyle(fixedContent);
                        const remainingRaw = countForeignChars(cleanContent);
                        newFiles[fIndex] = { ...f, translatedContent: cleanContent, remainingRawCharCount: remainingRaw };
                    }
                });
                return newFiles;
            });
        } catch (e: any) {
            ui.addLog(`❌ Lỗi sửa hàng loạt: ${e.message}`, "error");
        }
        
        core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => f.status === FileStatus.REPAIRING ? { ...f, status: FileStatus.COMPLETED } : f));
        setIsProcessing(false);
        setEndTime(Date.now());
        isFixPhaseRef.current = false;
        ui.addToast("Hoàn tất quy trình Sửa & Định dạng (Aggregated Repair)", 'success');
    };

    const handleSmartFix = (): boolean => {
        const heavyRawFiles = core.files.filter((f: FileItem) => f.status === FileStatus.COMPLETED && f.remainingRawCharCount > 100);
        
        // NEW: Detect Low Ratio Files (Based on User Metadata provided Language)
        const lang = (core.storyInfo.languages[0] || "").toLowerCase();
        
        // Default to VN logic unless specified
        let minRatio = core.ratioLimits.vn.min;
        
        if (lang.includes('trung') || lang.includes('chinese') || lang.includes('cn')) minRatio = core.ratioLimits.cn.min;
        else if (lang.includes('anh') || lang.includes('english')) minRatio = core.ratioLimits.en.min;
        else if (lang.includes('nhật') || lang.includes('hàn')) minRatio = core.ratioLimits.krjp.min;

        const lowRatioFiles = core.files.filter((f: FileItem) => {
            if (f.status !== FileStatus.COMPLETED || !f.translatedContent) return false;
            const ratio = f.originalCharCount > 0 ? f.translatedContent.length / f.originalCharCount : 0;
            // Use strict comparison against the detected limit
            return ratio < minRatio;
        });

        const stuckFiles = core.files.filter((f: FileItem) => f.status === FileStatus.PROCESSING || f.status === FileStatus.REPAIRING);
        const errorFiles = core.files.filter((f: FileItem) => f.status === FileStatus.ERROR);
        const lightRawFiles = core.files.filter((f: FileItem) => f.status === FileStatus.COMPLETED && f.remainingRawCharCount > 0 && f.remainingRawCharCount <= 100);

        if (heavyRawFiles.length === 0 && lowRatioFiles.length === 0 && stuckFiles.length === 0 && errorFiles.length === 0 && lightRawFiles.length === 0) {
            ui.addToast("Không tìm thấy file lỗi cần sửa.", "info");
            return false;
        }

        let queueIds: string[] = [];
        
        // 1. Files needing RE-TRANSLATION (Heavy Raw OR Low Ratio)
        const retranslateTargets = [...heavyRawFiles, ...lowRatioFiles];
        const uniqueRetranslateIds = new Set(retranslateTargets.map(f => f.id));
        
        if (uniqueRetranslateIds.size > 0) {
            core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => uniqueRetranslateIds.has(f.id) ? { ...f, status: FileStatus.IDLE, translatedContent: null, remainingRawCharCount: 0, retryCount: 0, usedModel: undefined, errorMessage: "Smart Fix: Auto Re-queue (Raw/Ratio)" } : f));
            queueIds.push(...Array.from(uniqueRetranslateIds));
        }

        // 2. Files needing RESET (Stuck/Error)
        const resetTargets = [...stuckFiles, ...errorFiles];
        const uniqueResetIds = new Set(resetTargets.map(f => f.id));
        if (uniqueResetIds.size > 0) {
            core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => uniqueResetIds.has(f.id) ? { ...f, status: FileStatus.IDLE, usedModel: undefined, retryCount: 0 } : f));
            queueIds.push(...Array.from(uniqueResetIds));
        }

        ui.addToast(`Smart Fix (Pro): Bắt đầu xử lý ${queueIds.length} file...`, 'warning');
        
        if (queueIds.length > 0) {
            // Deduplicate queue
            const uniqueQueue = Array.from(new Set(queueIds));
            setProcessingQueue(uniqueQueue);
            setStartTime(Date.now());
            setEndTime(null);
            setIsProcessing(true);
            setActiveBatches(0);
            setIsSmartAutoMode(true);
            setAutoFixEnabled(true);
            isFixPhaseRef.current = true;
            return true;
        } else if (lightRawFiles.length > 0) {
            setIsSmartAutoMode(true);
            setAutoFixEnabled(true);
            isFixPhaseRef.current = true;
            handleFixRemainingRaw();
            return true;
        }
        return false;
    };

    const handleManualFixSingle = async (e: React.MouseEvent, fileId: string) => {
        e.stopPropagation();
        const file = core.files.find((f: FileItem) => f.id === fileId);
        if (!file) return;
        if (file.remainingRawCharCount > 100) {
            core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => f.id === fileId ? { ...f, status: FileStatus.IDLE, retryCount: 0, translatedContent: null, remainingRawCharCount: 0 } : f));
            setProcessingQueue(prev => [...prev, fileId]);
            setIsProcessing(true);
            if (!startTime) setStartTime(Date.now());
            ui.addToast(`Phát hiện lỗi nặng: Đã thêm vào hàng đợi dịch lại (Auto Fix).`, 'info');
        } else {
            if (file.status === FileStatus.REPAIRING || file.status === FileStatus.PROCESSING) return;
            core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => f.id === fileId ? { ...f, status: FileStatus.REPAIRING } : f));
            ui.addToast("Đang sửa lỗi nhỏ bằng Model Pro (Assistant Mode)...", "info");
            try {
                if (file.translatedContent) {
                    const badLines = findLinesWithForeignChars(file.translatedContent);
                    if (badLines.length > 0) {
                        const fixes = await repairTranslations(badLines, effectiveDictionary, 'pro', core.storyInfo.contextNotes, core.storyInfo, core.promptTemplate, (msg) => ui.addLog(msg, 'info'), core.enabledModels);
                        if (fixes.length > 0) {
                            const fixedContent = mergeFixedLines(file.translatedContent, fixes);
                            const cleanContent = formatBookStyle(fixedContent);
                            const remainingRaw = countForeignChars(cleanContent);
                            core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => f.id === file.id ? { ...f, status: FileStatus.COMPLETED, translatedContent: cleanContent, remainingRawCharCount: remainingRaw } : f));
                            ui.addToast("Đã sửa xong!", "success");
                        } else {
                            ui.addToast("Không thể sửa tự động.", "error");
                            core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => f.id === file.id ? { ...f, status: FileStatus.COMPLETED } : f));
                        }
                    } else {
                        core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => f.id === file.id ? { ...f, status: FileStatus.COMPLETED, remainingRawCharCount: 0 } : f));
                        ui.addToast("File đã sạch, không cần sửa.", "success");
                    }
                }
            } catch (err: any) {
                ui.addToast(`Lỗi sửa: ${err.message}`, "error");
                core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => f.id === file.id ? { ...f, status: FileStatus.COMPLETED } : f));
            }
        }
    };

    const handleRetranslateConfirm = (keepOld: boolean, tier: TranslationTier) => {
        const selectedIds = Array.from(ui.selectedFiles);
        if (selectedIds.length === 0) return;
        setTranslationTier(tier);
        core.setFiles((prev: FileItem[]) => prev.map((f: FileItem) => {
            if (ui.selectedFiles.has(f.id)) {
                return { ...f, status: FileStatus.IDLE, translatedContent: keepOld ? f.translatedContent : null, remainingRawCharCount: keepOld ? f.remainingRawCharCount : 0, errorMessage: undefined, retryCount: 0, usedModel: undefined };
            }
            return f;
        }));
        setProcessingQueue(prev => {
            const newQueue = [...prev];
            selectedIds.forEach(id => { if (!newQueue.includes(id as string)) newQueue.push(id as string); });
            return newQueue;
        });
        ui.setShowRetranslateModal(false);
        setIsProcessing(true);
        if (!startTime) setStartTime(Date.now());
        setEndTime(null);
        ui.addToast(`Đã thêm ${selectedIds.length} file vào hàng đợi dịch lại (Tier: ${tier})`, 'info');
    };

    return {
        isProcessing, activeBatches, processingQueue, startTime, endTime,
        translationTier, setTranslationTier,
        isSmartAutoMode, setIsSmartAutoMode,
        autoFixEnabled, setAutoFixEnabled,
        executeProcessing, stopProcessing, handleSmartFix,
        handleManualFixSingle, handleRetranslateConfirm, handleFixRemainingRaw
    };
};
