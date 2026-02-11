
import React, { useState, useEffect, useRef } from 'react';
import { 
    X, Search, Zap, Activity, Sparkles, GraduationCap, Hammer, LifeBuoy, Split, 
    Microscope, Globe, Tags, Users, Palette, Sword, Book, ImageIcon, Upload, 
    Clipboard, ArrowRight, Layers, AlertCircle, Loader2, CheckCircle, AlertTriangle, 
    Info, Clock, Check, FileText, FileUp, Download, Eye, EyeOff, Terminal, Eraser,
    History, GitCommit, Layout, Replace, Trash2, Save, Brain, ChevronRight, PlayCircle, BookOpen, Feather, Bot, ListFilter, RefreshCw, Wand2, ShieldCheck, Wrench, Scale, Key, Plus,
    HelpCircle, Settings, Play
} from 'lucide-react';
import { StoryInfo, FileItem, FileStatus, TranslationTier, Toast, LogEntry } from '../types';
import { 
    AVAILABLE_LANGUAGES, AVAILABLE_GENRES, AVAILABLE_PERSONALITIES, 
    AVAILABLE_SETTINGS, AVAILABLE_FLOWS, DEFAULT_PROMPT 
} from '../constants';
import { CHANGELOG_DATA } from '../changelog';

const IconMap: Record<string, React.ElementType> = {
    GitCommit, FileText, Split, Sparkles, Eraser, Eye, Layout, Hammer, LifeBuoy, Microscope, Feather, Bot, Terminal: Terminal, Moon: Book, ListFilter, RefreshCw, ShieldCheck, Wrench, Save, Key, Zap, BookA: Book, Scale, HardDrive: Layers, Clock, Activity, Book
};

// --- NEW COMPONENT: SKELETON LOADER ---
const AnalysisSkeleton = () => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Skeleton */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 bg-slate-200 rounded-full animate-pulse shrink-0"></div>
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-1/3 animate-pulse"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2 animate-pulse"></div>
                </div>
            </div>

            {/* Content Skeletons */}
            <div className="space-y-4">
                <div className="h-3 bg-slate-200 rounded w-24 animate-pulse"></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="h-24 bg-slate-100 rounded-xl border border-slate-200 animate-pulse"></div>
                    <div className="h-24 bg-slate-100 rounded-xl border border-slate-200 animate-pulse"></div>
                </div>
            </div>

            <div className="space-y-3">
                <div className="h-3 bg-slate-200 rounded w-32 animate-pulse"></div>
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-lg animate-pulse"></div>
                            <div className="flex-1 h-8 bg-slate-100 rounded-lg animate-pulse"></div>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Progress Simulation */}
            <div className="pt-4 border-t border-slate-100">
                <div className="flex justify-between mb-2">
                    <div className="h-3 bg-slate-200 rounded w-20 animate-pulse"></div>
                    <div className="h-3 bg-slate-200 rounded w-10 animate-pulse"></div>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-400/50 w-2/3 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"></div>
                </div>
            </div>
        </div>
    );
};

export interface LoadingModalProps {
    isOpen: boolean;
    progress: { current: number; total: number; message: string };
}

export const LoadingModal: React.FC<LoadingModalProps> = ({ isOpen, progress }) => {
    if (!isOpen) return null;
    const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center max-w-sm w-full animate-in zoom-in-95 duration-300">
                <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin"></div>
                    <FileText className="absolute inset-0 m-auto w-8 h-8 text-indigo-500 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Đang Xử Lý...</h3>
                <p className="text-sm text-slate-500 mb-6 text-center animate-pulse">{progress.message}</p>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300" style={{ width: `${percent}%` }}></div>
                </div>
                <div className="flex justify-between w-full text-xs font-bold text-slate-400">
                    {progress.total === 100 ? (
                        <span>{Math.round(progress.current)}%</span> 
                    ) : (
                        <span>{progress.current} / {progress.total}</span> 
                    )}
                    <span>{percent}%</span>
                </div>
            </div>
        </div>
    );
};

// ... (LogModal, TagInput, StartOptionsModal, GuideModal, FindReplaceModal, ConfirmationModal, ImportModal, PasteModal, ChangelogModal, ToastContainer unchanged)
export interface LogModalProps { isOpen: boolean; onClose: () => void; logs: LogEntry[]; clearLogs: () => void; }
export const LogModal: React.FC<LogModalProps> = ({ isOpen, onClose, logs, clearLogs }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-700 ring-1 ring-black/50">
                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 text-sky-400 rounded-xl"><Terminal className="w-5 h-5" /></div>
                        <div>
                            <h3 className="font-mono font-bold text-lg text-slate-200">System Deep Logs</h3>
                            <p className="text-xs text-slate-500 font-mono">Nhật ký chi tiết hệ thống (Mới nhất ở trên).</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={clearLogs} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-slate-900 custom-scrollbar font-mono text-xs leading-relaxed space-y-1">
                    {logs.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-700 italic">Trống...</div>
                    ) : (
                        logs.map(log => (
                            <div key={log.id} className="flex gap-3 hover:bg-slate-800/50 p-1 rounded transition-colors border-b border-slate-800/50 pb-1">
                                <span className="text-slate-500 shrink-0 select-none w-20">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                <span className={`break-words flex-1 ${log.type === 'error' ? 'text-rose-400 font-bold' : log.type === 'success' ? 'text-emerald-400' : 'text-slate-300'}`}>
                                    {log.message}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export interface TagInputProps { label: string; icon: React.ReactNode; options: string[]; selected: string[]; onChange: (selected: string[]) => void; placeholder?: string; }
export const TagInput: React.FC<TagInputProps> = ({ label, icon, options, selected, onChange, placeholder }) => { 
    const [inputValue, setInputValue] = useState(''); 
    const [showOptions, setShowOptions] = useState(false); 
    const containerRef = useRef<HTMLDivElement>(null); 
    const handleAdd = (val: string) => { 
        const values = val.split(/[,;]+/).map(v => v.trim()).filter(v => v);
        let newSelected = [...selected];
        values.forEach(v => { if (v && !newSelected.includes(v)) newSelected.push(v); });
        if (newSelected.length !== selected.length) onChange(newSelected);
        setInputValue(''); setShowOptions(false); 
    }; 
    const handleRemove = (val: string) => { onChange(selected.filter(i => i !== val)); }; 
    const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(inputValue); } }; 
    useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(event.target as Node)) setShowOptions(false); }; document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }, []); 
    const filteredOptions = options.filter(opt => !selected.includes(opt) && opt.toLowerCase().includes(inputValue.toLowerCase())); 
    return ( <div className="space-y-1.5 relative" ref={containerRef}> <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"> {icon} {label} </label> <div className="min-h-[38px] px-2 py-1.5 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-sky-200 focus-within:border-sky-300 transition-all flex flex-wrap gap-1.5 shadow-sm"> {selected.map(tag => ( <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold border border-slate-200"> {tag} <button onClick={() => handleRemove(tag)} className="hover:text-rose-500"><X className="w-3 h-3" /></button> </span> ))} <input type="text" className="flex-1 min-w-[60px] bg-transparent outline-none text-xs py-0.5" placeholder={selected.length === 0 ? placeholder : ""} value={inputValue} onChange={e => { setInputValue(e.target.value); setShowOptions(true); }} onFocus={() => setShowOptions(true)} onKeyDown={handleKeyDown} /> </div> {showOptions && (inputValue || filteredOptions.length > 0) && ( <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar p-1"> {filteredOptions.length > 0 ? ( filteredOptions.map(opt => ( <button key={opt} onClick={() => handleAdd(opt)} className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-sky-50 hover:text-sky-700 rounded-lg transition-colors" > {opt} </button> )) ) : ( inputValue && ( <button onClick={() => handleAdd(inputValue)} className="w-full text-left px-3 py-1.5 text-xs text-sky-600 hover:bg-sky-50 rounded-lg font-bold"> Thêm mới "{inputValue}" </button> ) )} </div> )} </div> ); 
};

export interface StartOptionsModalProps { isOpen: boolean; onClose: () => void; onConfirm: (tier: TranslationTier) => void; isSmartMode?: boolean; }
export const StartOptionsModal: React.FC<StartOptionsModalProps> = ({ isOpen, onClose, onConfirm, isSmartMode }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                        {isSmartMode ? <Sparkles className="w-6 h-6 text-indigo-500" /> : <div className="text-sky-500"><Zap className="w-6 h-6" /></div>}
                        {isSmartMode ? "Smart AI Auto-Fix" : "Chọn Cấp Độ Dịch"}
                    </h3>
                    <div className="space-y-3">
                        <button onClick={() => onConfirm('flash')} className="w-full p-4 bg-sky-50 border border-sky-100 hover:bg-sky-100 rounded-2xl flex items-start gap-4 transition-all group text-left">
                            <div className="p-3 bg-white rounded-xl text-sky-500 shadow-sm group-hover:scale-110 transition-transform"><Zap className="w-6 h-6" /></div>
                            <div><h4 className="font-bold text-sky-700 text-sm">Flash Mode</h4><p className="text-xs text-slate-500">Tốc độ tối đa, tiết kiệm Pro.</p></div>
                        </button>
                        <button onClick={() => onConfirm('normal')} className="w-full p-4 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-2xl flex items-start gap-4 transition-all group text-left ring-1 ring-indigo-200">
                            <div className="p-3 bg-white rounded-xl text-indigo-500 shadow-sm group-hover:scale-110 transition-transform"><Activity className="w-6 h-6" /></div>
                            <div><h4 className="font-bold text-indigo-700 text-sm">Normal Mode</h4><p className="text-xs text-slate-500">Dịch bằng Pro Model (Không dùng Flash), tối ưu quota.</p></div>
                        </button>
                        <button onClick={() => onConfirm('pro')} className="w-full p-4 bg-purple-50 border border-purple-100 hover:bg-purple-100 rounded-2xl flex items-start gap-4 transition-all group text-left">
                            <div className="p-3 bg-white rounded-xl text-purple-500 shadow-sm group-hover:scale-110 transition-transform"><Sparkles className="w-6 h-6" /></div>
                            <div><h4 className="font-bold text-purple-700 text-sm">Pro Mode</h4><p className="text-xs text-slate-500">Chất lượng cao nhất, tuân thủ nghiêm ngặt.</p></div>
                        </button>
                    </div>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Hủy</button>
                </div>
            </div>
        </div>
    );
};

export interface GuideModalProps { isOpen: boolean; onClose: () => void; }
export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => { 
    const [activeTab, setActiveTab] = useState<'intro' | 'flow' | 'features' | 'faq'>('intro'); 
    if (!isOpen) return null; 
    
    return ( 
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"> 
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-white/40 ring-1 ring-black/50"> 
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50"> 
                    <div className="flex items-center gap-3"> 
                        <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600"><GraduationCap className="w-6 h-6" /></div> 
                        <div> <h3 className="font-display font-bold text-lg text-slate-800">Hướng Dẫn Sử Dụng (Dành Cho Người Mới)</h3> </div> 
                    </div> 
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button> 
                </div> 
                
                {/* Tabs */}
                <div className="flex border-b border-slate-100 bg-white overflow-x-auto no-scrollbar shrink-0"> 
                    <button onClick={() => setActiveTab('intro')} className={`flex-1 min-w-[120px] py-4 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === 'intro' ? 'border-sky-500 text-sky-600 bg-sky-50/30' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
                        <Info className="w-4 h-4"/> Tổng Quan
                    </button> 
                    <button onClick={() => setActiveTab('flow')} className={`flex-1 min-w-[120px] py-4 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === 'flow' ? 'border-indigo-500 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
                        <Play className="w-4 h-4"/> Quy Trình 4 Bước
                    </button> 
                    <button onClick={() => setActiveTab('features')} className={`flex-1 min-w-[120px] py-4 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === 'features' ? 'border-purple-500 text-purple-600 bg-purple-50/30' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
                        <Zap className="w-4 h-4"/> Tính Năng Hay
                    </button> 
                    <button onClick={() => setActiveTab('faq')} className={`flex-1 min-w-[120px] py-4 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === 'faq' ? 'border-rose-500 text-rose-600 bg-rose-50/30' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
                        <HelpCircle className="w-4 h-4"/> Hỏi Đáp & Lỗi
                    </button> 
                </div> 
                
                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 custom-scrollbar text-sm leading-relaxed text-slate-700">
                    
                    {/* TAB 1: INTRO */}
                    {activeTab === 'intro' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div className="text-center space-y-3 mb-8">
                                <h4 className="font-display font-bold text-2xl text-slate-800">Chào mừng bạn đến với Thế Giới Biên Tập AI</h4>
                                <p className="text-slate-500 max-w-2xl mx-auto">
                                    Đây không phải là Google Translate. Đây là một <b>"Xưởng Biên Tập Ảo"</b> nơi AI đóng vai trò là Biên tập viên chuyên nghiệp, giúp bạn dịch và chỉnh sửa truyện với văn phong như người thật.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-4"><Brain className="w-6 h-6"/></div>
                                    <h5 className="font-bold text-lg text-slate-800 mb-2">Thông Minh Hơn</h5>
                                    <p className="text-slate-600">AI hiểu ngữ cảnh, tự động nhận biết tên nhân vật, chiêu thức và xưng hô (Huynh/Muội, Ta/Nàng) tùy theo thể loại truyện.</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-4"><Sparkles className="w-6 h-6"/></div>
                                    <h5 className="font-bold text-lg text-slate-800 mb-2">Văn Phong Sách In</h5>
                                    <p className="text-slate-600">Không còn văn phong "máy móc". AI được huấn luyện để viết văn chương trôi chảy, giàu cảm xúc, chuẩn định dạng xuất bản.</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-4"><Zap className="w-6 h-6"/></div>
                                    <h5 className="font-bold text-lg text-slate-800 mb-2">Tự Động Hóa (Auto)</h5>
                                    <p className="text-slate-600">Chỉ cần 1 cú click chuột. Hệ thống sẽ tự động Phân tích -> Dịch -> Sửa lỗi -> Định dạng mà bạn không cần can thiệp.</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                    <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 mb-4"><ShieldCheck className="w-6 h-6"/></div>
                                    <h5 className="font-bold text-lg text-slate-800 mb-2">An Toàn & Riêng Tư</h5>
                                    <p className="text-slate-600">Dữ liệu của bạn được lưu ngay trên trình duyệt (Local). Không ai có thể xem nội dung truyện của bạn.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: FLOW */}
                    {activeTab === 'flow' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <h4 className="font-bold text-xl text-indigo-700 mb-4">Quy Trình 4 Bước Đơn Giản</h4>
                            
                            <div className="relative border-l-2 border-slate-200 ml-3 space-y-10 pl-8 py-2">
                                {/* Step 1 */}
                                <div className="relative">
                                    <span className="absolute -left-[41px] w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm ring-4 ring-white">1</span>
                                    <h5 className="font-bold text-lg text-slate-800">Nhập Liệu (Import)</h5>
                                    <p className="text-slate-600 mt-1">Kéo thả file truyện (TXT, DOCX, EPUB, PDF) vào màn hình chính. Nếu file quá lớn, App sẽ tự động cắt nhỏ.</p>
                                    <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 border border-blue-100">
                                        💡 Mẹo: Nên đặt tên file chuẩn (VD: "Chuong 1.txt") để App tự nhận diện số chương.
                                    </div>
                                </div>

                                {/* Step 2 */}
                                <div className="relative">
                                    <span className="absolute -left-[41px] w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm ring-4 ring-white">2</span>
                                    <h5 className="font-bold text-lg text-slate-800">Cấu Hình Tự Động (Auto Setup)</h5>
                                    <p className="text-slate-600 mt-1">Nhấn nút màu vàng <b className="text-amber-600">AUTO</b> ở dưới cùng. Đây là bước quan trọng nhất.</p>
                                    <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-600">
                                        <li><b>Auto Phân Tích:</b> AI đọc lướt truyện để tìm tên Nhân vật, Địa danh, Cấp độ.</li>
                                        <li><b>Prompt Architect:</b> AI tự thiết kế "Câu lệnh" (Prompt) dịch thuật tối ưu cho riêng truyện này.</li>
                                    </ul>
                                </div>

                                {/* Step 3 */}
                                <div className="relative">
                                    <span className="absolute -left-[41px] w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm ring-4 ring-white">3</span>
                                    <h5 className="font-bold text-lg text-slate-800">Chạy Dịch Thuật (Run)</h5>
                                    <p className="text-slate-600 mt-1">Sau khi Auto xong, nhấn <b>"Chạy Tự Động"</b> hoặc đóng cửa sổ Auto và nhấn nút <b>"BẮT ĐẦU"</b> ở góc phải.</p>
                                    <div className="mt-3 flex gap-4">
                                        <div className="flex-1 bg-slate-100 p-3 rounded-lg text-xs">
                                            <b className="block text-slate-700 mb-1">Flash Mode</b>
                                            Tốc độ cao. Dùng cho bản nháp hoặc truyện dễ.
                                        </div>
                                        <div className="flex-1 bg-indigo-50 p-3 rounded-lg text-xs border border-indigo-100">
                                            <b className="block text-indigo-700 mb-1">Normal Mode (Khuyên dùng)</b>
                                            Cân bằng. Dịch bằng model xịn, sửa lỗi bằng model nhanh.
                                        </div>
                                    </div>
                                </div>

                                {/* Step 4 */}
                                <div className="relative">
                                    <span className="absolute -left-[41px] w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm ring-4 ring-white">4</span>
                                    <h5 className="font-bold text-lg text-slate-800">Xuất Bản (Export)</h5>
                                    <p className="text-slate-600 mt-1">Khi dịch xong (File hiện màu xanh lá), bạn có thể tải về.</p>
                                    <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-600">
                                        <li><b>EPUB:</b> Tạo Ebook chuẩn có mục lục và bìa (để đọc trên điện thoại/Kindle).</li>
                                        <li><b>GỘP:</b> Tạo 1 file .txt duy nhất chứa tất cả chương.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: FEATURES */}
                    {activeTab === 'features' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <h4 className="font-bold text-xl text-purple-700 mb-4">Các Công Cụ Quyền Năng</h4>
                            
                            <div className="grid grid-cols-1 gap-4">
                                <div className="flex gap-4 bg-white p-4 rounded-xl border border-slate-200">
                                    <div className="p-3 bg-amber-100 text-amber-600 rounded-lg h-fit"><Hammer className="w-5 h-5"/></div>
                                    <div>
                                        <h5 className="font-bold text-slate-800">Smart Fix (Sửa Lỗi Thông Minh)</h5>
                                        <p className="text-slate-600 mt-1">Nút hình cái búa. Dùng khi file đã dịch xong nhưng vẫn còn sót tiếng Trung/Anh hoặc lỗi xưng hô. Nó sẽ quét và sửa lại mà không cần dịch lại từ đầu.</p>
                                    </div>
                                </div>

                                <div className="flex gap-4 bg-white p-4 rounded-xl border border-slate-200">
                                    <div className="p-3 bg-blue-100 text-blue-600 rounded-lg h-fit"><BookOpen className="w-5 h-5"/></div>
                                    <div>
                                        <h5 className="font-bold text-slate-800">Tab Tri Thức (Knowledge Base)</h5>
                                        <p className="text-slate-600 mt-1">Nơi chứa "Bộ não" của AI. Bạn có thể vào đây để sửa tên nhân vật (Glossary) hoặc thêm ghi chú ngữ cảnh (Context) nếu AI dịch sai tên.</p>
                                    </div>
                                </div>

                                <div className="flex gap-4 bg-white p-4 rounded-xl border border-slate-200">
                                    <div className="p-3 bg-rose-100 text-rose-600 rounded-lg h-fit"><RefreshCw className="w-5 h-5"/></div>
                                    <div>
                                        <h5 className="font-bold text-slate-800">Dịch Lại & Cứu Hộ</h5>
                                        <p className="text-slate-600 mt-1">Nếu 1 chương dịch quá tệ? Chọn file đó và nhấn nút "Dịch Lại". Hoặc dùng nút "Cứu Hộ" (Phao cứu sinh) trong Editor để copy prompt và nhờ ChatGPT bên ngoài dịch hộ.</p>
                                    </div>
                                </div>
                                
                                <div className="flex gap-4 bg-white p-4 rounded-xl border border-slate-200">
                                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg h-fit"><Layout className="w-5 h-5"/></div>
                                    <div>
                                        <h5 className="font-bold text-slate-800">Editor Song Song</h5>
                                        <p className="text-slate-600 mt-1">Bấm vào tên file để mở trình chỉnh sửa. Bên trái là bản gốc, bên phải là bản dịch. Có chế độ soi lỗi Raw và đồng bộ cuộn.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: FAQ */}
                    {activeTab === 'faq' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <h4 className="font-bold text-xl text-rose-700 mb-4">Các Lỗi Thường Gặp & Cách Xử Lý</h4>
                            
                            <div className="space-y-4">
                                <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                                    <h5 className="font-bold text-rose-800 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Lỗi 429 (Resource Exhausted)</h5>
                                    <p className="text-slate-700 mt-2 text-sm">
                                        <b>Nguyên nhân:</b> Google giới hạn số lượt dùng miễn phí mỗi phút/ngày. <br/>
                                        <b>Giải pháp:</b> App có tính năng <b>Smart Wait</b>. Nếu thấy huy hiệu trên cùng hiện "Chờ 60s", hãy kiên nhẫn. App đang "ngủ" để hồi phục. Đừng tắt tab.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <h5 className="font-bold text-slate-800 flex items-center gap-2"><HelpCircle className="w-4 h-4"/> Dịch bị sót tên, sai xưng hô?</h5>
                                    <p className="text-slate-600 mt-2 text-sm">
                                        Vào Tab <b>Tri Thức</b> -> Sửa lại trong bảng Từ Điển (Glossary). Sau đó chọn các file bị sai và nhấn <b>Smart Fix</b>.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <h5 className="font-bold text-slate-800 flex items-center gap-2"><HelpCircle className="w-4 h-4"/> Có cần treo máy không?</h5>
                                    <p className="text-slate-600 mt-2 text-sm">
                                        <b>Có.</b> Vì đây là Web App chạy trên trình duyệt của bạn, bạn cần giữ Tab mở để nó hoạt động. Tuy nhiên, bạn có thể chuyển sang Tab khác làm việc, nó vẫn chạy ngầm.
                                    </p>
                                </div>
                                
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <h5 className="font-bold text-slate-800 flex items-center gap-2"><HelpCircle className="w-4 h-4"/> Làm sao để lưu dữ liệu?</h5>
                                    <p className="text-slate-600 mt-2 text-sm">
                                        App tự động lưu sau mỗi 2 giây. Nhưng để chắc ăn, hãy nhấn nút <b>Backup (.json)</b> ở Tab <b>Thông Tin</b> để tải file dự phòng về máy tính.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div> 
            </div> 
        </div> 
    ); 
};

// ... (FindReplaceModal, ConfirmationModal, ImportModal, PasteModal, ChangelogModal, ToastContainer unchanged)
export interface FindReplaceModalProps { 
    isOpen: boolean; 
    onClose: () => void; 
    onReplace: (pairs: {find: string, replace: string}[], scope: 'all' | 'selected') => void; 
    selectedCount: number; 
}

export const FindReplaceModal: React.FC<FindReplaceModalProps> = ({ isOpen, onClose, onReplace, selectedCount }) => {
    const [pairs, setPairs] = useState<{id: string, find: string, replace: string}[]>([{id: '1', find: '', replace: ''}]);

    const handleAddPair = () => {
        setPairs([...pairs, {id: crypto.randomUUID(), find: '', replace: ''}]);
    };

    const handleRemovePair = (id: string) => {
        if (pairs.length > 1) {
            setPairs(pairs.filter(p => p.id !== id));
        }
    };

    const handleChange = (id: string, field: 'find' | 'replace', value: string) => {
        setPairs(pairs.map(p => p.id === id ? {...p, [field]: value} : p));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">Tìm & Thay Thế Nâng Cao</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    {pairs.map((pair, index) => (
                        <div key={pair.id} className="flex gap-2 items-start animate-in fade-in slide-in-from-left-4">
                            <span className="text-xs font-bold text-slate-300 mt-3 w-4">{index + 1}.</span>
                            <div className="flex-1 grid grid-cols-2 gap-2">
                                <input 
                                    className="w-full p-2 border rounded text-sm bg-slate-50 focus:bg-white transition-colors" 
                                    placeholder="Tìm kiếm..." 
                                    value={pair.find} 
                                    onChange={e => handleChange(pair.id, 'find', e.target.value)} 
                                />
                                <input 
                                    className="w-full p-2 border rounded text-sm bg-slate-50 focus:bg-white transition-colors" 
                                    placeholder="Thay thế bằng..." 
                                    value={pair.replace} 
                                    onChange={e => handleChange(pair.id, 'replace', e.target.value)} 
                                />
                            </div>
                            {pairs.length > 1 && (
                                <button onClick={() => handleRemovePair(pair.id)} className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 mt-0.5">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                    
                    <button onClick={handleAddPair} className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors ml-6">
                        <Plus className="w-3 h-3" /> Thêm Dòng
                    </button>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50">
                    <div className="flex flex-col gap-2">
                        <button onClick={() => { if(pairs.some(p => p.find)) { onReplace(pairs, 'all'); onClose(); } }} className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold shadow-lg shadow-sky-200/50 transition-all">
                            Thay Thế Tất Cả
                        </button>
                        {selectedCount > 0 && (
                            <button onClick={() => { if(pairs.some(p => p.find)) { onReplace(pairs, 'selected'); onClose(); } }} className="w-full py-3 bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 rounded-xl font-bold transition-all">
                                Chỉ Thay {selectedCount} File Đang Chọn
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export interface ConfirmationModalProps { isOpen: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void; isDanger?: boolean; confirmText?: string; }
export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, title, message, onConfirm, onCancel, isDanger, confirmText }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-center">
                <h3 className="font-bold text-xl text-slate-800 mb-2">{title}</h3>
                <p className="text-sm text-slate-600 mb-6">{message}</p>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl">Hủy</button>
                    <button onClick={onConfirm} className={`flex-1 py-3 text-white font-bold rounded-xl ${isDanger ? 'bg-rose-500' : 'bg-sky-500'}`}>{confirmText || 'Xác Nhận'}</button>
                </div>
            </div>
        </div>
    );
}

export interface ImportModalProps { isOpen: boolean; count: number; onAppend: () => void; onOverwrite: () => void; onCancel: () => void; }
export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, count, onAppend, onOverwrite, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 p-6">
                <h3 className="font-bold text-lg text-slate-800 mb-4">Nhập {count} file mới</h3>
                <div className="space-y-3">
                    <button onClick={onAppend} className="w-full p-4 bg-sky-50 border border-sky-100 rounded-2xl text-left font-bold text-sky-700">Nối tiếp (Append)</button>
                    <button onClick={onOverwrite} className="w-full p-4 bg-rose-50 border border-rose-100 rounded-2xl text-left font-bold text-rose-700">Tạo Mới (Overwrite)</button>
                </div>
                <button onClick={onCancel} className="w-full mt-4 py-3 text-slate-400 font-bold">Hủy bỏ</button>
            </div>
        </div>
    );
}

export interface PasteModalProps { isOpen: boolean; onClose: () => void; onConfirm: (title: string, content: string) => void; }
export const PasteModal: React.FC<PasteModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-6">
                <h3 className="font-bold text-lg mb-4">Dán Nội Dung</h3>
                <input className="w-full mb-3 p-2 border rounded" placeholder="Tiêu đề" value={title} onChange={e => setTitle(e.target.value)} />
                <textarea className="w-full h-64 p-2 border rounded resize-none" placeholder="Nội dung..." value={content} onChange={e => setContent(e.target.value)} />
                <div className="flex justify-end gap-3 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold">Hủy</button>
                    <button onClick={() => { if(content.trim()) { onConfirm(title, content); onClose(); setTitle(''); setContent(''); } }} className="px-6 py-2 bg-indigo-600 text-white rounded font-bold">Xác Nhận</button>
                </div>
            </div>
        </div>
    );
}

export interface ChangelogModalProps { isOpen: boolean; onClose: () => void; }
export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><History className="w-5 h-5" /></div>
                        <div><h3 className="font-display font-bold text-lg text-slate-800">Nhật Ký Thay Đổi</h3></div>
                    </div>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                    {CHANGELOG_DATA.map((entry, idx) => (
                        <div key={idx} className="mb-6 last:mb-0">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-lg text-[10px] font-bold">v{entry.version}</span>
                                <h4 className="font-bold text-slate-800">{entry.title}</h4>
                            </div>
                            <ul className="space-y-3 ml-1">
                                {entry.changes.map((c, i) => {
                                    const Icon = IconMap[c.icon] || Info;
                                    return (
                                        <li key={i} className="text-sm text-slate-600 flex gap-3">
                                            <div className="p-1.5 bg-slate-50 rounded-lg shrink-0 h-fit"><Icon className="w-3.5 h-3.5 text-indigo-500" /></div>
                                            <div className="pt-0.5"><b>{c.bold}</b> {c.text}</div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export interface ToastContainerProps { toasts: Toast[]; removeToast: (id: string) => void; }
export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
    return (
        <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
            {toasts.map(toast => (
                <div key={toast.id} className={`pointer-events-auto min-w-[300px] max-w-sm p-4 rounded-xl shadow-lg border flex items-start gap-3 animate-in slide-in-from-right duration-300 ${toast.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-800' : toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : toast.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-white border-slate-100 text-slate-800'}`}>
                    <div className="flex-1 text-sm font-medium">{toast.message}</div>
                    <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                </div>
            ))}
        </div>
    );
};

// ... (Other unchanged sub-components like StoryInfoFields, SamplingFields, SmartStartModal, NameAnalysisModal)
const StoryInfoFields = ({ info, setInfo }: { info: StoryInfo, setInfo: (v: StoryInfo) => void }) => {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tên Truyện</label><input className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold shadow-sm" value={info.title} onChange={e => setInfo({...info, title: e.target.value})} /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tác Giả</label><input className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm shadow-sm" value={info.author} onChange={e => setInfo({...info, author: e.target.value})} /></div>
            </div>
            <TagInput label="Ngôn ngữ truyện" icon={<Globe className="w-3.5 h-3.5" />} options={AVAILABLE_LANGUAGES} selected={info.languages} onChange={v => setInfo({...info, languages: v})} />
            <div className="grid grid-cols-2 gap-3">
                <TagInput label="Thể loại" icon={<Tags className="w-3.5 h-3.5" />} options={AVAILABLE_GENRES} selected={info.genres} onChange={v => setInfo({...info, genres: v})} />
                <TagInput label="Tính cách Main" icon={<Users className="w-3.5 h-3.5" />} options={AVAILABLE_PERSONALITIES} selected={info.mcPersonality} onChange={v => setInfo({...info, mcPersonality: v})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <TagInput label="Bối cảnh" icon={<Palette className="w-3.5 h-3.5" />} options={AVAILABLE_SETTINGS} selected={info.worldSetting} onChange={v => setInfo({...info, worldSetting: v})} />
                <TagInput label="Lưu phái" icon={<Sword className="w-3.5 h-3.5" />} options={AVAILABLE_FLOWS} selected={info.sectFlow} onChange={v => setInfo({...info, sectFlow: v})} />
            </div>
            <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex justify-between items-center">
                    <span>Quy tắc bổ sung (Nếu có)</span>
                    <span className="text-[9px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded">Tailor-Made</span>
                </label>
                <textarea 
                    className="w-full h-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 resize-none outline-none focus:ring-2 focus:ring-sky-200 transition-all shadow-sm" 
                    placeholder="- Main tên John, không phải Gioan...&#10;- Giữ nguyên tên chiêu thức..." 
                    value={info.additionalRules || ''} 
                    onChange={e => setInfo({...info, additionalRules: e.target.value})}
                />
            </div>
        </div>
    );
};

const SamplingFields = ({ head, mid, tail, setHead, setMid, setTail }: any) => {
    return (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><Layers className="w-3.5 h-3.5"/> Phạm vi lấy mẫu (Lượng chương AI sẽ đọc)</label>
            <div className="flex items-center gap-4">
                <div className="flex-1 flex flex-col items-center">
                    <span className="text-[9px] text-slate-400 font-bold mb-1">ĐẦU TRUYỆN</span>
                    <input type="number" className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center text-sm font-bold shadow-sm" value={head} onChange={e => setHead(parseInt(e.target.value) || 0)} />
                </div>
                <div className="flex-1 flex flex-col items-center">
                    <span className="text-[9px] text-slate-400 font-bold mb-1">GIỮA TRUYỆN</span>
                    <input type="number" className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center text-sm font-bold shadow-sm" value={mid} onChange={e => setMid(parseInt(e.target.value) || 0)} />
                </div>
                <div className="flex-1 flex flex-col items-center">
                    <span className="text-[9px] text-slate-400 font-bold mb-1">CUỐI TRUYỆN</span>
                    <input type="number" className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center text-sm font-bold shadow-sm" value={tail} onChange={e => setTail(parseInt(e.target.value) || 0)} />
                </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic text-center">AI sẽ tự động lọc bỏ các file trùng lặp và sắp xếp theo thứ tự.</p>
        </div>
    );
};

export interface SmartStartModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (useSearch: boolean, additionalRules: string, sampling: {start: number, middle: number, end: number}) => void;
    onSkip: () => void;
    storyInfo: StoryInfo;
    setStoryInfo: React.Dispatch<React.SetStateAction<StoryInfo>>;
    autoOptimize: boolean;
    setAutoOptimize: (v: boolean) => void;
    step: 'idle' | 'optimizing' | 'analyzing';
}
export const SmartStartModal: React.FC<SmartStartModalProps> = ({ isOpen, onClose, onConfirm, onSkip, storyInfo, setStoryInfo, autoOptimize, setAutoOptimize, step }) => {
    const [useSearch, setUseSearch] = useState(false);
    const [sampleHead, setSampleHead] = useState(100);
    const [sampleMid, setSampleMid] = useState(100);
    const [sampleTail, setSampleTail] = useState(100);
    if (!isOpen) return null;
    const isRunning = step !== 'idle';
    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 relative flex flex-col max-h-[95vh]">
                {isRunning && (
                    <div className="absolute inset-0 bg-white/95 z-[70] flex flex-col items-center justify-center p-8 text-center">
                        <div className="relative mb-6">
                            <div className="w-20 h-20 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin"></div>
                            <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-indigo-500 animate-pulse" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">{step === 'optimizing' ? "Đang Tối Ưu Prompt..." : "Đang Phân Tích Cốt Truyện..."}</h3>
                        <p className="text-sm text-slate-500">Vui lòng không đóng cửa sổ này...</p>
                    </div>
                )}
                
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/30">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Brain className="w-5 h-5 text-indigo-500"/> Smart Start AI Configuration</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">1. Thông tin truyện</label>
                        <StoryInfoFields info={storyInfo} setInfo={setStoryInfo} />
                    </div>
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">2. Phạm vi phân tích</label>
                        <SamplingFields head={sampleHead} mid={sampleMid} tail={sampleTail} setHead={setSampleHead} setMid={setSampleMid} setTail={setSampleTail} />
                    </div>
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">3. Tùy chọn nâng cao</label>
                        <div className="grid grid-cols-2 gap-3">
                            <label className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${autoOptimize ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                                <input type="checkbox" checked={autoOptimize} onChange={e => setAutoOptimize(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
                                <div className="text-xs">
                                    <span className="font-bold text-indigo-700 block">Prompt Architect</span>
                                    <span className="text-[9px] text-slate-500">Tự động thiết kế Prompt riêng</span>
                                </div>
                            </label>
                            <label className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${useSearch ? 'bg-sky-50 border-sky-200' : 'bg-white border-slate-200'}`}>
                                <input type="checkbox" checked={useSearch} onChange={e => setUseSearch(e.target.checked)} className="w-4 h-4 text-sky-600 rounded" />
                                <div className="text-xs">
                                    <span className="font-bold text-sky-700 block">Google Search</span>
                                    <span className="text-[9px] text-slate-500">Truy tìm thực thể (Gemini 3 Pro)</span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                     <button onClick={onSkip} className="px-6 py-2.5 text-slate-400 font-bold hover:text-slate-600 text-sm">Bỏ Qua</button>
                     <button onClick={() => onConfirm(useSearch, storyInfo.additionalRules || "", {start: sampleHead, middle: sampleMid, end: sampleTail})} className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200/50 transition-all flex items-center justify-center gap-2">
                        <Sparkles className="w-5 h-5" /> Kích Hoạt Smart Start
                    </button>
                </div>
            </div>
        </div>
    );
}

export interface NameAnalysisModalProps { isOpen: boolean; onClose: () => void; onConfirm: (config: any) => void; isAnalyzing: boolean; progress: { current: number; total: number; stage: string }; storyInfo: StoryInfo; totalFiles: number; }
export const NameAnalysisModal: React.FC<NameAnalysisModalProps> = ({ isOpen, onClose, onConfirm, isAnalyzing, progress, storyInfo, totalFiles }) => {
    const [mode, setMode] = useState<'only_char' | 'full' | 'deep_context'>('deep_context');
    const [scope, setScope] = useState<'smart' | 'range' | 'full'>('smart');
    const [rangeStart, setRangeStart] = useState(1);
    const [rangeEnd, setRangeEnd] = useState(Math.min(100, totalFiles));
    const [useSearch, setUseSearch] = useState(false);
    const [sampleHead, setSampleHead] = useState(100), [sampleMid, setSampleMid] = useState(100), [sampleTail, setSampleTail] = useState(100);
    const [localInfo, setLocalInfo] = useState(storyInfo);
    
    useEffect(() => { if(isOpen) setLocalInfo(storyInfo); }, [isOpen, storyInfo]);
    
    if (!isOpen) return null;
    const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    
    return (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative flex flex-col max-h-[95vh]">
                
                {/* Use SKELETON LOADER instead of basic Spinner Overlay */}
                {isAnalyzing && (
                     <div className="absolute inset-0 bg-white/95 z-[70] flex flex-col p-8 animate-in fade-in duration-300">
                        <div className="w-full text-center mb-8">
                            <div className="flex justify-between text-xs font-bold text-slate-500 mb-2"><span>AI đang phân tích & trích xuất dữ liệu...</span><span>{percentage}%</span></div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner"><div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300" style={{ width: `${percentage}%` }}></div></div>
                            <p className="mt-2 text-sm font-bold text-slate-600 animate-pulse">{progress.stage}</p>
                        </div>
                        {/* THE SKELETON UI */}
                        <div className="flex-1 overflow-hidden relative">
                            <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white to-transparent z-10"></div>
                            <AnalysisSkeleton />
                            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent z-10"></div>
                        </div>
                    </div>
                )}
                
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50/30">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Microscope className="w-5 h-5 text-amber-500"/> Deep AI Analysis Panel</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-8">
                    {/* ... (Existing Form Content - Unchanged) ... */}
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Zap className="w-3.5 h-3.5"/> Bước 1: Chọn Chế Độ Phân Tích</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                             <button onClick={() => setMode('deep_context')} className={`p-4 rounded-2xl border flex items-start gap-4 transition-all text-left group ${mode === 'deep_context' ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200 shadow-md' : 'bg-white border-slate-200 hover:border-amber-200'}`}>
                                <div className={`mt-1 p-2 rounded-xl transition-colors ${mode === 'deep_context' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-600 group-hover:bg-amber-200'}`}><BookOpen className="w-6 h-6" /></div>
                                <div><div className="font-bold text-sm text-slate-800">Phân Tích Ngữ Cảnh</div><p className="text-[10px] text-slate-500 mt-1 font-medium leading-relaxed">Xây dựng Series Bible (Nhân vật, Xưng hô, Cốt truyện).</p></div>
                            </button>
                            <button onClick={() => setMode('full')} className={`p-4 rounded-2xl border flex items-start gap-4 transition-all text-left group ${mode === 'full' ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200 shadow-md' : 'bg-white border-slate-200 hover:border-emerald-200'}`}>
                                <div className={`mt-1 p-2 rounded-xl transition-colors ${mode === 'full' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200'}`}><Tags className="w-6 h-6" /></div>
                                <div><div className="font-bold text-sm text-slate-800">Trích Xuất Từ Điển</div><p className="text-[10px] text-slate-500 mt-1 font-medium leading-relaxed">Quét toàn bộ tên riêng, chiêu thức, địa danh nguyên bản.</p></div>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Feather className="w-3.5 h-3.5"/> Bước 2: Cập Nhật Metadata (Tùy chọn)</label>
                        <StoryInfoFields info={localInfo} setInfo={setLocalInfo} />
                    </div>

                    <div className="space-y-4">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><ListFilter className="w-3.5 h-3.5"/> Bước 3: Phạm Vi Quét</label>
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1.5 shadow-inner">
                             <button onClick={() => setScope('smart')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${scope === 'smart' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Smart Sampling (Nhanh)</button>
                             <button onClick={() => setScope('range')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${scope === 'range' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Khoảng cụ thể</button>
                             <button onClick={() => setScope('full')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${scope === 'full' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Toàn Bộ</button>
                        </div>

                        {scope === 'smart' && <SamplingFields head={sampleHead} mid={sampleMid} tail={sampleTail} setHead={setSampleHead} setMid={setSampleMid} setTail={setSampleTail} />}
                        
                        {scope === 'range' && (
                             <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner">
                                <div className="flex-1 flex flex-col items-center">
                                    <span className="text-[9px] text-slate-400 font-bold mb-1 uppercase">Từ chương</span>
                                    <input type="number" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-center text-sm font-bold shadow-sm" value={rangeStart} onChange={e => setRangeStart(parseInt(e.target.value) || 1)} min={1} />
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300 mt-5" />
                                <div className="flex-1 flex flex-col items-center">
                                    <span className="text-[9px] text-slate-400 font-bold mb-1 uppercase">Đến chương</span>
                                    <input type="number" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-center text-sm font-bold shadow-sm" value={rangeEnd} onChange={e => setRangeEnd(parseInt(e.target.value) || 1)} min={rangeStart} />
                                </div>
                            </div>
                        )}

                        <div className="pt-2">
                            <label className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all shadow-sm ${useSearch ? 'bg-sky-50 border-sky-200' : 'bg-white border-slate-200'}`}>
                                <input type="checkbox" checked={useSearch} onChange={e => setUseSearch(e.target.checked)} className="w-5 h-5 text-sky-600 rounded" />
                                <div className="text-xs">
                                    <span className="font-bold text-sky-700 block">Kích hoạt AI Search (Google Grounding)</span>
                                    <span className="text-[10px] text-slate-500">AI sẽ tự tra cứu thông tin thực thể, địa danh ngoài đời thực để dịch chính xác hơn. (Khuyên dùng Gemini 3 Pro)</span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-6 py-2.5 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-xl transition-colors">Đóng</button>
                    <button onClick={() => onConfirm({mode, scope, rangeStart, rangeEnd, updatedStoryInfo: localInfo, useSearch, sampling: {start: sampleHead, middle: sampleMid, end: sampleTail}})} className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-200/50 hover:shadow-orange-200/80 transition-all flex items-center gap-2"><PlayCircle className="w-5 h-5" /> Kích Hoạt Phân Tích</button>
                </div>
            </div>
        </div>
    );
}
