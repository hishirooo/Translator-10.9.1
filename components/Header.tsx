
import React, { useState, useEffect } from 'react';
import { 
    Cpu, RefreshCw, Zap, Clock, Timer, CheckCircle, HelpCircle, 
    Terminal, FileText, Loader2, AlertCircle,
    Globe, Layers, Activity, Moon, Sun, ChevronUp, ChevronDown, 
    Scale, ArrowRightLeft, Database, HardDrive, Maximize, Minimize,
    Ban, Hourglass
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
    ratioLimits: RatioLimits; // Added Ratio Limits
    setRatioLimits: React.Dispatch<React.SetStateAction<RatioLimits>>; // Added Ratio Limits Setter
    isDarkMode?: boolean;
    toggleDarkMode?: () => void;
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
    
    const renderModelBadge = (config: ModelQuota) => {
        const isEnabled = props.enabledModels.includes(config.id);
        const usage = props.modelUsages[config.id] || { requestsToday: 0, recentRequests: [], isDepleted: false, cooldownUntil: 0 };
        const requestsToday = usage.requestsToday || 0;
        const recentReqs = usage.recentRequests || [];
        const currentRpmCount = recentReqs.filter((t: number) => now - t < 60000).length;
        const isRpmFull = currentRpmCount >= config.rpmLimit;
        const dailyPercentage = Math.min(100, Math.round((requestsToday / config.rpdLimit) * 100));
        const isDepleted = usage.isDepleted;
        
        // Calculate Wait Time
        const cooldownRemaining = Math.max(0, (usage.cooldownUntil || 0) - now);
        const isCoolingDown = cooldownRemaining > 0;

        return (
            <div key={config.id} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border transition-all min-w-[160px] shadow-sm 
                ${isDepleted ? 'bg-slate-100 dark:bg-slate-950 border-rose-200 dark:border-rose-900 opacity-80' : 
                  isCoolingDown ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' :
                  isEnabled ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 
                  'bg-slate-50 dark:bg-slate-900 border-transparent opacity-60 grayscale'}`}>
                
                {isDepleted ? <Ban className="w-3 h-3 text-rose-500 shrink-0" /> : <input type="checkbox" checked={isEnabled} onChange={() => props.toggleModel(config.id)} className="w-3 h-3 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer shrink-0"/>}

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                        <span className={`text-[10px] font-bold truncate ${isDepleted ? 'text-rose-600 dark:text-rose-400 line-through' : 'text-slate-800 dark:text-slate-200'}`} title={config.name}>
                            {config.name.replace('Gemini ', '')}
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
                            <Hourglass className="w-2.5 h-2.5" /> Chờ {(cooldownRemaining/1000).toFixed(0)}s
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-end text-[9px] font-mono text-slate-500 dark:text-slate-400 mb-0.5">
                                <span>{requestsToday}/{config.rpdLimit}</span>
                                <span className={`font-bold ${isRpmFull ? "text-amber-600 animate-pulse" : "text-sky-600"}`}>{currentRpmCount}/{config.rpmLimit} RPM</span>
                            </div>
                            <div className="h-1 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${dailyPercentage > 90 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${dailyPercentage}%` }} />
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
                    <div className="flex items-center gap-2 shrink-0 text-[10px]">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 min-w-[100px]">
                                <FileText className="w-3 h-3 text-slate-400" />
                                <span className="font-bold text-slate-700 dark:text-slate-200">Tổng: {formatNumber(props.stats.total)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 rounded border border-emerald-100 dark:border-emerald-900/50 min-w-[100px]">
                                <CheckCircle className="w-3 h-3 text-emerald-500" />
                                <span className="font-bold text-emerald-700 dark:text-emerald-300">Xong: {formatNumber(props.stats.completed)}</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-sky-50 dark:bg-sky-950/30 rounded border border-sky-100 dark:border-sky-900/50 min-w-[100px]">
                                <Activity className="w-3 h-3 text-sky-500" />
                                <span className="font-bold text-sky-700 dark:text-sky-300">Xử lý: {formatNumber(props.stats.processing)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-50 dark:bg-rose-950/30 rounded border border-rose-100 dark:border-rose-900/50 min-w-[100px]">
                                <AlertCircle className="w-3 h-3 text-rose-500" />
                                <span className="font-bold text-rose-700 dark:text-rose-300">Lỗi: {props.stats.failed}</span>
                            </div>
                        </div>
                    </div>
                    <div className="w-px h-10 bg-slate-200 dark:bg-slate-700 shrink-0 hidden lg:block"></div>
                    <button onClick={props.handleManualResetQuota} className="px-2 py-1.5 text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded hover:text-sky-600 flex items-center gap-1 whitespace-nowrap shadow-sm">
                        <RefreshCw className="w-3 h-3" /> Reset Quota
                    </button>
                </div>

                {/* Config Bar */}
                <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-3 py-1.5 text-[10px]">
                    <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                        {/* Batch */}
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1 font-bold text-slate-500 uppercase tracking-wider"><HardDrive className="w-3 h-3" /> Batch</div>
                            
                            {/* Latin Config */}
                            <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-700">
                                <span className="font-bold text-indigo-600">Latin</span>
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[8px] text-slate-400">V3</span>
                                        <input type="number" className="config-input w-8 text-indigo-600" value={props.batchLimits.latin.v3} onChange={(e) => props.setBatchLimits(prev => ({...prev, latin: {...prev.latin, v3: parseInt(e.target.value)||1}}))} />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[8px] text-slate-400">V2.5</span>
                                        <input type="number" className="config-input w-8 text-indigo-600" value={props.batchLimits.latin.v25} onChange={(e) => props.setBatchLimits(prev => ({...prev, latin: {...prev.latin, v25: parseInt(e.target.value)||1}}))} />
                                    </div>
                                </div>
                                <span className="text-slate-300 mx-0.5">|</span>
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-[7px] text-slate-400 font-bold uppercase leading-none">Max Chars</span>
                                    <input type="number" className="config-input w-16" value={props.batchLimits.latin.maxTotalChars} onChange={(e) => props.setBatchLimits(prev => ({...prev, latin: {...prev.latin, maxTotalChars: parseInt(e.target.value)||38000}}))} />
                                </div>
                            </div>

                            {/* Raw Config */}
                            <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-700">
                                <span className="font-bold text-amber-600">Raw</span>
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[8px] text-slate-400">V3</span>
                                        <input type="number" className="config-input w-8 text-amber-600" value={props.batchLimits.complex.v3} onChange={(e) => props.setBatchLimits(prev => ({...prev, complex: {...prev.complex, v3: parseInt(e.target.value)||1}}))} />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[8px] text-slate-400">V2.5</span>
                                        <input type="number" className="config-input w-8 text-amber-600" value={props.batchLimits.complex.v25} onChange={(e) => props.setBatchLimits(prev => ({...prev, complex: {...prev.complex, v25: parseInt(e.target.value)||1}}))} />
                                    </div>
                                </div>
                                <span className="text-slate-300 mx-0.5">|</span>
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-[7px] text-slate-400 font-bold uppercase leading-none">Max Chars</span>
                                    <input type="number" className="config-input w-16" value={props.batchLimits.complex.maxTotalChars} onChange={(e) => props.setBatchLimits(prev => ({...prev, complex: {...prev.complex, maxTotalChars: parseInt(e.target.value)||38000}}))} />
                                </div>
                            </div>
                        </div>

                        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 shrink-0"></div>

                        {/* Ratio Config - Detailed */}
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1 font-bold text-slate-500 uppercase tracking-wider"><Scale className="w-3 h-3" /> Ratio Control</div>
                            
                            {/* VN / Convert */}
                            <div className="flex flex-col items-center pl-2 border-l border-slate-200 dark:border-slate-700">
                                <span className="text-[8px] font-bold text-sky-600 mb-0.5">VN/Convert</span>
                                <div className="flex items-center gap-1">
                                    <input type="number" step="0.1" className="config-input w-9 text-sky-600" value={props.ratioLimits.vn.min} onChange={(e) => props.setRatioLimits(prev => ({...prev, vn: {...prev.vn, min: parseFloat(e.target.value)}}))} />
                                    <span className="text-slate-300">-</span>
                                    <input type="number" step="0.1" className="config-input w-9 text-sky-600" value={props.ratioLimits.vn.max} onChange={(e) => props.setRatioLimits(prev => ({...prev, vn: {...prev.vn, max: parseFloat(e.target.value)}}))} />
                                </div>
                            </div>

                            {/* EN / Western */}
                            <div className="flex flex-col items-center pl-2 border-l border-slate-200 dark:border-slate-700">
                                <span className="text-[8px] font-bold text-indigo-600 mb-0.5">EN/Western</span>
                                <div className="flex items-center gap-1">
                                    <input type="number" step="0.1" className="config-input w-9 text-indigo-600" value={props.ratioLimits.en.min} onChange={(e) => props.setRatioLimits(prev => ({...prev, en: {...prev.en, min: parseFloat(e.target.value)}}))} />
                                    <span className="text-slate-300">-</span>
                                    <input type="number" step="0.1" className="config-input w-9 text-indigo-600" value={props.ratioLimits.en.max} onChange={(e) => props.setRatioLimits(prev => ({...prev, en: {...prev.en, max: parseFloat(e.target.value)}}))} />
                                </div>
                            </div>

                            {/* KR / JP */}
                            <div className="flex flex-col items-center pl-2 border-l border-slate-200 dark:border-slate-700">
                                <span className="text-[8px] font-bold text-fuchsia-600 mb-0.5">KR/JP</span>
                                <div className="flex items-center gap-1">
                                    <input type="number" step="0.1" className="config-input w-9 text-fuchsia-600" value={props.ratioLimits.krjp.min} onChange={(e) => props.setRatioLimits(prev => ({...prev, krjp: {...prev.krjp, min: parseFloat(e.target.value)}}))} />
                                    <span className="text-slate-300">-</span>
                                    <input type="number" step="0.1" className="config-input w-9 text-fuchsia-600" value={props.ratioLimits.krjp.max} onChange={(e) => props.setRatioLimits(prev => ({...prev, krjp: {...prev.krjp, max: parseFloat(e.target.value)}}))} />
                                </div>
                            </div>

                            {/* CN / Complex */}
                            <div className="flex flex-col items-center pl-2 border-l border-slate-200 dark:border-slate-700">
                                <span className="text-[8px] font-bold text-amber-600 mb-0.5">Trung (CN)</span>
                                <div className="flex items-center gap-1">
                                    <input type="number" step="0.1" className="config-input w-9 text-amber-600" value={props.ratioLimits.cn.min} onChange={(e) => props.setRatioLimits(prev => ({...prev, cn: {...prev.cn, min: parseFloat(e.target.value)}}))} />
                                    <span className="text-slate-300">-</span>
                                    <input type="number" step="0.1" className="config-input w-9 text-amber-600" value={props.ratioLimits.cn.max} onChange={(e) => props.setRatioLimits(prev => ({...prev, cn: {...prev.cn, max: parseFloat(e.target.value)}}))} />
                                </div>
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
            `}</style>
        </header>
    );
};
