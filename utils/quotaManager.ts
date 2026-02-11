
import { ModelQuota, ModelUsage } from '../types';
import { MODEL_CONFIGS } from '../constants';

const STORAGE_KEY = 'gemini_quota_usage_v1';
const SAFETY_BUFFER_MS = 2000; // Thêm 2 giây an toàn để tránh lệch giờ Server/Client

class QuotaManager {
  private usage: Record<string, ModelUsage> = {};
  private listeners: (() => void)[] = [];
  // Store configs internally so they can be updated dynamically
  private currentConfigs: ModelQuota[] = [...MODEL_CONFIGS];
  
  // Track enabled models dynamically
  private enabledModels: Set<string> = new Set(MODEL_CONFIGS.map(m => m.id));
  
  // Internal counter for load balancing among READY models
  private rrIndex: number = 0;

  constructor() {
    this.loadUsage();
  }

  // Allow App to update configs (e.g. from user edits)
  public updateConfigs(newConfigs: ModelQuota[]) {
    this.currentConfigs = newConfigs;
    this.notifyListeners();
  }
  
  // Update enabled models from UI state
  public setEnabledModels(models: string[]) {
      this.enabledModels = new Set(models);
  }

  public isModelEnabled(modelId: string): boolean {
      return this.enabledModels.has(modelId);
  }

  public getConfigs(): ModelQuota[] {
    return this.currentConfigs;
  }

  // NEW: Expose snapshot for UI Reactivity
  public getUsageSnapshot(): Record<string, ModelUsage> {
      return { ...this.usage };
  }

  private loadUsage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.usage = JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to load quota usage", e);
    }
    
    // Initialize missing models and check for daily reset
    const today = new Date().toISOString().split('T')[0];
    
    // Use currentConfigs instead of static import
    this.currentConfigs.forEach(model => {
      if (!this.usage[model.id] || this.usage[model.id].lastResetDate !== today) {
        // Reset daily counters
        this.usage[model.id] = {
          requestsToday: 0,
          lastResetDate: today,
          recentRequests: [],
          cooldownUntil: 0,
          isDepleted: false,
          consecutiveErrors: 0
        };
      } else {
          // Ensure consecutiveErrors exists for loaded data
          if (this.usage[model.id].consecutiveErrors === undefined) {
              this.usage[model.id].consecutiveErrors = 0;
          }
      }
    });
    this.saveUsage();
  }

  private saveUsage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.usage));
      this.notifyListeners();
    } catch (e) {
      console.error("Failed to save quota usage", e);
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  public getModelUsage(modelId: string): ModelUsage {
    return this.usage[modelId];
  }

  /**
   * Check if a model is completely dead for the day (Hard Quota or Too Many Errors).
   * Does NOT check for RPM (Soft Limit).
   */
  public isModelDepleted(modelId: string): boolean {
      const usage = this.usage[modelId];
      const modelConfig = this.currentConfigs.find(m => m.id === modelId);
      if (!usage || !modelConfig) return true;
      
      // 1. Marked as depleted
      if (usage.isDepleted) return true;
      
      // 2. Daily limit reached
      if (usage.requestsToday >= modelConfig.rpdLimit) return true;
      
      return false;
  }

  /**
   * PRECISE SLIDING WINDOW CALCULATION
   * Tính toán chính xác thời gian phải chờ dựa trên lịch sử request.
   */
  public getWaitTimeForModel(modelId: string): number {
      const usage = this.usage[modelId];
      const modelConfig = this.currentConfigs.find(m => m.id === modelId);
      
      if (!usage || !modelConfig) return Infinity;
      if (this.isModelDepleted(modelId)) return Infinity;

      const now = Date.now();
      let waitTime = 0;

      // 1. Check Explicit Cooldown (Hard 429 from Google)
      if (usage.cooldownUntil > now) {
          waitTime = Math.max(waitTime, usage.cooldownUntil - now);
      }

      // 2. Check RPM Sliding Window (Strict Local Limit)
      // Lọc các request trong vòng 60s + buffer
      const windowSize = 60000; 
      const recent = usage.recentRequests.filter(t => now - t < windowSize);
      
      if (recent.length >= modelConfig.rpmLimit) {
          // Sắp xếp tăng dần: [T1, T2, T3...] (T1 là cũ nhất)
          const sorted = recent.sort((a, b) => a - b);
          
          // Logic: Nếu Limit là 2. Đã có 2 req: [T1, T2].
          // Req thứ 3 muốn vào thì phải đợi thằng T1 hết hạn (T1 ra khỏi cửa sổ 60s).
          // Index của thằng cần "expire" = (Length - Limit)
          // Ví dụ: Có 2 req, Limit 2. Index = 2 - 2 = 0 (Là thằng T1).
          const blockingRequestTime = sorted[recent.length - modelConfig.rpmLimit];
          
          if (blockingRequestTime) {
              const timeUntilExpiry = (blockingRequestTime + windowSize) - now;
              if (timeUntilExpiry > 0) {
                  // Thêm SAFETY_BUFFER_MS để chắc chắn Google đã reset counter bên server
                  waitTime = Math.max(waitTime, timeUntilExpiry + SAFETY_BUFFER_MS);
              }
          }
      }

      return waitTime;
  }

  /**
   * Check if a model is currently available for use (WaitTime == 0).
   */
  public isModelAvailable(modelId: string): boolean {
    // 0. Check Enabled State (UI Toggle)
    if (!this.isModelEnabled(modelId)) return false;

    const usage = this.usage[modelId];
    if (!usage) return false;

    // 1. Check Hard Stop (Depleted)
    if (this.isModelDepleted(modelId)) return false;

    // 2. Check Calculated Wait Time
    return this.getWaitTimeForModel(modelId) === 0;
  }

  /**
   * SMART LOAD BALANCER
   * Selects the BEST model from a list of candidates.
   */
  public getBestModelForTask(candidates: string[]): string | null {
      // 0. Filter by Enabled (User Toggle)
      const enabledCandidates = candidates.filter(id => this.isModelEnabled(id));
      if (enabledCandidates.length === 0) return null;

      // 1. Filter out completely dead models (Quota Exceeded / Depleted)
      const liveCandidates = enabledCandidates.filter(id => !this.isModelDepleted(id));
      
      if (liveCandidates.length === 0) return null;

      // 2. Find models that are INSTANTLY ready (Wait Time = 0)
      const readyModels = liveCandidates.filter(id => this.isModelAvailable(id));

      if (readyModels.length > 0) {
          // Round Robin among READY models
          const selected = readyModels[this.rrIndex % readyModels.length];
          this.rrIndex++;
          return selected;
      }

      // 3. If no one is ready, find the one with shortest wait time
      // This allows the queue system to know which one will be ready soonest
      const waitTimes = liveCandidates.map(id => ({ id, time: this.getWaitTimeForModel(id) }));
      waitTimes.sort((a, b) => a.time - b.time);
      
      return waitTimes[0].id;
  }

  public hasAvailableModels(modelIds: string[]): boolean {
      // Check if ANY model is technically alive (not depleted), 
      // even if they have a wait time.
      return modelIds.some(id => !this.isModelDepleted(id) && this.isModelEnabled(id));
  }

  public recordRequest(modelId: string) {
    const usage = this.usage[modelId];
    if (usage) {
      usage.requestsToday++;
      usage.recentRequests.push(Date.now());
      usage.consecutiveErrors = 0; 
      
      // Cleanup old entries (> 65s to be safe)
      const now = Date.now();
      usage.recentRequests = usage.recentRequests.filter(t => now - t < 65000);
      
      this.saveUsage();
    }
  }

  public recordError(modelId: string) {
      const usage = this.usage[modelId];
      if (usage) {
          usage.consecutiveErrors = (usage.consecutiveErrors || 0) + 1;
          if (usage.consecutiveErrors >= 5) { 
              this.markAsDepleted(modelId);
              console.warn(`Model ${modelId} marked as DEPLETED after 5 consecutive errors.`);
          } else {
              this.saveUsage();
          }
      }
  }

  public recordRateLimit(modelId: string, duration: number = 60000) {
    const usage = this.usage[modelId];
    if (usage) {
      // Explicit cooldown from Server response (Hard 429)
      usage.cooldownUntil = Date.now() + duration; 
      this.saveUsage();
    }
  }

  public markAsDepleted(modelId: string) {
      const usage = this.usage[modelId];
      if (usage) {
          usage.isDepleted = true;
          // Cooldown 1 hour for depleted
          usage.cooldownUntil = Date.now() + 3600000;
          this.saveUsage();
      }
  }

  public reset() {
    this.usage = {};
    localStorage.removeItem(STORAGE_KEY);
    this.loadUsage(); 
    this.notifyListeners();
  }

  public resetDailyQuotas() {
    const today = new Date().toISOString().split('T')[0];
    for (const key in this.usage) {
        this.usage[key] = {
            ...this.usage[key],
            requestsToday: 0,
            isDepleted: false,
            lastResetDate: today,
            consecutiveErrors: 0,
            cooldownUntil: 0,
            recentRequests: [] // Reset recent history too
        };
    }
    this.saveUsage();
  }
}

export const quotaManager = new QuotaManager();
