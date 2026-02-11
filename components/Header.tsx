
import React, { useState, useEffect } from 'react';
import {
    Cpu, RefreshCw, Zap, Clock, Timer, CheckCircle, HelpCircle,
    Terminal, FileText, Loader2, AlertCircle,
    Globe, Layers, Activity, Moon, Sun, ChevronUp, ChevronDown,
    Scale, ArrowRightLeft, Database, HardDrive, Maximize, Minimize,
    Ban, Key, Hourglass
} from 'lucide-react';
import { APP_FULL_TITLE, APP_AUTHOR } from '../changelog';
import { ModelQuota, BatchLimits, RatioLimits } from '../types';

// --- LIVE TIMER COMPONENT (ISOLATED FOR PERFORMANCE) ---
const LiveTimer = ({ startTime, endTime }: { startTime: number, endTime: number | null }) => {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (endTime) {
            setNow(Date.now()); // Sync one last time
            return;
        }
        // Update every second
        const intervalId = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(intervalId);
    }, [startTime, endTime]);

    const targetTime = endTime || now;
    const diff = Math.max(0, Math.floor((targetTime - startTime) / 1000));

    const h = Math.floor(diff / 3600).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');

    return (
        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold min-w-[60px]">
            <Timer className={`w-3 h-3 ${!endTime ? 'animate-pulse' : ''}`} />
            <span>{h}:{m}:{s}</span>
        </div>
    );
};

interface HeaderProps {
    stats: any;
    showLogs: boolean;
    setShowLogs: (v: boolean) => void;
    showSettings: boolean;
    setShowSettings: (v: boolean) => void;
    onShowChangelog: () => void;
    enabledModels: string[];
    modelConfigs: ModelQuota[];
    modelUsages: any;
    toggleModel: (id: string) => void;
    handleManualResetQuota: () => void;
    handleTestModel: (id: string) => void;
    testingModelId: string | null;
    startTime: number | null;
    endTime: number | null;
    hasLogErrors: boolean;
    progressPercentage?: number;
    batchLimits: BatchLimits;
    setBatchLimits: React.Dispatch<React.SetStateAction<BatchLimits>>;
    ratioLimits: RatioLimits;
    setRatioLimits: React.Dispatch<React.SetStateAction<RatioLimits>>;
    isDarkMode?: boolean;
    toggleDarkMode?: () => void;
    showApiKeyPool?: boolean;
    setShowApiKeyPool?: (v: boolean) => void;
}

export const Header: React.FC<HeaderProps> = (props) => {
    const [now, setNow] = useState(Date.now());
    const [isExpanded, setIsExpanded] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            clearInterval(interval);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => console.error(err));
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    };

    const formatNumber = (num: number) => new Intl.NumberFormat('vi-VN').format(num);
    const proModels = props.modelConfigs.filter(m => m.priority <= 2);
    const flashModels = props.modelConfigs.filter(m => m.priority > 2 && m.priority < 5);

    // Determine if model is Pro or Flash tier
    const isPro = (config: ModelQuota) => config.priority <= 2;

    const renderModelBadge = (config: ModelQuota) => {
        const isEnabled = props.enabledModels.includes(config.id);
        const usage = props.modelUsages[config.id] || { requestsToday: 0, recentRequests: [], isDepleted: false, cooldownUntil: 0 };
        const requestsToday = usage.requestsToday || 0;
        const recentReqs = usage.recentRequests || [];
        const currentRpmCount = recentReqs.filter((t: number) => now - t < 60000).length;
        const isRpmFull = currentRpmCount >= config.rpmLimit;
        const dailyPercentage = Math.min(100, Math.round((requestsToday / config.rpdLimit) * 100));
        const isDepleted = usage.isDepleted;
        const isProModel = isPro(config);

        // Calculate Wait Time (from 10.9.1)
        const cooldownRemaining = Math.max(0, (usage.cooldownUntil || 0) - now);
        const isCoolingDown = cooldownRemaining > 0;

        return (
            <div key={config.id} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border transition-all min-w-[160px] shadow-sm 
                ${isDepleted ? 'bg-slate-100 dark:bg-slate-950 border-rose-200 dark:border-rose-900 opacity-80' :
                    isCoolingDown ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' :
                        isEnabled ? `bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 ${isProModel ? 'ring-1 ring-violet-200 dark:ring-violet-900/50' : 'ring-1 ring-cyan-200 dark:ring-cyan-900/50'}` :
                            'bg-slate-50 dark:bg-slate-900 border-transparent opacity-60 grayscale'}`}>

                {isDepleted ? <Ban className="w-3 h-3 text-rose-500 shrink-0" /> : <input type="checkbox" checked={isEnabled} onChange={() => props.toggleModel(config.id)} className={`w-3 h-3 rounded border-slate-300 focus:ring-1 cursor-pointer shrink-0 ${isProModel ? 'text-violet-600 focus:ring-violet-500' : 'text-cyan-600 focus:ring-cyan-500'}`} />}

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                        <span className={`text-[10px] font-bold truncate ${isDepleted ? 'text-rose-600 dark:text-rose-400 line-through' : isProModel ? 'text-violet-700 dark:text-violet-300' : 'text-slate-800 dark:text-slate-200'}`} title={config.name}>
                            {isProModel ? '⭐ ' : '⚡ '}{config.name.replace('Gemini ', '')}
                        </span>
                        {!isDepleted && (
                            <button onClick={() => props.handleTestModel(config.id)} disabled={!!props.testingModelId} className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-sky-600">
                                {props.testingModelId === config.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Zap className="w-2.5 h-2.5" />}
                            </button>
                        )}
                    </div>

                    {isDepleted ? (
                        <div className="text-[9px] font-bold text-rose-600 dark:text-rose-500 uppercase flex items-center gap-1">HẾT (LỖI)</div>
                    ) : isCoolingDown ? (
                        <div className="text-[9px] font-bold text-amber-600 dark:text-amber-500 flex items-center gap-1 animate-pulse">
                            <Hourglass className="w-2.5 h-2.5" /> Chờ {(cooldownRemaining / 1000).toFixed(0)}s
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-end text-[9px] font-mono text-slate-500 dark:text-slate-400 mb-0.5">
                                <span>{requestsToday}/{config.rpdLimit}</span>
                                <span className={`font-bold ${isRpmFull ? "text-amber-600 animate-pulse" : isProModel ? "text-violet-600" : "text-cyan-600"}`}>{currentRpmCount}/{config.rpmLimit} RPM</span>
                            </div>
                            <div className="h-1 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${dailyPercentage > 90 ? 'bg-rose-500' : isProModel ? 'bg-violet-500' : 'bg-emerald-500'}`} style={{ width: `${dailyPercentage}%` }} />
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-sm flex flex-col transition-colors duration-300 relative z-40">
            {/* Top Bar */}
            <div className="px-3 py-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-1 rounded text-white shadow-sm"><Cpu className="w-3.5 h-3.5" /></div>
                    <div>
                        <h1 className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-none">{APP_FULL_TITLE}</h1>
                    </div>
                    <button onClick={props.onShowChangelog} className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"><HelpCircle className="w-3.5 h-3.5" /></button>
                </div>

                <div className="flex items-center gap-1 relative z-50">
                    {props.startTime && (
                        <div className="hidden md:flex items-center gap-2 px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-medium text-slate-600 dark:text-slate-300 shadow-sm">
                            <Clock className="w-3 h-3 text-sky-500" />
                            <LiveTimer startTime={props.startTime} endTime={props.endTime} />
                        </div>
                    )}

                    <button
                        onClick={() => props.setShowApiKeyPool?.(true)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                        title="API Key Pool"
                    >
                        <Key className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold hidden sm:inline">API Keys</span>
                    </button>

                    <button onClick={props.toggleDarkMode} className="p-1.5 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-amber-500">
                        {props.isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                    </button>

                    <button onClick={toggleFullScreen} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500">
                        {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                    </button>

                    <button onClick={() => props.setShowLogs(true)} className={`relative p-1.5 rounded ${props.showLogs ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'hover:bg-slate-100 text-slate-400'}`}>
                        <Terminal className="w-3.5 h-3.5" />
                        {props.hasLogErrors && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />}
                    </button>

                    <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>

            {/* Expandable Area */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                {/* Models & Stats */}
                <div className="px-3 py-2 overflow-x-auto no-scrollbar flex items-center gap-4">
                    <div className="flex flex-col md:flex-row gap-2 shrink-0">
                        <div className="flex gap-2">{proModels.map(renderModelBadge)}</div>
                        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 shrink-0 hidden md:block"></div>
                        <div className="flex gap-2">{flashModels.map(renderModelBadge)}</div>
                    </div>
                    <div className="w-px h-10 bg-slate-200 dark:bg-slate-700 shrink-0 hidden lg:block"></div>

                    {/* Stats Section - Premium Style */}
                    <div className="flex items-center gap-3 shrink-0">
                        {/* Total Files */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-lg border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                            <div className="w-6 h-6 rounded-full bg-slate-500/10 flex items-center justify-center">
                                <FileText className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] uppercase tracking-wider text-slate-400 font-medium">Tổng</span>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 font-mono">{formatNumber(props.stats.total)}</span>
                            </div>
                        </div>

                        {/* Processing */}
                        <div className={`flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-sky-500/10 to-cyan-500/5 rounded-lg border border-sky-500/20 shadow-sm ${props.stats.processing > 0 ? 'animate-pulse' : ''}`}>
                            <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center">
                                <Activity className={`w-3.5 h-3.5 text-sky-500 ${props.stats.processing > 0 ? 'animate-pulse' : ''}`} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] uppercase tracking-wider text-sky-400 font-medium">Xử lý</span>
                                <span className="text-sm font-bold text-sky-600 dark:text-sky-300 font-mono">{formatNumber(props.stats.processing)}</span>
                            </div>
                        </div>

                        {/* Completed */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/5 rounded-lg border border-emerald-500/20 shadow-sm">
                            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] uppercase tracking-wider text-emerald-400 font-medium">Xong</span>
                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-300 font-mono">{formatNumber(props.stats.completed)}</span>
                            </div>
                        </div>

                        {/* Errors */}
                        <div className={`flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-rose-500/10 to-red-500/5 rounded-lg border border-rose-500/20 shadow-sm ${props.stats.failed > 0 ? 'animate-pulse' : ''}`}>
                            <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center">
                                <AlertCircle className={`w-3.5 h-3.5 text-rose-500 ${props.stats.failed > 0 ? 'animate-bounce' : ''}`} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] uppercase tracking-wider text-rose-400 font-medium">Lỗi</span>
                                <span className="text-sm font-bold text-rose-600 dark:text-rose-300 font-mono">{props.stats.failed}</span>
                            </div>
                        </div>
                    </div>

                    <div className="w-px h-10 bg-slate-200 dark:bg-slate-700 shrink-0 hidden lg:block"></div>

                    {/* Reset Quota Button - Premium */}
                    <button
                        onClick={props.handleManualResetQuota}
                        className="group relative px-4 py-2 rounded-lg bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                        <div className="relative flex items-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 group-hover:animate-spin transition-colors" />
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors whitespace-nowrap">Reset Quota</span>
                        </div>
                    </button>
                </div>

                {/* Config Bar - 10.8.5 Style */}
                <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-3 py-2 text-[10px]">
                    <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
                        {/* Batch Size Section */}
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center gap-1.5 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                <HardDrive className="w-3.5 h-3.5" />
                                <span>BATCH SIZE</span>
                            </div>

                            {/* Latin */}
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-cyan-500/10 dark:bg-cyan-500/5 rounded-md border border-cyan-500/20">
                                <span className="font-bold text-cyan-600 dark:text-cyan-400 uppercase text-[9px]">Latin</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-[8px] text-slate-400">V3</span>
                                    <input type="number" className="w-11 px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-cyan-500/50 dark:border-cyan-500/30 text-center font-mono font-bold text-cyan-600 dark:text-cyan-300 focus:ring-1 focus:ring-cyan-500 outline-none text-[10px]" value={props.batchLimits.latin.v3} onChange={(e) => props.setBatchLimits(prev => ({ ...prev, latin: { ...prev.latin, v3: parseInt(e.target.value) || 1 } }))} />
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-[8px] text-slate-400">V2.5</span>
                                    <input type="number" className="w-11 px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-cyan-500/50 dark:border-cyan-500/30 text-center font-mono font-bold text-cyan-600 dark:text-cyan-300 focus:ring-1 focus:ring-cyan-500 outline-none text-[10px]" value={props.batchLimits.latin.v25} onChange={(e) => props.setBatchLimits(prev => ({ ...prev, latin: { ...prev.latin, v25: parseInt(e.target.value) || 1 } }))} />
                                </div>
                                <span className="text-slate-400 dark:text-slate-600">/</span>
                                <input type="number" className="w-[72px] px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-cyan-500/50 dark:border-cyan-500/30 text-center font-mono font-bold text-cyan-600 dark:text-cyan-300 focus:ring-1 focus:ring-cyan-500 outline-none text-[10px]" value={props.batchLimits.latin.maxTotalChars} onChange={(e) => props.setBatchLimits(prev => ({ ...prev, latin: { ...prev.latin, maxTotalChars: parseInt(e.target.value) || 38000 } }))} />
                            </div>

                            {/* Raw */}
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 dark:bg-amber-500/5 rounded-md border border-amber-500/20">
                                <span className="font-bold text-amber-600 dark:text-amber-400 uppercase text-[9px]">Raw</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-[8px] text-slate-400">V3</span>
                                    <input type="number" className="w-11 px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-500/50 dark:border-amber-500/30 text-center font-mono font-bold text-amber-600 dark:text-amber-300 focus:ring-1 focus:ring-amber-500 outline-none text-[10px]" value={props.batchLimits.complex.v3} onChange={(e) => props.setBatchLimits(prev => ({ ...prev, complex: { ...prev.complex, v3: parseInt(e.target.value) || 1 } }))} />
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-[8px] text-slate-400">V2.5</span>
                                    <input type="number" className="w-11 px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-500/50 dark:border-amber-500/30 text-center font-mono font-bold text-amber-600 dark:text-amber-300 focus:ring-1 focus:ring-amber-500 outline-none text-[10px]" value={props.batchLimits.complex.v25} onChange={(e) => props.setBatchLimits(prev => ({ ...prev, complex: { ...prev.complex, v25: parseInt(e.target.value) || 1 } }))} />
                                </div>
                                <span className="text-slate-400 dark:text-slate-600">/</span>
                                <input type="number" className="w-[72px] px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-500/50 dark:border-amber-500/30 text-center font-mono font-bold text-amber-600 dark:text-amber-300 focus:ring-1 focus:ring-amber-500 outline-none text-[10px]" value={props.batchLimits.complex.maxTotalChars} onChange={(e) => props.setBatchLimits(prev => ({ ...prev, complex: { ...prev.complex, maxTotalChars: parseInt(e.target.value) || 38000 } }))} />
                            </div>
                        </div>

                        <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 shrink-0"></div>

                        {/* Ratio Check Section */}
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center gap-1.5 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                <Scale className="w-3.5 h-3.5" />
                                <span>RATIO CHECK</span>
                            </div>

                            {/* VN/Convert Ratio */}
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-cyan-500/10 dark:bg-cyan-500/5 rounded-md border border-cyan-500/20">
                                <span className="font-bold text-cyan-600 dark:text-cyan-400 uppercase text-[9px]">VN</span>
                                <input type="number" step="0.1" className="w-12 px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-cyan-500/50 dark:border-cyan-500/30 text-center font-mono font-bold text-cyan-600 dark:text-cyan-300 focus:ring-1 focus:ring-cyan-500 outline-none text-[10px]" value={props.ratioLimits.vn.min} onChange={(e) => props.setRatioLimits(prev => ({ ...prev, vn: { ...prev.vn, min: parseFloat(e.target.value) } }))} />
                                <ArrowRightLeft className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                <input type="number" step="0.1" className="w-12 px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-cyan-500/50 dark:border-cyan-500/30 text-center font-mono font-bold text-cyan-600 dark:text-cyan-300 focus:ring-1 focus:ring-cyan-500 outline-none text-[10px]" value={props.ratioLimits.vn.max} onChange={(e) => props.setRatioLimits(prev => ({ ...prev, vn: { ...prev.vn, max: parseFloat(e.target.value) } }))} />
                            </div>

                            {/* EN/Western Ratio */}
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-md border border-indigo-500/20">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase text-[9px]">EN</span>
                                <input type="number" step="0.1" className="w-12 px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-indigo-500/50 dark:border-indigo-500/30 text-center font-mono font-bold text-indigo-600 dark:text-indigo-300 focus:ring-1 focus:ring-indigo-500 outline-none text-[10px]" value={props.ratioLimits.en.min} onChange={(e) => props.setRatioLimits(prev => ({ ...prev, en: { ...prev.en, min: parseFloat(e.target.value) } }))} />
                                <ArrowRightLeft className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                <input type="number" step="0.1" className="w-12 px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-indigo-500/50 dark:border-indigo-500/30 text-center font-mono font-bold text-indigo-600 dark:text-indigo-300 focus:ring-1 focus:ring-indigo-500 outline-none text-[10px]" value={props.ratioLimits.en.max} onChange={(e) => props.setRatioLimits(prev => ({ ...prev, en: { ...prev.en, max: parseFloat(e.target.value) } }))} />
                            </div>

                            {/* KR/JP Ratio */}
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-fuchsia-500/10 dark:bg-fuchsia-500/5 rounded-md border border-fuchsia-500/20">
                                <span className="font-bold text-fuchsia-600 dark:text-fuchsia-400 uppercase text-[9px]">KR/JP</span>
                                <input type="number" step="0.1" className="w-12 px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-fuchsia-500/50 dark:border-fuchsia-500/30 text-center font-mono font-bold text-fuchsia-600 dark:text-fuchsia-300 focus:ring-1 focus:ring-fuchsia-500 outline-none text-[10px]" value={props.ratioLimits.krjp.min} onChange={(e) => props.setRatioLimits(prev => ({ ...prev, krjp: { ...prev.krjp, min: parseFloat(e.target.value) } }))} />
                                <ArrowRightLeft className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                <input type="number" step="0.1" className="w-12 px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-fuchsia-500/50 dark:border-fuchsia-500/30 text-center font-mono font-bold text-fuchsia-600 dark:text-fuchsia-300 focus:ring-1 focus:ring-fuchsia-500 outline-none text-[10px]" value={props.ratioLimits.krjp.max} onChange={(e) => props.setRatioLimits(prev => ({ ...prev, krjp: { ...prev.krjp, max: parseFloat(e.target.value) } }))} />
                            </div>

                            {/* CN/Complex Ratio */}
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 dark:bg-amber-500/5 rounded-md border border-amber-500/20">
                                <span className="font-bold text-amber-600 dark:text-amber-400 uppercase text-[9px]">CN</span>
                                <input type="number" step="0.1" className="w-12 px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-500/50 dark:border-amber-500/30 text-center font-mono font-bold text-amber-600 dark:text-amber-300 focus:ring-1 focus:ring-amber-500 outline-none text-[10px]" value={props.ratioLimits.cn.min} onChange={(e) => props.setRatioLimits(prev => ({ ...prev, cn: { ...prev.cn, min: parseFloat(e.target.value) } }))} />
                                <ArrowRightLeft className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                <input type="number" step="0.1" className="w-12 px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-500/50 dark:border-amber-500/30 text-center font-mono font-bold text-amber-600 dark:text-amber-300 focus:ring-1 focus:ring-amber-500 outline-none text-[10px]" value={props.ratioLimits.cn.max} onChange={(e) => props.setRatioLimits(prev => ({ ...prev, cn: { ...prev.cn, max: parseFloat(e.target.value) } }))} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Global Progress Bar */}
            <div className="w-full h-0.5 bg-slate-100 dark:bg-slate-800 relative">
                <div className="h-full bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 transition-all duration-300 ease-out" style={{ width: `${props.progressPercentage || 0}%` }} />
            </div>

            <style jsx>{`
                .config-input {
                    @apply px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-mono font-bold text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-300 outline-none text-[9px];
                }
                .config-input-compact {
                    @apply w-12 px-1.5 py-1 rounded border border-slate-600 bg-slate-800 text-center font-mono font-bold text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-[11px];
                }
            `}</style>
        </header>
    );
};
