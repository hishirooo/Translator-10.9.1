
/**
 * API Key Pool Manager
 * Quản lý nhiều API keys với ưu tiên Account Key
 */

export interface PoolKey {
    id: string;              // Unique ID: "account" | "pool_1", "pool_2"...
    key: string;
    label: string;           // Display name: "🔑 Account (.env)" | "🌐 Account (AI Studio)" | "Pool #1"...
    isAccountKey: boolean;
    rateLimitedUntil: number; // timestamp khi hết rate limit
    requestCount: number;
    lastUsed: number;
    errorCount: number;
    // Computed status for UI
    readonly status?: 'Active' | 'RateLimited' | 'Depleted';
    readonly isActive?: boolean; // Currently being used for requests
}

interface PoolState {
    accountKey: string | null;
    poolKeys: PoolKey[];
}

const STORAGE_KEY = 'api_key_pool_v1';
const RATE_LIMIT_DURATION = 60000; // 60 seconds default

class ApiKeyPool {
    private state: PoolState = {
        accountKey: null,
        poolKeys: []
    };

    // Track which key is currently in use (for UI highlight)
    private activeKeyId: string | null = null;

    // Detect if running on local (.env.local) or AI Studio
    public readonly isLocal: boolean;

    constructor() {
        // Detect environment: in browser, if VITE_* vars exist, it's likely local dev
        // AI Studio injects key directly without VITE_ prefix
        const hasViteKey = !!(import.meta as any).env?.VITE_GEMINI_API_KEY
            || !!(import.meta as any).env?.VITE_API_KEY;
        const hasPlainKey = !!(import.meta as any).env?.GEMINI_API_KEY
            || !!(import.meta as any).env?.API_KEY;

        // Local = has VITE_ prefixed key (from .env.local)
        // AI Studio = has plain key without VITE_ prefix
        this.isLocal = hasViteKey;

        this.loadFromStorage();
        this.initAccountKey();
    }

    private initAccountKey() {
        // Check environment variables in order of priority
        // AI Studio / Vite injects key via these variables
        const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY
            || (import.meta as any).env?.GEMINI_API_KEY
            || (import.meta as any).env?.API_KEY
            || (import.meta as any).env?.VITE_API_KEY
            || (typeof process !== 'undefined' ? (process as any).env?.API_KEY : undefined);

        if (envKey && envKey.length > 10) {
            this.state.accountKey = envKey;

            // Determine label based on environment
            const accountLabel = this.isLocal ? '🔑 Account (.env)' : '🌐 Account (AI Studio)';
            console.log(`[ApiKeyPool] ✅ Account key loaded from ${this.isLocal ? 'local .env' : 'AI Studio'}`);

            // Also add to poolKeys so it shows in the UI modal
            // Check if already exists (from previous storage)
            const existingAccount = this.state.poolKeys.find(k => k.isAccountKey);
            if (!existingAccount) {
                this.state.poolKeys.unshift({
                    id: 'account',
                    key: envKey,
                    label: accountLabel,
                    isAccountKey: true,
                    rateLimitedUntil: 0,
                    requestCount: 0,
                    lastUsed: 0,
                    errorCount: 0
                });
            } else {
                // Update key if changed
                existingAccount.key = envKey;
            }
        } else {
            console.log('[ApiKeyPool] ℹ️ No env key found, using Pool Keys only');
            // Remove any stale account key from pool
            this.state.poolKeys = this.state.poolKeys.filter(k => !k.isAccountKey);
        }
    }

    private loadFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                this.state.poolKeys = data.poolKeys || [];
                // Reset rate limits nếu đã hết hạn
                const now = Date.now();
                this.state.poolKeys.forEach(k => {
                    if (k.rateLimitedUntil && k.rateLimitedUntil < now) {
                        k.rateLimitedUntil = 0;
                    }
                });
            }
        } catch (e) {
            console.warn('[ApiKeyPool] Failed to load from storage:', e);
        }
    }

    private saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                poolKeys: this.state.poolKeys
            }));
        } catch (e) {
            console.warn('[ApiKeyPool] Failed to save to storage:', e);
        }
    }

    /**
     * Lấy key khả dụng với ưu tiên:
     * 1. Account Key (nếu không bị rate limit)
     * 2. Pool Keys theo thứ tự (key nào ít dùng hơn sẽ được ưu tiên)
     */
    getAvailableKey(): PoolKey | null {
        const now = Date.now();

        // 1. Ưu tiên Account Key
        if (this.state.accountKey) {
            const accountPoolKey = this.getAccountKeyAsPoolKey();
            if (accountPoolKey && accountPoolKey.rateLimitedUntil < now) {
                return accountPoolKey;
            }
        }

        // 2. Fallback to Pool Keys
        const availablePoolKeys = this.state.poolKeys
            .filter(k => k.rateLimitedUntil < now && k.errorCount < 3)
            .sort((a, b) => a.requestCount - b.requestCount); // Ưu tiên key ít dùng

        if (availablePoolKeys.length > 0) {
            return availablePoolKeys[0];
        }

        // 3. Nếu tất cả đều bị rate limit, trả về key có thời gian chờ ngắn nhất
        const allKeys = this.getAllKeys();
        if (allKeys.length === 0) return null;

        const soonestAvailable = allKeys
            .filter(k => k.errorCount < 3)
            .sort((a, b) => a.rateLimitedUntil - b.rateLimitedUntil)[0];

        return soonestAvailable || null;
    }

    /**
     * Lấy thời gian chờ tối thiểu (ms) cho key khả dụng tiếp theo
     */
    getMinWaitTime(): number {
        const now = Date.now();
        const allKeys = this.getAllKeys().filter(k => k.errorCount < 3);

        if (allKeys.length === 0) return Infinity;

        const waitTimes = allKeys.map(k => Math.max(0, k.rateLimitedUntil - now));
        return Math.min(...waitTimes);
    }

    private getAccountKeyAsPoolKey(): PoolKey | null {
        if (!this.state.accountKey) return null;

        const accountLabel = this.isLocal ? '🔑 Account (.env)' : '🌐 Account (AI Studio)';

        // Tìm trong poolKeys nếu đã có tracking
        let existing = this.state.poolKeys.find(k => k.isAccountKey);
        if (!existing) {
            existing = {
                id: 'account',
                key: this.state.accountKey,
                label: accountLabel,
                isAccountKey: true,
                rateLimitedUntil: 0,
                requestCount: 0,
                lastUsed: 0,
                errorCount: 0
            };
            // Thêm vào đầu danh sách
            this.state.poolKeys.unshift(existing);
            this.saveToStorage();
        } else if (existing.label !== accountLabel) {
            // Update label if environment changed
            existing.label = accountLabel;
        }
        return existing;
    }

    /**
     * Đánh dấu key bị rate limit
     */
    markRateLimited(key: string, durationMs: number = RATE_LIMIT_DURATION) {
        const poolKey = this.state.poolKeys.find(k => k.key === key);
        if (poolKey) {
            poolKey.rateLimitedUntil = Date.now() + durationMs;
            this.saveToStorage();
        }
    }

    /**
     * Ghi nhận request thành công
     */
    recordSuccess(key: string) {
        const poolKey = this.state.poolKeys.find(k => k.key === key);
        if (poolKey) {
            poolKey.requestCount++;
            poolKey.lastUsed = Date.now();
            poolKey.errorCount = 0; // Reset error count on success
            this.activeKeyId = poolKey.id; // Mark as active
            this.saveToStorage();
        }
    }

    /**
     * Set active key being used (for UI highlight)
     */
    setActiveKey(keyOrId: string | PoolKey | null) {
        if (!keyOrId) {
            this.activeKeyId = null;
        } else if (typeof keyOrId === 'string') {
            const poolKey = this.state.poolKeys.find(k => k.key === keyOrId || k.id === keyOrId);
            this.activeKeyId = poolKey?.id || null;
        } else {
            this.activeKeyId = keyOrId.id;
        }
    }

    /**
     * Get currently active key ID
     */
    getActiveKeyId(): string | null {
        return this.activeKeyId;
    }

    /**
     * Ghi nhận lỗi (không phải rate limit)
     */
    recordError(key: string) {
        const poolKey = this.state.poolKeys.find(k => k.key === key);
        if (poolKey) {
            poolKey.errorCount++;
            this.saveToStorage();
        }
    }

    /**
     * Thêm key mới vào pool
     */
    addPoolKey(key: string, label?: string): boolean {
        if (!key || key.length < 10) return false;
        if (this.state.poolKeys.some(k => k.key === key)) return false; // Đã tồn tại

        const index = this.state.poolKeys.filter(k => !k.isAccountKey).length + 1;
        this.state.poolKeys.push({
            id: `pool_${index}`,
            key,
            label: label || `Pool #${index}`,
            isAccountKey: false,
            rateLimitedUntil: 0,
            requestCount: 0,
            lastUsed: 0,
            errorCount: 0
        });
        this.saveToStorage();
        return true;
    }

    /**
     * Xóa key khỏi pool
     */
    removePoolKey(key: string): boolean {
        const idx = this.state.poolKeys.findIndex(k => k.key === key && !k.isAccountKey);
        if (idx === -1) return false;

        this.state.poolKeys.splice(idx, 1);
        // Reindex labels and IDs
        let poolIndex = 1;
        this.state.poolKeys.forEach(k => {
            if (!k.isAccountKey) {
                k.id = `pool_${poolIndex}`;
                k.label = `Pool #${poolIndex++}`;
            }
        });
        this.saveToStorage();
        return true;
    }

    /**
     * Lấy tất cả keys (bao gồm Account Key) với status computed
     */
    getAllKeys(): PoolKey[] {
        // Đảm bảo Account Key luôn ở đầu
        this.getAccountKeyAsPoolKey();
        const now = Date.now();
        return this.state.poolKeys.map(k => ({
            ...k,
            status: k.errorCount >= 3 ? 'Depleted' as const
                : k.rateLimitedUntil > now ? 'RateLimited' as const
                    : 'Active' as const
        }));
    }

    /**
     * Lấy số lượng Pool Keys (không tính Account Key)
     */
    getPoolCount(): number {
        return this.state.poolKeys.filter(k => !k.isAccountKey).length;
    }

    /**
     * Xóa tất cả Pool Keys (giữ Account Key)
     */
    clearPool() {
        this.state.poolKeys = this.state.poolKeys.filter(k => k.isAccountKey);
        this.saveToStorage();
    }

    /**
     * Export pool keys (không bao gồm Account Key)
     */
    exportPool(): string {
        const poolOnly = this.state.poolKeys
            .filter(k => !k.isAccountKey)
            .map(k => k.key);
        return JSON.stringify(poolOnly, null, 2);
    }

    /**
     * Import pool keys
     * Supports both formats:
     * 1. Array of strings: ["key1", "key2"]
     * 2. Array of objects: [{key: "key1", label: "Label1"}, ...]
     */
    importPool(json: string): number {
        try {
            const keys = JSON.parse(json);
            if (!Array.isArray(keys)) return 0;

            let added = 0;
            keys.forEach(k => {
                let keyStr: string | undefined;
                let label: string | undefined;

                if (typeof k === 'string') {
                    // Format 1: Simple string array
                    keyStr = k;
                } else if (k && typeof k === 'object' && typeof k.key === 'string') {
                    // Format 2: Object with 'key' field
                    keyStr = k.key;
                    label = k.label || k.project || undefined;
                }

                if (keyStr && this.addPoolKey(keyStr, label)) {
                    added++;
                }
            });
            return added;
        } catch (e) {
            console.error('[ApiKeyPool] Import failed:', e);
            return 0;
        }
    }

    /**
     * Reset rate limits cho tất cả keys
     */
    resetAllRateLimits() {
        this.state.poolKeys.forEach(k => {
            k.rateLimitedUntil = 0;
            k.errorCount = 0;
        });
        this.saveToStorage();
    }

    /**
     * Mask key để hiển thị (AIza...xxx)
     */
    static maskKey(key: string): string {
        if (!key || key.length < 10) return '***';
        // Virtual AI Studio key
        if (key === 'AI_STUDIO_SESSION_KEY') return 'Auto-Injected';
        return `${key.substring(0, 4)}...${key.substring(key.length - 3)}`;
    }

    /**
     * Get display name for logging (với emoji và masked key)
     */
    getKeyDisplayName(keyOrPoolKey: string | PoolKey): string {
        let poolKey: PoolKey | undefined;

        if (typeof keyOrPoolKey === 'string') {
            poolKey = this.state.poolKeys.find(k => k.key === keyOrPoolKey);
        } else {
            poolKey = keyOrPoolKey;
        }

        if (!poolKey) return `Unknown Key`;

        const masked = ApiKeyPool.maskKey(poolKey.key);
        if (poolKey.isAccountKey) {
            return `🔑 Account [${masked}]`;
        }
        return `📦 ${poolKey.label} [${masked}]`;
    }

    // Get account key for tracking
    getAccountKey(): PoolKey | null {
        return this.state.poolKeys.find(k => k.isAccountKey) || null;
    }
}

// Singleton instance
export const apiKeyPool = new ApiKeyPool();
