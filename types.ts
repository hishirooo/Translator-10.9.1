
export enum FileStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  REPAIRING = 'REPAIRING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export type TranslationTier = 'flash' | 'normal' | 'pro';

export interface BatchLimits {
    latin: { v3: number; v25: number; maxTotalChars: number }; // Tiếng Việt, Convert
    complex: { v3: number; v25: number; maxTotalChars: number }; // Raw, English, CJK
}

export interface RatioLimits {
    vn: { min: number; max: number };   // Vietnamese / Convert
    en: { min: number; max: number };   // English / Western
    krjp: { min: number; max: number }; // Korea / Japan
    cn: { min: number; max: number };   // Chinese
}

export interface FileItem {
  id: string;
  name: string;
  content: string;
  translatedContent: string | null;
  status: FileStatus;
  errorMessage?: string;
  retryCount: number;
  originalCharCount: number;
  remainingRawCharCount: number;
  usedModel?: string; // Track which model translated this file
  processingDuration?: number; // Time taken to process in milliseconds
}

export interface ProcessingStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  processing: number;
}

export interface ContextPreset {
  id: string;
  name: string;
  content: string;
}

export interface StoryInfo {
  title: string;
  author: string;
  languages: string[]; // Multi-select support
  genres: string[];
  // New Fields
  mcPersonality: string[]; // Tính cách main (Vô sỉ, Cẩn trọng...)
  worldSetting: string[];  // Bối cảnh (Mạt thế, Hiện đại...)
  sectFlow: string[];      // Lưu phái (Phàm nhân lưu, Vô địch lưu...)
  contextNotes?: string; 
  summary?: string; // Tóm tắt cốt truyện (New v9.0)
  imagePrompt?: string; // Lưu prompt tạo ảnh để tái sử dụng hoặc tham khảo
  additionalRules?: string; // Quy tắc bổ sung từ người dùng (New v10.1)
}

export interface ModelQuota {
  id: string;
  name: string;
  rpmLimit: number; // Requests Per Minute
  rpdLimit: number; // Requests Per Day
  priority: number; // 1 is highest
  maxOutputTokens: number; // Maximum output tokens per request
}

export interface ModelUsage {
  requestsToday: number; // Count for today
  lastResetDate: string; // YYYY-MM-DD
  recentRequests: number[]; // Timestamps for RPM calculation
  cooldownUntil: number; // Timestamp when model is available again (0 if ready)
  isDepleted: boolean; // True if daily limit reached
  consecutiveErrors: number; // Track consecutive failures (New)
}

// --- SHARED UI TYPES ---
export interface Toast { 
    id: string; 
    message: string; 
    type: 'success' | 'error' | 'info' | 'warning'; 
}

export interface LogEntry { 
    id: string; 
    timestamp: Date; 
    message: string; 
    type: 'success' | 'error' | 'info'; 
}

export interface AutomationConfig {
    steps: number[];
    additionalRules: string;
    tier: TranslationTier;
}

export interface GlobalRepairEntry { 
    fileId: string; 
    lineIndex: number; 
    originalLine: string; 
}
