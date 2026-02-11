
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { quotaManager } from '../../utils/quotaManager';
import { apiKeyPool, PoolKey } from '../../utils/apiKeyPool';
import { MODEL_CONFIGS } from '../../constants';

export const getAiClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("Không tìm thấy API Key. Vui lòng kiểm tra biến môi trường.");
    }
    // Track account key for per-key request counting
    currentKeyInUse = apiKeyPool.getAccountKey();
    apiKeyPool.setActiveKey(currentKeyInUse);
    return new GoogleGenAI({ apiKey });
};

// Track current key in use for per-key request counting
let currentKeyInUse: PoolKey | null = null;

const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export { SAFETY_SETTINGS };

export const testModelConnection = async (modelId: string): Promise<{ success: boolean; message: string }> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: "Hi",
            config: { maxOutputTokens: 1, safetySettings: SAFETY_SETTINGS }
        });
        return response ? { success: true, message: "Kết nối thành công! Model sẵn sàng." } : { success: false, message: "Không có phản hồi." };
    } catch (error: any) {
        const msg = (error.message || error.toString()).toLowerCase();
        if (msg.includes("resource exhausted") || msg.includes("quota")) {
            quotaManager.markAsDepleted(modelId);
            return { success: false, message: "Model đã hết Quota (Resource Exhausted)." };
        }
        return { success: false, message: error.message };
    }
};

let rotationCounter = 0;

/**
 * SMART EXECUTION ENGINE v2.4 (High Precision RPM Handling)
 * Engine will now sleep for the EXACT duration required by the sliding window.
 */
export const smartExecution = async <T>(
    candidateModels: string[],
    operation: (modelId: string) => Promise<T>,
    taskName: string = "Tác vụ",
    onLog?: (msg: string) => void
): Promise<T> => {
    const validCandidates = candidateModels.filter(id => MODEL_CONFIGS.some(c => c.id === id));

    if (validCandidates.length === 0) {
        throw new Error(`[${taskName}] Không có model nào khả dụng. Vui lòng kiểm tra lại cài đặt.`);
    }

    while (true) {
        // 0. DYNAMIC CHECK: Filter candidates that are currently enabled in UI
        const currentEnabledCandidates = validCandidates.filter(id => quotaManager.isModelEnabled(id));

        if (currentEnabledCandidates.length === 0) {
            throw new Error(`[${taskName}] Đã dừng: Model đang dùng đã bị TẮT bởi người dùng.`);
        }

        // 1. Phân tích trạng thái của các candidates ĐANG BẬT
        const statusList = currentEnabledCandidates.map(id => {
            const usage = quotaManager.getModelUsage(id);
            const waitTime = quotaManager.getWaitTimeForModel(id);
            return { id, usage, waitTime };
        });

        // 2. Lọc bỏ các model đã "Chết" (Hết quota ngày hoặc lỗi liên tiếp)
        const aliveModels = statusList.filter(s => !s.usage?.isDepleted);

        if (aliveModels.length === 0) {
            throw new Error(`[${taskName}] Tất cả model khả dụng đã hết Quota (Resource Exhausted) hoặc bị lỗi liên tiếp.`);
        }

        // 3. Tìm các model "Sẵn sàng" (Wait time = 0)
        const readyModels = aliveModels.filter(s => s.waitTime === 0);

        if (readyModels.length > 0) {
            // --- CÓ MODEL SẴN SÀNG ---
            // Chọn model theo vòng tròn (Round Robin) để chia tải
            const selected = readyModels[rotationCounter % readyModels.length];
            rotationCounter++;

            try {
                if (onLog) onLog(`🚀 [${taskName}] Đang chạy trên model: ${selected.id}...`);
                const result = await operation(selected.id);

                // Thành công: Ghi nhận request & reset lỗi
                quotaManager.recordRequest(selected.id);
                // Also record per-key per-model success for API Modal sync
                if (currentKeyInUse) {
                    apiKeyPool.recordSuccess(currentKeyInUse.key, selected.id);
                }
                return result;
            } catch (error: any) {
                // 1. EXTRACT DEEP ERROR INFO (Sâu hơn để bắt lỗi Quota)
                let msg = (error.message || error.toString()).toLowerCase();

                if (error.statusText) msg += " " + error.statusText.toLowerCase();
                if (error.response) {
                    try { const deepMsg = JSON.stringify(error.response).toLowerCase(); msg += " " + deepMsg; } catch (e) { /* ignore */ }
                }

                // 2. STRICT CLASSIFICATION
                const isHardQuota = msg.includes("resource exhausted") ||
                    msg.includes("quota exceeded") ||
                    msg.includes("user has exceeded quota") ||
                    msg.includes("quota_exceeded") ||
                    msg.includes("limit exceeded") ||
                    (error.status === 429 && (msg.includes("quota") || msg.includes("exhausted")));

                const isRateLimit = !isHardQuota && (
                    error.status === 429 ||
                    msg.includes('429') ||
                    msg.includes('too many requests') ||
                    msg.includes('rate limit')
                );

                if (isHardQuota) {
                    quotaManager.markAsDepleted(selected.id);
                    if (onLog) onLog(`⛔ Model ${selected.id} báo hết Quota (Hard Limit). Chuyển model khác...`);
                } else if (isRateLimit) {
                    // Nếu dính 429 mềm, phạt 60s
                    quotaManager.recordRateLimit(selected.id, 60000);
                    if (onLog) onLog(`⏳ Model ${selected.id} quá tải (429). Tạm nghỉ 60s...`);
                } else if (msg.includes('503') || msg.includes('overloaded') || msg.includes('network') || msg.includes('fetch')) {
                    if (onLog) onLog(`⚠️ Lỗi mạng/Server (${selected.id}). Thử lại sau 3s...`);
                    await new Promise(r => setTimeout(r, 3000));
                } else {
                    quotaManager.recordError(selected.id);
                    if (onLog) onLog(`❌ Lỗi model ${selected.id}: ${msg.substring(0, 80)}... (Thử lại)`);
                }
                // Loop continues to try next model or wait
            }
        } else {
            // --- TẤT CẢ ĐỀU BẬN (FULL RPM) ---
            // Tìm thời gian chờ ngắn nhất của các model còn sống
            const minWaitTime = Math.min(...aliveModels.map(s => s.waitTime));

            // Wait time đã bao gồm Safety Buffer ở QuotaManager, nhưng ta thêm chút xíu ở đây để chắc chắn
            const actualWait = minWaitTime > 0 ? minWaitTime : 1000;
            const waitSeconds = (actualWait / 1000).toFixed(1);

            if (onLog) onLog(`💤 Tất cả Model đang hồi phục RPM (2 RPM Limit). Chờ ${waitSeconds}s...`);

            // NGỦ ĐÔNG CHÍNH XÁC: Chờ đúng thời gian cần thiết để slot tiếp theo mở ra
            await new Promise(resolve => setTimeout(resolve, actualWait));
        }
    }
};
