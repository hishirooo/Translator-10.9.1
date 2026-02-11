
import React, { useState, useEffect } from 'react';
import { Play, CheckSquare, Square, X, Settings, Zap, ShieldAlert, PauseCircle, Minimize2, Maximize2, Loader2, StopCircle } from 'lucide-react';
import { TranslationTier, AutomationConfig } from '../types';

interface AutomationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (config: AutomationConfig) => void;
    onStop: () => void; // New prop
    isRunning: boolean;
    currentStep: number;
    countdown: number;
    totalSteps: number;
    stepStatus: string;
    // New Props for smart initialization
    initialConfig: { steps: number[], rules: string, tier: TranslationTier };
}

export const AutomationModal: React.FC<AutomationModalProps> = ({ 
    isOpen, onClose, onStart, onStop, isRunning, currentStep, countdown, totalSteps, stepStatus, initialConfig
}) => {
    const [selectedSteps, setSelectedSteps] = useState<number[]>([]);
    const [rules, setRules] = useState("");
    const [tier, setTier] = useState<TranslationTier>('normal');
    const [isMinimized, setIsMinimized] = useState(false);

    // Sync state when modal opens with new config
    useEffect(() => {
        if (isOpen && !isRunning) {
            setSelectedSteps(initialConfig.steps);
            setRules(initialConfig.rules || "");
            setTier(initialConfig.tier);
            setIsMinimized(false); // Reset minimize state on new open
        }
    }, [isOpen, isRunning, initialConfig]);

    // Auto expand if finished
    useEffect(() => {
        if (!isRunning) setIsMinimized(false);
    }, [isRunning]);

    const stepsList = [
        { id: 1, label: "Auto Phân Tích Nhanh", desc: "Quét metadata, tạo bìa, tóm tắt." },
        { id: 2, label: "Phân Tích Chuyên Sâu", desc: "Mở bảng phân tích để bạn kiểm tra & chạy Series Bible." },
        { id: 3, label: "Thiết Kế Prompt (Architect)", desc: "Mở bảng Prompt để bạn kiểm tra & tối ưu hóa." },
        { id: 4, label: "Dịch Thuật (Smart Start)", desc: "Chạy dịch toàn bộ file theo chế độ đã chọn." },
        { id: 5, label: "Smart Fix (Sửa Lỗi)", desc: "Tự động quét và sửa các dòng còn Raw/Lỗi." },
        { id: 6, label: "Trợ Lý Local (Format)", desc: "Lọc rác, định dạng chuẩn sách in." },
    ];

    const toggleStep = (id: number) => {
        setSelectedSteps(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id].sort((a, b) => a - b)
        );
    };

    if (!isOpen) return null;

    // --- MINIMIZED VIEW ---
    if (isMinimized && isRunning) {
        return (
            <div 
                className="fixed bottom-24 right-6 z-[200] bg-white dark:bg-slate-900 shadow-2xl border-2 border-yellow-400 rounded-full p-1.5 flex items-center gap-3 animate-in slide-in-from-bottom-10 group pr-2" 
                title="Automation Running"
            >
                <div onClick={() => setIsMinimized(false)} className="flex items-center gap-3 cursor-pointer pl-1">
                    <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-red-800 font-black relative shadow-sm">
                        {countdown > 0 ? (
                            <span className="text-xs">{countdown}s</span>
                        ) : (
                            <span>{currentStep}</span>
                        )}
                        <div className="absolute inset-0 border-2 border-yellow-200 rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-ping"></div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Auto Mode</span>
                        <span className="text-[9px] font-bold text-slate-500 max-w-[120px] truncate">
                            {countdown > 0 ? "Đang nghỉ (Cooldown)..." : stepStatus}
                        </span>
                    </div>
                </div>
                
                {/* Minimized Stop Button */}
                <button onClick={onStop} className="ml-2 p-2 bg-rose-100 hover:bg-rose-200 text-rose-600 rounded-full transition-colors" title="Dừng khẩn cấp">
                    <StopCircle className="w-5 h-5" />
                </button>
            </div>
        );
    }

    // --- NORMAL MAXIMIZED VIEW ---
    return (
        <div className={`fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300 ${isRunning ? 'pointer-events-none' : ''}`}>
            <div className={`bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 border border-yellow-400/50 relative ${isRunning ? 'pointer-events-auto' : ''}`}>
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-yellow-50 dark:bg-yellow-900/10 flex justify-between items-center">
                    <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Zap className="w-6 h-6 text-yellow-500 fill-yellow-500" /> 
                        {isRunning ? "Đang Chạy Tự Động..." : "Thiết Lập Tự Động Hóa"}
                    </h3>
                    <div className="flex items-center gap-2">
                        {isRunning && (
                            <button onClick={() => setIsMinimized(true)} className="p-1.5 hover:bg-yellow-200 dark:hover:bg-yellow-800/30 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 transition-colors" title="Thu nhỏ">
                                <Minimize2 className="w-5 h-5" />
                            </button>
                        )}
                        {!isRunning && <button onClick={onClose}><X className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>}
                    </div>
                </div>

                {isRunning ? (
                    <div className="p-10 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="relative">
                            <div className="w-32 h-32 rounded-full border-8 border-slate-100 dark:border-slate-800 flex items-center justify-center">
                                <span className={`text-4xl font-black ${countdown > 0 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-200'}`}>
                                    {countdown > 0 ? countdown : currentStep}
                                </span>
                            </div>
                            {countdown === 0 && (
                                <div className="absolute inset-0 rounded-full border-8 border-yellow-500 border-t-transparent animate-spin"></div>
                            )}
                            {countdown > 0 && (
                                <div className="absolute inset-0 rounded-full border-8 border-rose-200 dark:border-rose-900/30"></div>
                            )}
                        </div>
                        
                        <div>
                            <h4 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                                {countdown > 0 ? "Đang nghỉ an toàn (Cooldown)..." : `Đang thực hiện bước ${currentStep}...`}
                            </h4>
                            <p className="text-sm text-slate-500 max-w-xs mx-auto font-medium">
                                {countdown > 0 ? "Chờ hồi phục giới hạn API (Tránh lỗi 429)" : (stepsList.find(s => s.id === currentStep)?.label || stepStatus)}
                            </p>
                        </div>

                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 mt-4">
                            <div className="bg-gradient-to-r from-yellow-400 to-red-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${(currentStep / (totalSteps || 1)) * 100}%` }}></div>
                        </div>
                        
                        {countdown > 0 ? (
                             <div className="flex items-center gap-2 text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-4 py-2 rounded-lg text-xs font-bold animate-pulse">
                                <PauseCircle className="w-4 h-4" /> Hệ thống đang nghỉ ngơi...
                             </div>
                        ) : (
                            <button onClick={() => setIsMinimized(true)} className="text-xs text-slate-400 font-bold uppercase tracking-widest hover:text-indigo-500 transition-colors flex items-center gap-1">
                                <Minimize2 className="w-3 h-3" /> Thu nhỏ để làm việc khác
                            </button>
                        )}

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 w-full">
                            <button onClick={onStop} className="mx-auto px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold shadow-lg shadow-rose-200/50 transition-all flex items-center gap-2 text-sm">
                                <StopCircle className="w-4 h-4" /> Dừng Khẩn Cấp
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {/* Rules Input */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                <Settings className="w-3.5 h-3.5" /> Quy tắc bổ sung (Áp dụng toàn cục)
                            </label>
                            <textarea 
                                className="w-full h-20 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-yellow-400 transition-all resize-none"
                                placeholder="VD: Giữ nguyên tên tiếng Anh, văn phong hài hước, không viết tắt..."
                                value={rules}
                                onChange={e => setRules(e.target.value)}
                            />
                        </div>

                        {/* Step Selection */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                <Settings className="w-3.5 h-3.5" /> Quy trình thực hiện
                            </label>
                            <div className="space-y-2">
                                {stepsList.map(step => (
                                    <div 
                                        key={step.id} 
                                        onClick={() => toggleStep(step.id)}
                                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedSteps.includes(step.id) ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60'}`}
                                    >
                                        <div className={`mt-0.5 ${selectedSteps.includes(step.id) ? 'text-indigo-600' : 'text-slate-400'}`}>
                                            {selectedSteps.includes(step.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <h4 className={`text-sm font-bold ${selectedSteps.includes(step.id) ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-500'}`}>{step.label}</h4>
                                            <p className="text-[10px] text-slate-500">{step.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Translation Mode Selection (Only if Translation step is selected) */}
                        {selectedSteps.includes(4) && (
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Chế độ dịch (Bước 4)</label>
                                <div className="flex gap-2">
                                    {['flash', 'normal', 'pro'].map((t) => (
                                        <button 
                                            key={t}
                                            onClick={() => setTier(t as TranslationTier)}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${tier === t ? 'bg-yellow-400 text-red-700 shadow-md scale-105' : 'bg-white dark:bg-slate-700 text-slate-500'}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-xl flex items-start gap-3 border border-yellow-200 dark:border-yellow-800/50">
                            <ShieldAlert className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-yellow-800 dark:text-yellow-200 leading-relaxed">
                                Hệ thống sẽ tự động nghỉ <b>60 giây</b> sau mỗi bước để hồi phục Quota. 
                                <br/>Ở <b>Bước 2 & 3</b>, hệ thống sẽ mở bảng cấu hình để bạn kiểm tra thông tin trước khi chạy.
                            </p>
                        </div>
                    </div>
                )}

                {!isRunning && (
                    <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
                        <button onClick={onClose} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors">Hủy</button>
                        <button 
                            onClick={() => onStart({ steps: selectedSteps, additionalRules: rules, tier })} 
                            disabled={selectedSteps.length === 0}
                            className="px-8 py-3 bg-yellow-400 hover:bg-yellow-500 text-red-700 rounded-xl font-bold shadow-lg shadow-yellow-200/50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Play className="w-5 h-5 fill-current" /> Chạy Tự Động
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};