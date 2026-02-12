
import React, { useState, useEffect, useRef } from 'react';
import {
    X, Key, Plus, Trash2, Download, Upload, RefreshCw,
    CheckCircle, AlertCircle, Clock, Ban, Loader2, Copy,
    FileJson, Trash, ChevronDown, ChevronRight, Zap, Activity,
    CheckSquare, Square
} from 'lucide-react';
import { apiKeyPool, PoolKey } from '../utils/apiKeyPool';
import { MODEL_CONFIGS } from '../constants';

interface ApiKeyPoolModalProps {
    isOpen: boolean;
    onClose: () => void;
    onToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// Model tier configurations for quota display
const MODEL_TIERS = {
    flash: [
        { id: 'gemini-3-flash-preview', name: 'FLASH 3.0', rpmLimit: 15, rpdLimit: 1500 },
        { id: 'gemini-2.5-flash', name: 'FLASH 2.5', rpmLimit: 15, rpdLimit: 1500 },
    ],
    pro: [
        { id: 'gemini-3-pro-preview', name: 'PRO 3.0', rpmLimit: 2, rpdLimit: 50 },
        { id: 'gemini-2.5-pro', name: 'PRO 2.5', rpmLimit: 2, rpdLimit: 100 },
    ]
};

export const ApiKeyPoolModal: React.FC<ApiKeyPoolModalProps> = ({ isOpen, onClose, onToast }) => {
    const [keys, setKeys] = useState<PoolKey[]>([]);
    const [stats, setStats] = useState({ total: 0, active: 0, rateLimited: 0, depleted: 0 });
    const [activeKeyId, setActiveKeyId] = useState<string | null>(null);
    const [enabledKeyIds, setEnabledKeyIds] = useState<Set<string>>(new Set());
    const [isAllEnabled, setIsAllEnabled] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newKeyInput, setNewKeyInput] = useState('');
    const [newLabelInput, setNewLabelInput] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [showConfirmClear, setShowConfirmClear] = useState(false);
    const [showRateLimits, setShowRateLimits] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load keys
    useEffect(() => {
        const refresh = () => {
            const allKeys = apiKeyPool.getAllKeys();
            setKeys(allKeys);
            setActiveKeyId(apiKeyPool.getActiveKeyId());
            setEnabledKeyIds(apiKeyPool.getEnabledKeyIds());
            setIsAllEnabled(apiKeyPool.isAllKeysEnabled());
            // Calculate stats
            const now = Date.now();
            const stats = {
                total: allKeys.length,
                active: allKeys.filter(k => k.rateLimitedUntil < now).length,
                rateLimited: allKeys.filter(k => k.rateLimitedUntil >= now).length,
                depleted: allKeys.filter(k => k.errorCount > 5).length
            };
            setStats(stats);
        };
        refresh();

        // Refresh every 2 seconds (faster update for active key tracking)
        const interval = setInterval(refresh, 2000);
        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen) return null;

    const maskKey = (key: string) => {
        if (key.length <= 10) return '***';
        return `${key.substring(0, 5)}...${key.substring(key.length - 3)}`;
    };

    // Check if a key is enabled
    const isKeyEnabled = (keyId: string) => {
        if (isAllEnabled) return true;
        return enabledKeyIds.has(keyId);
    };

    // Toggle key enabled/disabled
    const handleToggleKey = (keyId: string) => {
        apiKeyPool.toggleKeyEnabled(keyId);
        setEnabledKeyIds(apiKeyPool.getEnabledKeyIds());
        setIsAllEnabled(apiKeyPool.isAllKeysEnabled());
    };

    // Select All
    const handleSelectAll = () => {
        apiKeyPool.enableAllKeys();
        setEnabledKeyIds(apiKeyPool.getEnabledKeyIds());
        setIsAllEnabled(true);
    };

    // Unselect All (keep only first key)
    const handleUnselectAll = () => {
        if (keys.length === 0) return;
        // Enable only the first key (account key or first pool key)
        const firstKey = keys[0];
        keys.forEach(k => {
            if (apiKeyPool.isAllKeysEnabled()) {
                apiKeyPool.toggleKeyEnabled(k.id); // This populates the set
            }
        });
        // Now disable all except first
        keys.forEach(k => {
            if (k.id !== firstKey.id && apiKeyPool.isKeyEnabled(k.id)) {
                apiKeyPool.toggleKeyEnabled(k.id);
            }
        });
        setEnabledKeyIds(apiKeyPool.getEnabledKeyIds());
        setIsAllEnabled(apiKeyPool.isAllKeysEnabled());
    };

    // Check if all enabled keys are depleted
    const allEnabledDepleted = keys.length > 0 && keys.filter(k => isKeyEnabled(k.id)).every(k => k.errorCount >= 3 || k.status === 'Depleted');

    const handleAddKey = () => {
        if (!newKeyInput.trim()) {
            onToast('Vui lòng nhập API Key', 'warning');
            return;
        }
        const success = apiKeyPool.addPoolKey(newKeyInput.trim(), newLabelInput.trim() || undefined);
        if (success) {
            setNewKeyInput('');
            setNewLabelInput('');
            setShowAddForm(false);
            onToast('Đã thêm API Key mới', 'success');
        } else {
            onToast('Key đã tồn tại hoặc không hợp lệ', 'error');
        }
    };

    const handleRemoveKey = (id: string) => {
        apiKeyPool.removePoolKey(id);
        onToast('Đã xóa API Key', 'info');
    };

    const handleClearAll = () => {
        apiKeyPool.clearPool();
        setShowConfirmClear(false);
        onToast('Đã xóa toàn bộ API Keys', 'info');
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const text = await file.text();
            const count = apiKeyPool.importPool(text);
            if (count > 0) {
                onToast(`Đã import ${count} keys`, 'success');
            } else {
                onToast('Không có key nào được import', 'warning');
            }
        } catch (err) {
            onToast('Lỗi đọc file JSON', 'error');
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleExport = () => {
        const json = apiKeyPool.exportPool();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `api-keys-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        onToast('Đã export file JSON', 'success');
    };

    const handleResetStats = () => {
        apiKeyPool.resetAllRateLimits();
        onToast('Đã reset trạng thái tất cả keys', 'success');
    };

    const copyKey = (key: string) => {
        navigator.clipboard.writeText(key);
        onToast('Đã copy API Key', 'info');
    };

    // Quota bar component for each model
    const QuotaBar = ({ modelName, current, limit, color }: { modelName: string; current: number; limit: number; color: 'cyan' | 'magenta' }) => {
        const percentage = Math.min(100, (current / limit) * 100);
        const barColor = color === 'cyan' ? 'bg-cyan-500' : 'bg-fuchsia-500';
        const textColor = color === 'cyan' ? 'text-cyan-600 dark:text-cyan-400' : 'text-fuchsia-600 dark:text-fuchsia-400';

        return (
            <div className="flex items-center gap-2">
                <span className={`text-[9px] font-bold uppercase tracking-wide ${textColor}`}>
                    {modelName}
                </span>
                <div className="flex-1 flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400">{current}/{limit}</span>
                    <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${barColor} transition-all duration-300`}
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    };

    // Key Card Component
    const KeyCard = ({ keyData, index }: { keyData: PoolKey; index: number }) => {
        const isActive = keyData.status === 'Active';
        const isRateLimited = keyData.status === 'RateLimited';
        const isDepleted = keyData.status === 'Depleted';
        const isAccountKey = keyData.isAccountKey;
        const isCurrentlyInUse = keyData.id === activeKeyId;
        const enabled = isKeyEnabled(keyData.id);

        return (
            <div className={`
                relative p-3 rounded-lg border backdrop-blur-sm transition-all duration-200
                ${!enabled ? 'opacity-40 grayscale' : ''}
                ${isAccountKey
                    ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-400 dark:border-amber-500/50 ring-1 ring-amber-300 dark:ring-amber-500/30'
                    : isCurrentlyInUse && enabled
                        ? 'bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border-cyan-400 dark:border-cyan-500/50 ring-2 ring-cyan-400 dark:ring-cyan-500/50'
                        : isDepleted
                            ? 'bg-slate-100 dark:bg-slate-800/30 border-rose-300 dark:border-rose-700/50'
                            : isRateLimited
                                ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-500/30'
                                : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-600/50 hover:border-cyan-400 dark:hover:border-cyan-500/30'}
            `}>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        {/* Checkbox */}
                        <button
                            onClick={(e) => { e.stopPropagation(); handleToggleKey(keyData.id); }}
                            className={`flex-shrink-0 p-0.5 rounded transition-colors ${enabled
                                ? 'text-cyan-500 dark:text-cyan-400 hover:text-cyan-600'
                                : 'text-slate-300 dark:text-slate-600 hover:text-slate-400'
                                }`}
                            title={enabled ? 'Bỏ chọn key này' : 'Chọn key này'}
                        >
                            {enabled ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>
                        {isAccountKey ? (
                            <>
                                <span className="flex-shrink-0 text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 rounded">
                                    {keyData.label}
                                </span>
                                <code className="text-[9px] font-mono text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-700/30 px-1.5 py-0.5 rounded truncate" title={maskKey(keyData.key)}>
                                    {maskKey(keyData.key)}
                                </code>
                            </>
                        ) : (
                            <>
                                <span
                                    className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider truncate max-w-[120px]"
                                    title={keyData.label}
                                >
                                    📦 {keyData.label}
                                </span>
                                <code className="flex-shrink-0 text-[9px] font-mono text-slate-500 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/50 px-1.5 py-0.5 rounded">
                                    {maskKey(keyData.key)}
                                </code>
                            </>
                        )}
                    </div>
                    {!isAccountKey && (
                        <button
                            onClick={() => handleRemoveKey(keyData.key)}
                            className="p-1 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                            title="Xóa key"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                </div>


                {/* Flash Models */}
                <div className="space-y-1 mb-2">
                    {MODEL_TIERS.flash.map(model => (
                        <QuotaBar
                            key={model.id}
                            modelName={model.name}
                            current={keyData.modelRequestCounts?.[model.id] || 0}
                            limit={model.rpdLimit}
                            color="cyan"
                        />
                    ))}
                </div>

                {/* Pro Models */}
                <div className="space-y-1">
                    {MODEL_TIERS.pro.map(model => (
                        <QuotaBar
                            key={model.id}
                            modelName={model.name}
                            current={keyData.modelRequestCounts?.[model.id] || 0}
                            limit={model.rpdLimit}
                            color="magenta"
                        />
                    ))}
                </div>

                {/* Status Indicator */}
                {isDepleted && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 rounded-lg flex items-center justify-center">
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/20 px-2 py-1 rounded">
                            DEPLETED
                        </span>
                    </div>
                )}
                {isRateLimited && (
                    <div className="absolute top-2 right-8 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-500 dark:text-amber-400 animate-pulse" />
                    </div>
                )}
                {isCurrentlyInUse && !isAccountKey && (
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                        <span className="text-[8px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-500/20 px-1 py-0.5 rounded animate-pulse">
                            IN USE
                        </span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start justify-center z-[100] p-4 pt-[10vh] overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-6xl h-[75vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700/50">
                {/* Header */}
                <div className="flex-shrink-0 px-5 py-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-cyan-100 to-fuchsia-100 dark:from-cyan-500/20 dark:to-fuchsia-500/20 rounded-lg border border-slate-200 dark:border-slate-600/50">
                            <Key className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                API KEYS
                                <span className="text-cyan-600 dark:text-cyan-400">({stats.total})</span>
                            </h2>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleResetStats}
                            disabled={keys.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30 text-xs font-bold rounded-lg hover:bg-amber-200 dark:hover:bg-amber-500/30 disabled:opacity-50 transition-all"
                        >
                            <RefreshCw className="w-3.5 h-3.5" /> RESET ALL QUOTA
                        </button>
                        <button
                            onClick={() => setShowConfirmClear(true)}
                            disabled={keys.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30 text-xs font-bold rounded-lg hover:bg-rose-200 dark:hover:bg-rose-500/30 disabled:opacity-50 transition-all"
                        >
                            <Trash className="w-3.5 h-3.5" /> CLEAR ALL
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={keys.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-all"
                        >
                            <Download className="w-3.5 h-3.5" /> EXPORT
                        </button>
                        <button
                            onClick={handleImportClick}
                            disabled={isImporting}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-500/30 text-xs font-bold rounded-lg hover:bg-cyan-200 dark:hover:bg-cyan-500/30 disabled:opacity-50 transition-all"
                        >
                            {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} IMPORT
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
                </div>

                {/* Rate Limits Info (Collapsible) */}
                <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700/50">
                    <button
                        onClick={() => setShowRateLimits(!showRateLimits)}
                        className="w-full px-5 py-2 flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                        {showRateLimits ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        <Activity className="w-3 h-3" />
                        RATE LIMITS BY MODEL (FREE TIER)
                    </button>
                    {showRateLimits && (
                        <div className="px-5 pb-3 grid grid-cols-4 gap-4">
                            {[...MODEL_TIERS.flash, ...MODEL_TIERS.pro].map(model => (
                                <div key={model.id} className="flex items-center justify-between text-[10px] px-2 py-1 bg-slate-100 dark:bg-slate-800/30 rounded">
                                    <span className={`font-bold ${model.id.includes('flash') ? 'text-cyan-600 dark:text-cyan-400' : 'text-fuchsia-600 dark:text-fuchsia-400'}`}>
                                        {model.name}
                                    </span>
                                    <span className="text-slate-500 dark:text-slate-500">
                                        {model.rpmLimit} RPM / {model.rpdLimit} RPD
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Add Form */}
                {showAddForm && (
                    <div className="flex-shrink-0 px-5 py-3 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-700/50">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Label (tùy chọn)"
                                value={newLabelInput}
                                onChange={(e) => setNewLabelInput(e.target.value)}
                                className="w-32 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-cyan-500 outline-none"
                            />
                            <input
                                type="text"
                                placeholder="API Key (AIza...)"
                                value={newKeyInput}
                                onChange={(e) => setNewKeyInput(e.target.value)}
                                className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono placeholder-slate-400 dark:placeholder-slate-500 focus:border-cyan-500 outline-none"
                            />
                            <button onClick={handleAddKey} className="px-4 py-2 bg-cyan-500 text-white text-sm font-bold rounded-lg hover:bg-cyan-600 transition-colors">
                                Thêm
                            </button>
                            <button onClick={() => { setShowAddForm(false); setNewKeyInput(''); setNewLabelInput(''); }} className="px-3 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                                Hủy
                            </button>
                        </div>
                    </div>
                )}

                {/* Keys Section Header */}
                <div className="flex-shrink-0 px-5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-700/30">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            <Activity className="w-3.5 h-3.5" />
                            API KEYS & USAGE ({keys.length})
                        </div>
                        {/* Select All / Unselect All Buttons */}
                        {keys.length > 0 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handleSelectAll}
                                    className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded transition-colors ${isAllEnabled
                                        ? 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20'
                                        : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600/50 hover:bg-cyan-50 dark:hover:bg-cyan-500/10'
                                        }`}
                                    title={isAllEnabled ? 'Tất cả key đã được chọn' : 'Chọn tất cả'}
                                >
                                    <CheckSquare className="w-3 h-3" />
                                    {isAllEnabled ? '✓ ALL' : 'SELECT ALL'}
                                </button>
                                {isAllEnabled && keys.length > 1 && (
                                    <button
                                        onClick={handleUnselectAll}
                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded transition-colors text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600/50 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-500"
                                        title="Bỏ chọn tất cả (giữ lại key đầu tiên)"
                                    >
                                        <Square className="w-3 h-3" />
                                        UNSELECT
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 text-xs font-bold rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-all"
                    >
                        <Plus className="w-3.5 h-3.5" /> ADD KEY
                    </button>
                </div>

                {/* Keys Grid */}
                <div className="flex-1 overflow-y-auto p-5 bg-slate-50 dark:bg-slate-900/50">
                    {keys.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                            <FileJson className="w-16 h-16 mb-4 opacity-30" />
                            <p className="text-sm font-medium mb-1">Chưa có API Key nào</p>
                            <p className="text-xs text-slate-400 dark:text-slate-600">Import file JSON hoặc bấm "ADD KEY" để thêm thủ công</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                            {keys.map((key, index) => (
                                <KeyCard key={key.id} keyData={key} index={index} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-5 py-2 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30 text-[10px] text-slate-500 dark:text-slate-500 text-center">
                    💡 Lưu ý: Free Tier <span className="text-fuchsia-600 dark:text-fuchsia-400 font-bold">PRO models</span> có quota rất thấp (0 trên API). Nên dùng <span className="text-cyan-600 dark:text-cyan-400 font-bold">FLASH models</span> cho Local API.
                </div>

                {/* Confirm Clear Modal */}
                {showConfirmClear && (
                    <div className="absolute inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2">Xác nhận xóa tất cả?</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Hành động này không thể hoàn tác. Tất cả {keys.length} API keys sẽ bị xóa.</p>
                            <div className="flex items-center gap-2 justify-end">
                                <button onClick={() => setShowConfirmClear(false)} className="px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Hủy</button>
                                <button onClick={handleClearAll} className="px-4 py-2 text-sm font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors">Xóa tất cả</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
