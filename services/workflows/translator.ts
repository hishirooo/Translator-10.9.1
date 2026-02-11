
import { getAiClient, smartExecution, SAFETY_SETTINGS } from '../api/gemini';
import { quotaManager } from '../../utils/quotaManager';
import { MODEL_CONFIGS, TIER_MODELS, REPAIR_CONFIG } from '../../constants';
import { StoryInfo, TranslationTier, RatioLimits } from '../../types';
import { optimizeDictionary, optimizeContext, isEnglishContent, findLinesWithForeignChars, mergeFixedLines, formatBookStyle, validateTranslationIntegrity, LineContext } from '../../utils/textHelpers';
import { getPronounRules } from '../../prompts';

export interface GlobalRepairEntry { fileId: string; lineIndex: number; originalLine: string; }

export const getEffectiveModelsForTier = (
    tier: TranslationTier, 
    taskType: 'translate' | 'auto_fix' | 'smart_fix',
    enabledModels: string[] = MODEL_CONFIGS.map(m => m.id)
): string[] => {
    const allPro = TIER_MODELS.PRO_POOL.filter(id => enabledModels.includes(id));
    const allFlash = TIER_MODELS.FLASH_POOL.filter(id => enabledModels.includes(id));
    
    const isDepleted = (id: string) => quotaManager.getModelUsage(id)?.isDepleted;

    // RULE 1: Smart Fix Button always uses Pro Models (Explicit user request)
    if (taskType === 'smart_fix') {
        const livePro = allPro.filter(id => !isDepleted(id));
        if (livePro.length > 0) return livePro;
        console.warn("Smart Fix requested but Pro models depleted. Falling back to Flash.");
        return allFlash.filter(id => !isDepleted(id));
    }

    // RULE 2: Pro Tier -> Always Pro
    if (tier === 'pro') {
        return allPro.filter(id => !isDepleted(id));
    }

    // RULE 3: Normal Tier -> Pro for Translate, Flash for Auto Fix
    if (tier === 'normal') {
        if (taskType === 'translate') {
            return allPro.filter(id => !isDepleted(id));
        } else {
            return allFlash.filter(id => !isDepleted(id));
        }
    }

    // RULE 4: Flash Tier -> Always Flash
    return allFlash.filter(id => !isDepleted(id));
};

export const repairBatch = async (entries: GlobalRepairEntry[], dictionary: string, tier: TranslationTier, context?: string, storyInfo?: StoryInfo, promptTemplate?: string, onLog?: (msg: string) => void, enabledModels?: string[]): Promise<Map<string, Map<number, string>>> => {
    if (!entries.length) return new Map();
    const instruction = `Senior Editor: Fix errors (typos, wrong pronouns, foreign chars). Return ONLY the corrected text for each ID. Format: ID_X: Corrected text. DO NOT include meta tags like [Fixed]. Story: ${storyInfo?.title}.`;
    
    const genreRules = storyInfo ? getPronounRules(storyInfo.genres) : ""; 
    const prompt = `[DICT]\n${dictionary}\n[ROLES]\n${storyInfo?.contextNotes?.substring(0,2000)}\n[RULES & PRONOUNS (MANDATORY)]\n${genreRules}\n[LINES]\n${entries.map((e,i) => `ID_${i}: ${e.originalLine}`).join('\n')}`;
    const candidates = getEffectiveModelsForTier(tier, 'auto_fix', enabledModels);
    const isPro = candidates.some(id => TIER_MODELS.PRO_POOL.includes(id));
    const fixModelLabel = isPro ? "Pro" : "Flash";
    
    return await smartExecution(candidates, async mid => {
        const res = await getAiClient().models.generateContent({ model: mid, contents: prompt, config: { systemInstruction: instruction, temperature: 0.1 } });
        const map = new Map<string, Map<number, string>>();
        res.text?.split('\n').forEach(l => {
            const m = l.match(/^(?:\*\*)?ID_(\d+)(?:\*\*)?\s*[:.-]\s*(.*)$/i);
            if (m) {
                const entry = entries[parseInt(m[1])];
                if (entry) {
                    if (!map.has(entry.fileId)) map.set(entry.fileId, new Map());
                    let cleanedText = m[2].trim();
                    cleanedText = cleanedText.replace(/^\[(Fixed|Corrected|Sửa|Done)\]\s*[:.-]?\s*/i, '');
                    cleanedText = cleanedText.replace(/^Fixed:\s*/i, '');
                    map.get(entry.fileId)?.set(entry.lineIndex, cleanedText);
                }
            }
        });
        return map;
    }, `Batch Repair (${fixModelLabel})`, onLog);
};

export const performAggregatedRepair = async (
    allBadLines: GlobalRepairEntry[], 
    dictionary: string, 
    tier: TranslationTier, 
    context?: string, 
    storyInfo?: StoryInfo, 
    promptTemplate?: string, 
    onLog?: (msg: string) => void, 
    enabledModels?: string[],
    onBatchComplete?: (batchFixes: Map<string, Map<number, string>>) => void
): Promise<Map<string, Map<number, string>>> => {
    const combined = new Map<string, Map<number, string>>();
    const total = allBadLines.length;
    const batchLimit = REPAIR_CONFIG.BATCH_SIZE;
    
    for (let i = 0; i < total; i += batchLimit) {
        const chunk = allBadLines.slice(i, i + batchLimit);
        const batchNum = Math.floor(i / batchLimit) + 1;
        const totalBatches = Math.ceil(total / batchLimit);
        
        if (onLog) onLog(`🛠️ Đang sửa Batch ${batchNum}/${totalBatches} (${chunk.length} dòng)...`);
        
        const chunkContent = chunk.map(c => c.originalLine).join('\n');
        const chunkDict = optimizeDictionary(dictionary, chunkContent);
        
        try {
            const res = await repairBatch(chunk, chunkDict, tier, context, storyInfo, promptTemplate, onLog, enabledModels);
            res.forEach((m, id) => {
                if (!combined.has(id)) combined.set(id, new Map());
                m.forEach((t, idx) => combined.get(id)?.set(idx, t));
            });
            if (onBatchComplete) onBatchComplete(res);
            if (onLog) onLog(`✅ Hoàn tất Batch ${batchNum}/${totalBatches}`);
        } catch (e: any) {
            if (onLog) onLog(`❌ Lỗi Batch ${batchNum}: ${e.message}`);
            if (e.message.includes('Quota') || e.message.includes('429')) break;
        }
    }
    return combined;
};

export const translateBatch = async (
    files: { id: string, content: string }[],
    userPrompt: string,
    dictionary: string,
    globalContext: string,
    allowedModelIds: string[], 
    previousBatchContext: string = "",
    tier: TranslationTier = 'normal',
    enabledModels: string[] = [], 
    onLog?: (msg: string) => void,
    storyInfo?: StoryInfo,
    ratioLimits?: RatioLimits
): Promise<{ results: Map<string, string>, model: string, errorType?: string, stats?: { dictLines: number, contextLines: number } }> => {
    const combined = files.map(f => f.content).join('\n');
    const relDict = optimizeDictionary(dictionary, combined), relCtx = optimizeContext(globalContext, combined);
    
    // LOGGING FILTERED DATA SIZE
    if(onLog) {
        const dictLines = relDict.split('\n').filter(l => l.trim()).length;
        const ctxLines = relCtx.split('\n').filter(l => l.trim()).length;
        onLog(`🔍 Context Filtered: Sử dụng ${dictLines} dòng từ điển và ${ctxLines} đoạn ngữ cảnh.`);
    }

    const idMap = new Map<string, string>();
    let input = "";
    files.forEach((f, i) => { const k = `FILE_${i}`; idMap.set(k, f.id); input += `\n>>>ID:${k}\n${f.content}\n`; });
    
    const instruction = `Professional Translator: Translate to Vietnamese. 
STRICTLY OBEY [DICT] provided in the prompt. If a term is in [DICT], use it.
Preserve markers >>>ID:FILE_{number}. No English output.`;

    const fullPrompt = `[DICT (MANDATORY GLOSSARY)]\n${relDict}\n[CTX]\n${relCtx}\n[PREV]\n${previousBatchContext}\n[INSTRUCT]\n${userPrompt}\n[DATA]\n${input}`;
    
    return await smartExecution(allowedModelIds, async mid => {
        const res = await getAiClient().models.generateContent({ model: mid, contents: fullPrompt, config: { systemInstruction: instruction, temperature: 0.2, maxOutputTokens: 65536, safetySettings: SAFETY_SETTINGS } });
        const results = new Map<string, string>();
        let errorType = undefined;
        
        // REGEX UPDATED: Added \b word boundary to prevent FILE_1 matching FILE_10
        const matches = [...(res.text || "").matchAll(/(?:>>>|###|\*\*>>>|###\s*)\s*ID\s*:\s*(FILE_\d+\b)(?:\*\*)?\s*[\r\n]*([\s\S]*?)(?=(?:>>>|###|\*\*>>>|###\s*)\s*ID\s*:\s*FILE_\d+\b|$)/gi)];
        matches.forEach(match => {
            const k = match[1]; 
            const c = match[2].trim();
            const realId = idMap.get(k);
            if (realId) {
                if (isEnglishContent(c)) errorType = "ENGLISH_HALLUCINATION";
                results.set(realId, formatBookStyle(c));
            }
        });
        
        if (results.size === 0 && files.length > 0) {
             return { results: new Map(), model: mid, errorType: "BATCH_ID_MISMATCH" };
        }

        if (errorType !== "ENGLISH_HALLUCINATION") {
            const bad: GlobalRepairEntry[] = [];
            results.forEach((c, id) => {
                findLinesWithForeignChars(c).forEach(bl => bad.push({ fileId: id, lineIndex: bl.index, originalLine: bl.originalLine }));
            });
            if (bad.length) {
                if (onLog) onLog(`🛠️ Phát hiện ${bad.length} dòng lỗi. Auto-fix đang chạy...`);
                const fixes = await performAggregatedRepair(bad, relDict, tier, globalContext, storyInfo, userPrompt, onLog, enabledModels);
                fixes.forEach((fm, id) => {
                    const cur = results.get(id);
                    if (cur) results.set(id, formatBookStyle(mergeFixedLines(cur, Array.from(fm.entries()).map(([idx, txt]) => ({ index: idx, text: txt })))));
                });
            }
        }
        return { results, model: mid, errorType, stats: { dictLines: relDict.split('\n').length, contextLines: relCtx.split('\n').length } };
    }, "Dịch Batch", onLog);
};

export const translateBatchStream = async (
    files: { id: string, content: string }[],
    userPrompt: string,
    dictionary: string,
    globalContext: string,
    allowedModelIds: string[], 
    previousBatchContext: string = "",
    onUpdate: (fileId: string, partialContent: string) => void,
    onLog?: (msg: string) => void,
    tier: TranslationTier = 'normal', 
    enabledModels: string[] = [],     
    storyInfo?: StoryInfo             
): Promise<{ results: Map<string, string>, model: string, errorType?: string, stats?: { dictLines: number, contextLines: number } }> => {
    const combined = files.map(f => f.content).join('\n');
    const relDict = optimizeDictionary(dictionary, combined), relCtx = optimizeContext(globalContext, combined);
    
    // LOGGING FILTERED DATA SIZE
    if(onLog) {
        const dictLines = relDict.split('\n').filter(l => l.trim()).length;
        const ctxLines = relCtx.split('\n').filter(l => l.trim()).length;
        onLog(`🔍 Context Filtered: Sử dụng ${dictLines} dòng từ điển và ${ctxLines} đoạn ngữ cảnh.`);
    }

    const idMap = new Map<string, string>();
    let input = "";
    files.forEach((f, i) => { const k = `FILE_${i}`; idMap.set(k, f.id); input += `\n>>>ID:${k}\n${f.content}\n`; });
    
    const instruction = `Professional Translator: Translate to Vietnamese. 
STRICTLY OBEY [DICT] (Mandatory Glossary). If a term is in [DICT], use it regardless of context.
CRITICAL FORMATTING RULE: You MUST output exactly ${files.length} parts.
Structure:
>>>ID:FILE_{number}
[Translated Content]
>>>ID:FILE_{next}
[Translated Content]

DO NOT SKIP ANY ID. DO NOT MERGE CONTENT. 
Output Vietnamese ONLY. No English summaries.`;

    const fullPrompt = `[DICT (MANDATORY GLOSSARY)]\n${relDict}\n[CTX]\n${relCtx}\n[PREV]\n${previousBatchContext}\n[INSTRUCT]\n${userPrompt}\n[DATA]\n${input}`;
    
    return await smartExecution(allowedModelIds, async mid => {
        const ai = getAiClient();
        const responseStream = await ai.models.generateContentStream({ 
            model: mid, 
            contents: fullPrompt, 
            config: { systemInstruction: instruction, temperature: 0.2, maxOutputTokens: 65536, safetySettings: SAFETY_SETTINGS } 
        });

        const results = new Map<string, string>();
        let currentBuffer = "";
        let fullTextAccumulator = ""; 

        // REGEX UPDATED: Added \b word boundary to prevent partial matches like FILE_1 matching FILE_10
        const SPLIT_REGEX = /(?=(?:>>>|###|\*\*>>>|###\s*|^|[\r\n]+)\s*(?:ID|FILE)\s*[:\.\-]?\s*FILE_\d+\b)/i;
        const MATCH_REGEX = /(?:>>>|###|\*\*>>>|###\s*|^|[\r\n]+)\s*(?:ID|FILE)\s*[:\.\-]?\s*(FILE_\d+\b)(?:\*\*)?\s*([\s\S]*)/i;

        for await (const chunk of responseStream) {
            const chunkText = chunk.text || "";
            currentBuffer += chunkText;
            fullTextAccumulator += chunkText;
            
            const parts = currentBuffer.split(SPLIT_REGEX);
            
            if (parts.length > 1) {
                for (let i = 0; i < parts.length - 1; i++) {
                    const part = parts[i];
                    if (!part.trim()) continue;

                    const match = part.match(MATCH_REGEX);
                    if (match) {
                        const fileKey = match[1]; 
                        const content = match[2];
                        const realId = idMap.get(fileKey);
                        if (realId) {
                            const formatted = formatBookStyle(content);
                            results.set(realId, formatted);
                            onUpdate(realId, formatted);
                        }
                    }
                }
                currentBuffer = parts[parts.length - 1];
            }
        }

        if (currentBuffer.trim()) {
             const match = currentBuffer.match(MATCH_REGEX);
             if (match) {
                const fileKey = match[1];
                const content = match[2];
                const realId = idMap.get(fileKey);
                if (realId) {
                    const formatted = formatBookStyle(content);
                    results.set(realId, formatted);
                    onUpdate(realId, formatted);
                }
             }
        }

        if (results.size < files.length) {
            if (onLog) onLog(`⚠️ [Batch Partial] Stream Parse chỉ thấy ${results.size}/${files.length} file. Đang quét lại toàn bộ (Deep Scan)...`);
            
            // REGEX UPDATED: Added \b to Global Match as well
            const GLOBAL_MATCH = /(?:>>>|###|\*\*>>>|###\s*|^|[\r\n]+)\s*(?:ID|FILE)\s*[:\.\-]?\s*(FILE_\d+\b)(?:\*\*|)?\s*([\s\S]*?)(?=(?:>>>|###|\*\*>>>|###\s*|[\r\n]+)\s*(?:ID|FILE)\s*[:\.\-]?\s*FILE_\d+\b|$)/gi;
            const matches = [...fullTextAccumulator.matchAll(GLOBAL_MATCH)];
            
            matches.forEach(m => {
                const key = m[1];
                const content = m[2];
                const realId = idMap.get(key);
                if (realId) {
                    const existing = results.get(realId);
                    if (!existing || content.length > existing.length) {
                        const formatted = formatBookStyle(content);
                        results.set(realId, formatted);
                        onUpdate(realId, formatted);
                    }
                }
            });
        }

        // --- POST-STREAM AUTO FIX LOGIC ---
        const bad: GlobalRepairEntry[] = [];
        results.forEach((c, id) => {
            findLinesWithForeignChars(c).forEach(bl => bad.push({ fileId: id, lineIndex: bl.index, originalLine: bl.originalLine }));
        });

        if (bad.length > 0) {
            if (onLog) onLog(`🛠️ [Auto-Fix] Phát hiện ${bad.length} dòng lỗi sau khi Stream. Đang sửa...`);
            
            const fixes = await performAggregatedRepair(bad, relDict, tier, globalContext, storyInfo, userPrompt, onLog, enabledModels);
            
            fixes.forEach((fm, id) => {
                const cur = results.get(id);
                if (cur) {
                    const fixedContent = formatBookStyle(mergeFixedLines(cur, Array.from(fm.entries()).map(([idx, txt]) => ({ index: idx, text: txt }))));
                    results.set(id, fixedContent);
                    onUpdate(id, fixedContent); 
                }
            });
        }

        return { 
            results, 
            model: mid, 
            stats: { dictLines: relDict.split('\n').length, contextLines: relCtx.split('\n').length } 
        };
    }, "Dịch Streaming", onLog);
};

export const repairTranslations = async (badLines: LineContext[], dictionary: string, tier: TranslationTier = 'normal', context?: string, storyInfo?: StoryInfo, promptTemplate?: string, onLog?: (msg: string) => void, enabledModels?: string[]): Promise<{ index: number; text: string }[]> => {
    const map = await repairBatch(badLines.map(bl => ({ fileId: 'temp', lineIndex: bl.index, originalLine: bl.originalLine })), dictionary, tier, context, storyInfo, promptTemplate, onLog, enabledModels);
    return Array.from(map.get('temp')?.entries() || []).map(([idx, txt]) => ({ index: idx, text: txt }));
};