
import { ModelQuota } from './types';

// Export everything from the new split files
export * from './prompts';
export * from './defaultDictionary';

// UPDATED v10.9.0: Strict RPD Limits for Free Tier
// Giới hạn RPD (Requests Per Day) được hạ thấp để QuotaManager chặn trước khi lỗi xảy ra.
export const MODEL_CONFIGS: ModelQuota[] = [
  // PRO TIER: High Intelligence
  // Gemini 3.0 Pro: Giới hạn 15 RPD
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (Mới nhất)', rpmLimit: 2, rpdLimit: 15, priority: 1, maxOutputTokens: 65536 },
  
  // Gemini 2.5 Pro: Giới hạn 10 RPD
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Ổn định)', rpmLimit: 2, rpdLimit: 10, priority: 2, maxOutputTokens: 65536 },
  
  // FLASH TIER: High Speed
  // Giới hạn 50 RPD cho mỗi model Flash để an toàn
  { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash (Turbo)', rpmLimit: 10, rpdLimit: 50, priority: 3, maxOutputTokens: 65536 },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Siêu tốc)', rpmLimit: 10, rpdLimit: 50, priority: 4, maxOutputTokens: 65536 },
  
  // IMAGE GEN
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', rpmLimit: 10, rpdLimit: 1500, priority: 5, maxOutputTokens: 8192 },
];

export const TIER_MODELS = {
    PRO_POOL: ['gemini-3-pro-preview', 'gemini-2.5-pro'], // Dùng để dịch trong Normal & Pro
    FLASH_POOL: ['gemini-3-flash-preview', 'gemini-2.5-flash'], // Dùng để dịch trong Flash & Auto-Fix
};

export const CONCURRENCY_CONFIG = { 
    FLASH: 5, // Increased to 5 for parallel processing
    NORMAL: 2, 
    PRO: 1 // Strict serial processing for Pro to avoid TPM hit
};

export const BATCH_SIZE_CONFIG = { FLASH: 10, NORMAL: 10, PRO: 10 };

// UPDATED: Batch size for repair is fixed at 50 lines to optimize context window and speed
export const REPAIR_CONFIG = { BATCH_SIZE: 50, AGGREGATE_LIMIT: 50, CONCURRENCY: 2 };

export const AVAILABLE_LANGUAGES = ['Convert thô', 'Tiếng Trung', 'Tiếng Anh', 'Tiếng Hàn', 'Tiếng Nhật'];
export const AVAILABLE_GENRES = ['Tiên Hiệp', 'Huyền Huyễn', 'Đô Thị', 'Khoa Huyễn', 'Võng Du', 'Đồng Nhân', 'Kiếm Hiệp', 'Ngôn Tình', 'Dị Giới', 'Mạt Thế', 'Ngự Thú', 'Linh Dị', 'Hệ Thống', 'Hài Hước', 'Fantasy', 'Action', 'Light Novel', 'Isekai'];
export const AVAILABLE_PERSONALITIES = ['Vô sỉ/Cợt nhả', 'Lạnh lùng/Sát phạt', 'Cẩn trọng/Vững vàng', 'Thông minh/Đa mưu'];
export const AVAILABLE_SETTINGS = ['Trung Cổ/Cổ Đại', 'Hiện đại/Đô thị', 'Tương lai/Sci-fi', 'Mạt thế/Zombie', 'Võng Du/Game', 'Phương Tây/Magic'];
export const AVAILABLE_FLOWS = ['Phàm nhân lưu', 'Vô địch lưu', 'Phế vật lưu', 'Hệ thống lưu', 'Xuyên không lưu', 'Vô hạn lưu'];