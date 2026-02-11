
import { getAiClient, smartExecution } from '../api/gemini';
import { StoryInfo, FileItem } from '../../types';
import { cleanRepetitiveContent } from '../../utils/textHelpers';
import { replacePromptVariables } from '../../prompts';
import { AUTO_ANALYZE_PROMPT, GLOSSARY_ANALYSIS_PROMPT, NAME_ANALYSIS_PROMPT, MERGE_CONTEXT_PROMPT } from '../../constants';

export const optimizePrompt = async (promptTemplate: string, storyInfo: StoryInfo, context: string = "", dictionary: string = "", additionalRules: string = ""): Promise<string> => {
  const ai = getAiClient();
  const candidates = ['gemini-3-pro-preview', 'gemini-2.5-pro'];
  const filledTemplate = replacePromptVariables(promptTemplate, storyInfo);
  const isGameOrWestern = storyInfo.genres.some(g => ['Light Novel', 'Isekai', 'Fantasy', 'Đồng Nhân', 'Võng Du', 'Game'].includes(g)) || storyInfo.worldSetting.some(s => ['Phương Tây/Magic', 'Võng Du/Game'].includes(s));
  const instruction = `Bạn là một Kỹ sư Prompt và Chuyên gia Ngôn ngữ học Văn học (Series Architect).
NHIỆM VỤ: Tái thiết kế Prompt dịch thuật để nó trở thành chỉ thị hoàn hảo cho bộ truyện cụ thể này.

DỰA TRÊN NGỮ CẢNH (Series Bible) ĐƯỢC CUNG CẤP:
1. **DEEP CONTEXT ANALYSIS:** Đọc kỹ Series Bible để hiểu rõ tông giọng (Tone), phong cách (Style), và mối quan hệ nhân vật.
2. **RE-ENGINEER PERSONA:** Thay đổi "I. ĐỊNH DANH VÀ VAI TRÒ" để AI Translator nhập vai đúng linh hồn truyện. Nếu truyện hài hước, AI phải dí dỏm. Nếu truyện u tối, AI phải nghiêm túc.
3. **ORIGIN RESTORATION PROTOCOL:** ${isGameOrWestern ? `Truyện bối cảnh phương tây/game. QUY TẮC: 'KHÔNG HÁN VIỆT HÓA TÊN TIẾNG ANH'. (Goblin -> Goblin/Yêu tinh, Cấm: Ca Bố Lâm).` : `Truyện phong cách Trung Quốc. Duy trì Hán Việt chuẩn.`}
4. **RAW-TO-VIET MAPPING:** Tạo mục "V. QUY TẮC CHUYỂN ĐỔI". Liệt kê các cặp: "{Ký tự gốc} -> {Bản dịch chuẩn}" dựa trên dữ liệu tham khảo.
5. **INTEGRATE RULES:** Lồng ghép khéo léo [QUY TẮC NGƯỜI DÙNG] vào Prompt.

ĐẦU VÀO:
- Tên: ${storyInfo.title} | Thể loại: ${storyInfo.genres.join(', ')}
[QUY TẮC NGƯỜI DÙNG BẮT BUỘC]
${additionalRules}

[DỮ LIỆU THAM KHẢO (SERIES BIBLE)]
${dictionary.substring(0, 20000)}
${context.substring(0, 50000)}

[PROMPT GỐC CẦN TỐI ƯU]
${filledTemplate}`;

  try {
      return await smartExecution(candidates, async (modelId) => {
        const response = await ai.models.generateContent({
          model: modelId,
          contents: "Thực hiện kiến trúc lại Prompt dựa trên Series Bible.",
          config: { systemInstruction: instruction, temperature: 0.7, maxOutputTokens: 65536 },
        });
        return response.text?.trim() || filledTemplate;
      }, "Optimize Prompt");
  } catch (e) {
      return filledTemplate;
  }
};

export const analyzeStoryContext = async (files: FileItem[], storyInfo: StoryInfo, promptTemplate: string = "", dictionary: string = "", useSearch: boolean = false, additionalRules: string = "", sampling: { start: number, middle: number, end: number } = { start: 100, middle: 100, end: 100 }): Promise<string> => {
    const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    let filesToAnalyze: FileItem[] = [];
    const totalFiles = sortedFiles.length;
    const requiredTotal = sampling.start + sampling.middle + sampling.end;
    
    if (totalFiles <= requiredTotal) {
        filesToAnalyze = sortedFiles;
    } else {
        const startBatch = sortedFiles.slice(0, sampling.start);
        const endBatch = sortedFiles.slice(-sampling.end);
        const midIndex = Math.floor(totalFiles / 2);
        const midStart = Math.max(sampling.start, midIndex - Math.floor(sampling.middle / 2));
        const midEnd = Math.min(totalFiles - sampling.end, midStart + sampling.middle);
        const middleBatch = sortedFiles.slice(midStart, midEnd);
        const uniqueMap = new Map<string, FileItem>();
        [...startBatch, ...middleBatch, ...endBatch].forEach(f => uniqueMap.set(f.id, f));
        filesToAnalyze = Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }

    const CHUNK_SIZE = 800000; 
    const allContent = filesToAnalyze.map(f => f.content).join('\n');
    const chunks = [];
    for (let i = 0; i < allContent.length; i += CHUNK_SIZE) {
        chunks.push(allContent.substring(i, i + CHUNK_SIZE));
    }

    const results: string[] = [];
    const CONCURRENCY = 2;
    let completedChunks = 0;
    let interruptedInfo = "";

    try {
        for (let i = 0; i < chunks.length; i += CONCURRENCY) {
            const batch = chunks.slice(i, i + CONCURRENCY);
            const batchPromises = batch.map((chunk, idx) => {
                const modelIndex = i + idx;
                const primaryModel = modelIndex % 2 === 0 ? 'gemini-3-pro-preview' : 'gemini-2.5-pro';
                const candidates = [primaryModel, primaryModel === 'gemini-2.5-pro' ? 'gemini-3-pro-preview' : 'gemini-2.5-pro'];
                
                return analyzeContextBatch(chunk, storyInfo, dictionary, useSearch, candidates, additionalRules).catch(e => "");
            });
            const batchResults = await Promise.all(batchPromises);
            const validResults = batchResults.filter(r => r.length > 50);
            results.push(...validResults);
            completedChunks += validResults.length;
            
            if (i + CONCURRENCY < chunks.length) await new Promise(r => setTimeout(r, 1000));
        }
    } catch (e: any) {
        console.warn("Analysis interrupted:", e);
        interruptedInfo = `\n\n[HỆ THỐNG: Phân tích tạm dừng tại ${Math.round((completedChunks/chunks.length)*100)}% dữ liệu do hết Quota/Lỗi. Đã lưu phần hiện có.]`;
    }

    if (results.length === 0) return "Chưa phân tích được dữ liệu do lỗi kết nối/quota.";
    const finalMerge = await mergeContexts(results, storyInfo);
    return finalMerge + interruptedInfo;
};

export const analyzeContextBatch = async (contentChunk: string, storyInfo: StoryInfo, existingDictionary: string, useSearch: boolean = false, forcedCandidates?: string[], additionalRules: string = ""): Promise<string> => {
    const ai = getAiClient();
    const candidates = forcedCandidates || ['gemini-3-pro-preview', 'gemini-2.5-pro'];
    const langs = storyInfo.languages.join(' ').toLowerCase();
    let sourceInstruction = "";
    
    if (langs.includes('trung') || langs.includes('chinese') || langs.includes('raw') || 
        langs.includes('anh') || langs.includes('english') || 
        langs.includes('nhật') || langs.includes('japan') || 
        langs.includes('hàn') || langs.includes('korea')) {
        sourceInstruction = "NGUỒN: RAW (NGOẠI NGỮ). BẮT BUỘC GIỮ NGUYÊN MẶT CHỮ GỐC Ở VẾ TRÁI (KEY). TUYỆT ĐỐI KHÔNG DỊCH VẾ TRÁI.";
    } else {
        sourceInstruction = "NGUỒN: CONVERT/TIẾNG VIỆT. BẮT BUỘC GIỮ TỪ GỐC TRONG VĂN BẢN (DÙ SAI CHÍNH TẢ) Ở VẾ TRÁI.";
    }

    const metaHeader = `[METADATA]\n- Tên: ${storyInfo.title}\n- Thể loại: ${storyInfo.genres.join(', ')}\n- Ngôn ngữ truyện: ${storyInfo.languages.join(', ')}\n- CHẾ ĐỘ: ${sourceInstruction}`;
    
    return await smartExecution(candidates, async (modelId) => {
            const config: any = { systemInstruction: GLOSSARY_ANALYSIS_PROMPT, temperature: 0.2, maxOutputTokens: 65536 };
            if (useSearch && modelId === 'gemini-3-pro-preview') config.tools = [{googleSearch: {}}];
            const response = await ai.models.generateContent({ model: modelId, contents: `${metaHeader}\n${contentChunk}`, config });
            return cleanRepetitiveContent(response.text || "");
        }, "Phân Tích Ngữ Cảnh"
    );
};

export const mergeContexts = async (contexts: string[], storyInfo: StoryInfo): Promise<string> => {
    if (contexts.length === 0) return "";
    if (contexts.length === 1) return cleanRepetitiveContent(contexts[0]);
    
    if (contexts.length > 5) {
        const half = Math.ceil(contexts.length / 2);
        const left = await mergeContexts(contexts.slice(0, half), storyInfo);
        const right = await mergeContexts(contexts.slice(half), storyInfo);
        return mergeContexts([left, right], storyInfo);
    }

    const mergeCandidates = ['gemini-3-pro-preview']; 
    
    try {
        return await smartExecution(mergeCandidates, async (modelId) => {
                const response = await getAiClient().models.generateContent({
                    model: modelId,
                    contents: `[DỮ LIỆU ĐẦU VÀO - GỒM ${contexts.length} PHẦN]\n${contexts.join("\n\n=== HẾT PHẦN ===\n\n")}`,
                    config: { systemInstruction: MERGE_CONTEXT_PROMPT, temperature: 0.2, maxOutputTokens: 65536 }
                });
                return cleanRepetitiveContent(response.text || contexts[0]);
            }, "Hợp Nhất Ngữ Cảnh (Tích Lũy)"
        );
    } catch (e: any) {
        console.warn("Merge failed (Quota/Network), falling back to concatenation.", e);
        return contexts.join("\n\n=== [HỆ THỐNG: KHÔNG THỂ HỢP NHẤT DO HẾT QUOTA - DỮ LIU THÔ] ===\n\n");
    }
};

export const analyzeNameBatch = async (contentChunk: string, storyInfo: StoryInfo, mode: 'only_char' | 'full', useSearch: boolean = false, additionalRules: string = "", forcedCandidates?: string[]): Promise<string> => {
    const ai = getAiClient();
    const candidates = forcedCandidates || (useSearch ? ['gemini-3-pro-preview'] : ['gemini-3-pro-preview', 'gemini-2.5-pro']);
    const langs = storyInfo.languages.join(' ').toLowerCase();
    let sourceInstruction = "";
    
    if (langs.includes('trung') || langs.includes('chinese') || langs.includes('raw') || 
        langs.includes('anh') || langs.includes('english') || 
        langs.includes('nhật') || langs.includes('japan') || 
        langs.includes('hàn') || langs.includes('korea')) {
        sourceInstruction = "NGUỒN: RAW (NGOẠI NGỮ). BẮT BUỘC GIỮ NGUYÊN MẶT CHỮ GỐC Ở VẾ TRÁI (KEY). TUYỆT ĐỐI KHÔNG DỊCH VẾ TRÁI.";
    } else {
        sourceInstruction = "NGUỒN: CONVERT/TIẾNG VIỆT. BẮT BUỘC GIỮ TỪ GỐC TRONG VĂN BẢN (DÙ SAI CHÍNH TẢ) Ở VẾ TRÁI.";
    }

    const metaHeader = `[METADATA]\nTên: ${storyInfo.title}\nNgôn ngữ truyện: ${storyInfo.languages.join(', ')}\nYêu cầu: ${mode === 'only_char' ? 'Chỉ nhân vật' : 'Toàn bộ tên riêng'}.\nCHẾ ĐỘ: ${sourceInstruction}`;
    
    return await smartExecution(candidates, async (modelId) => {
             const config: any = { systemInstruction: NAME_ANALYSIS_PROMPT, temperature: 0.1, maxOutputTokens: 65536 };
             if (useSearch && modelId === 'gemini-3-pro-preview') config.tools = [{googleSearch: {}}];
             const res = await ai.models.generateContent({ model: modelId, contents: `${metaHeader}\n${contentChunk}`, config });
             return cleanRepetitiveContent(res.text || "");
        }, "Phân Tích Tên Riêng"
    );
};

export const generateCoverImage = async (imagePrompt: string): Promise<File | null> => {
    const modelId = 'gemini-2.5-flash-image';
    // Append strict "No Text" instructions to the prompt
    const enhancedPrompt = `${imagePrompt}, masterpiece, best quality, ultra-detailed, no text, textless, no typography, no words, no signature, clean art, high resolution, 8k`;
    
    try {
        return await smartExecution([modelId], async (mid) => {
            const response = await getAiClient().models.generateContent({
                model: mid,
                contents: { parts: [{ text: enhancedPrompt }] },
                config: { imageConfig: { aspectRatio: "3:4" } }
            });
            const part = response.candidates?.[0].content.parts.find(p => p.inlineData);
            if (part?.inlineData?.data) {
                const blob = new Blob([new Uint8Array(atob(part.inlineData.data).split("").map(c => c.charCodeAt(0)))], { type: part.inlineData.mimeType || 'image/png' });
                return new File([blob], "cover.png", { type: blob.type });
            }
            return null;
        }, "Tạo Ảnh Bìa");
    } catch (e) { return null; }
};

export const createCoverPrompt = async (storyInfo: StoryInfo): Promise<string> => {
    try {
        const res = await getAiClient().models.generateContent({ 
            model: 'gemini-3-flash-preview', 
            contents: `Title: ${storyInfo.title}, Genre: ${storyInfo.genres.join(',')}. Create detailed English book cover prompt description. DO NOT include any text or title in the description. Just visual elements. Focus on the scene, characters, and atmosphere.`, 
            config: { maxOutputTokens: 1000 } 
        });
        return res.text?.trim() || "Fantasy book cover";
    } catch (e) { return "Fantasy book cover"; }
};

export const autoAnalyzeStory = async (files: FileItem[], onProgress: (msg: string) => void, skipCover: boolean = false): Promise<{ info: any, cover: File | null, imagePrompt: string }> => {
    onProgress("Đang lấy mẫu (150 đầu, 150 giữa, 150 cuối)...");
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    let sample = sorted;
    
    // Sampling 150 head, 150 mid, 150 tail
    const SAMPLE_SIZE = 150;
    if (sorted.length > SAMPLE_SIZE * 3) {
        const start = sorted.slice(0, SAMPLE_SIZE);
        const end = sorted.slice(-SAMPLE_SIZE);
        const midIdx = Math.floor(sorted.length / 2);
        const halfMid = Math.floor(SAMPLE_SIZE / 2);
        const middle = sorted.slice(midIdx - halfMid, midIdx + halfMid);
        
        // Remove duplicates if any overlap
        const uniqueMap = new Map();
        [...start, ...middle, ...end].forEach(f => uniqueMap.set(f.id, f));
        sample = Array.from(uniqueMap.values());
    }
    
    const content = sample.map(f => f.content).join('\n');
    const chunks = [];
    const MAX_CHUNK = 250000; // Limit to 250k chars per chunk
    for (let i = 0; i < content.length; i += MAX_CHUNK) chunks.push(content.substring(i, i + MAX_CHUNK));

    onProgress(`Đang phân tích ${chunks.length} phần (Batch 5 luồng)...`);
    const results: any[] = [];
    const CONCURRENCY = 5; // Updated to 5 threads
    
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const batch = chunks.slice(i, i + CONCURRENCY);
        const batchPromises = batch.map((chunk, idx) => {
            const globalIndex = i + idx;
            // Alternate models: Even -> 3.0 Flash, Odd -> 2.5 Flash
            const primaryModel = globalIndex % 2 === 0 ? 'gemini-3-flash-preview' : 'gemini-2.5-flash';
            
            // Define Task Logic Wrapper to allow retry with different model
            const performAnalysis = async (mid: string) => {
                const res = await getAiClient().models.generateContent({ 
                    model: mid, 
                    contents: chunk + "\n" + AUTO_ANALYZE_PROMPT, 
                    config: { responseMimeType: 'application/json' } 
                });
                return res.text ? JSON.parse(res.text) : null;
            };

            // Forced execution logic
            // 1. Try Primary
            return smartExecution([primaryModel], performAnalysis)
                .catch(async () => {
                    // 2. If Primary fails, Try Backup
                    const backupModel = primaryModel === 'gemini-2.5-flash' ? 'gemini-3-flash-preview' : 'gemini-2.5-flash';
                    console.warn(`Model ${primaryModel} failed in analyzer, switching to ${backupModel}`);
                    return smartExecution([backupModel], performAnalysis);
                })
                .catch(e => null); // Finally fail if both fail
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(r => r !== null));
        
        if (i + CONCURRENCY < chunks.length) await new Promise(r => setTimeout(r, 1000));
    }

    if (results.length === 0) throw new Error("Không thể phân tích dữ liệu.");
    
    onProgress("Đang tổng hợp thông tin (Gemini 3.0 Flash)...");
    const synthesis = await smartExecution(['gemini-3-flash-preview'], async mid => {
        const res = await getAiClient().models.generateContent({ 
            model: mid, 
            contents: JSON.stringify(results) + "\n\nNHIỆM VỤ: Hợp nhất các kết quả JSON thành bản duy nhất chính xác nhất." + AUTO_ANALYZE_PROMPT, 
            config: { responseMimeType: 'application/json' } 
        });
        return res.text ? JSON.parse(res.text) : results[0];
    });

    let cover = null;
    const prompt = synthesis.image_prompt;
    
    // STRICT CHECK: Skip cover generation if skipCover is true
    if (!skipCover && prompt) { 
        onProgress("Đang vẽ ảnh bìa..."); 
        cover = await generateCoverImage(prompt); 
    } else if (skipCover) {
        onProgress("Đã có ảnh bìa, bỏ qua bước vẽ.");
    }
    
    return { info: synthesis, cover, imagePrompt: prompt };
};
