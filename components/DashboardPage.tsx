
import React from 'react';
import { 
    ImageIcon, Upload, RefreshCw, Download, Sparkles, Loader2, 
    Archive, ArchiveRestore, Trash2, Globe, Tags, Users, Palette, Sword,
    Wand2, Save, FileUp, GraduationCap
} from 'lucide-react';
import { StoryInfo } from '../types';
import { TagInput } from './Modals';
import { AVAILABLE_LANGUAGES, AVAILABLE_GENRES, AVAILABLE_PERSONALITIES, AVAILABLE_SETTINGS, AVAILABLE_FLOWS } from '../constants';

interface DashboardPageProps {
    storyInfo: StoryInfo;
    setStoryInfo: React.Dispatch<React.SetStateAction<StoryInfo>>;
    coverPreviewUrl: string | null;
    handleCoverUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleAutoAnalyze: () => void;
    isAutoAnalyzing: boolean;
    autoAnalyzeStatus: string;
    quickInput: string;
    setQuickInput: (v: string) => void;
    handleQuickParse: () => void;
    handleRegenerateCover: () => void;
    isGeneratingCover: boolean;
    handleBackup: () => void;
    handleRestore: (e: React.ChangeEvent<HTMLInputElement>) => void;
    requestResetApp: () => void;
    setShowGuide: (v: boolean) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = (props) => {
    
    const handleDownloadCover = (e: React.MouseEvent) => {
        e.preventDefault();
        if (props.coverPreviewUrl) {
            const link = document.createElement('a');
            link.href = props.coverPreviewUrl;
            link.download = `Cover_${props.storyInfo.title || 'AI_Art'}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-xl md:text-2xl font-display font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <FileUp className="w-6 h-6 text-indigo-500" /> Thông Tin Tác Phẩm
                </h2>
                <button onClick={() => props.setShowGuide(true)} className="px-4 py-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors shadow-sm flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" /> Hướng Dẫn Sử Dụng
                </button>
            </div>

            {/* Main Compact Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 md:p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col md:flex-row gap-6">
                    
                    {/* Compact Cover Section (Fixed Width on Desktop) */}
                    <div className="w-full md:w-48 shrink-0 flex flex-col gap-3">
                        <div className="aspect-[2/3] w-full bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 relative overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors shadow-inner">
                            {props.isGeneratingCover && (
                                <div className="absolute inset-0 z-20 bg-white/80 dark:bg-slate-900/80 flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                                    <span className="text-[10px] font-bold text-indigo-600">Đang vẽ...</span>
                                </div>
                            )}
                            
                            {props.coverPreviewUrl ? (
                                <img src={props.coverPreviewUrl} alt="Cover" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                                    <ImageIcon className="w-8 h-8 mb-2" />
                                    <span className="text-[10px] font-bold uppercase text-center px-2">Chưa có ảnh</span>
                                </div>
                            )}

                            {/* Hover Actions */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-10 p-2">
                                <label className="w-full py-1.5 bg-white/20 hover:bg-white text-white hover:text-slate-900 rounded-lg cursor-pointer text-[10px] font-bold backdrop-blur-md transition-all flex items-center justify-center gap-1">
                                    <Upload className="w-3 h-3" /> Tải Lên
                                    <input type="file" accept="image/*" className="hidden" onChange={props.handleCoverUpload} />
                                </label>
                                <button onClick={props.handleRegenerateCover} className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer text-[10px] font-bold shadow-lg transition-all flex items-center justify-center gap-1">
                                    <RefreshCw className="w-3 h-3" /> Vẽ Lại
                                </button>
                                {props.coverPreviewUrl && (
                                    <button onClick={handleDownloadCover} className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer text-[10px] font-bold shadow-lg transition-all flex items-center justify-center gap-1">
                                        <Download className="w-3 h-3" /> Lưu
                                    </button>
                                )}
                            </div>
                        </div>

                         <button onClick={props.handleAutoAnalyze} disabled={props.isAutoAnalyzing} className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                            {props.isAutoAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} 
                            {props.isAutoAnalyzing ? "Đang xử lý..." : "Auto Phân Tích"}
                        </button>
                    </div>

                    {/* Info Inputs Section */}
                    <div className="flex-1 flex flex-col gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block ml-1">Tên Truyện</label>
                                <input type="text" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm" value={props.storyInfo.title} onChange={e => props.setStoryInfo({...props.storyInfo, title: e.target.value})} placeholder="Nhập tên truyện..." />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block ml-1">Tác Giả</label>
                                <input type="text" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm" value={props.storyInfo.author} onChange={e => props.setStoryInfo({...props.storyInfo, author: e.target.value})} placeholder="Tên tác giả..." />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block ml-1">Tóm Tắt (Summary)</label>
                            <textarea className="w-full h-20 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 focus:bg-white dark:focus:bg-slate-900 transition-all resize-none custom-scrollbar" placeholder="Nội dung tóm tắt (Dùng cho tạo bìa và giới thiệu Ebook)..." value={props.storyInfo.summary || ''} onChange={e => props.setStoryInfo({...props.storyInfo, summary: e.target.value})} />
                        </div>

                        <div className="relative">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block ml-1">Nhập nhanh Thẻ (Paste Text)</label>
                            <input type="text" className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition-all shadow-sm" placeholder="VD: Tiên Hiệp, Hệ Thống, Hài Hước..." value={props.quickInput} onChange={e => props.setQuickInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), props.handleQuickParse())} />
                            <button onClick={props.handleQuickParse} className="absolute bottom-1.5 right-1.5 p-1.5 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900 dark:hover:bg-indigo-800 text-indigo-600 dark:text-indigo-300 rounded-lg transition-colors"><Wand2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Classification */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 md:p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-display font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Tags className="w-5 h-5 text-emerald-500" /> Phân Loại Chi Tiết
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                    <TagInput label="Ngôn ngữ truyện" icon={<Globe className="w-3.5 h-3.5" />} options={AVAILABLE_LANGUAGES} selected={props.storyInfo.languages} onChange={v => props.setStoryInfo({...props.storyInfo, languages: v})} placeholder="Chọn..." />
                    <TagInput label="Thể loại" icon={<Tags className="w-3.5 h-3.5" />} options={AVAILABLE_GENRES} selected={props.storyInfo.genres} onChange={v => props.setStoryInfo({...props.storyInfo, genres: v})} placeholder="+ Thể loại"/>
                    <TagInput label="Tính cách Main" icon={<Users className="w-3.5 h-3.5" />} options={AVAILABLE_PERSONALITIES} selected={props.storyInfo.mcPersonality} onChange={v => props.setStoryInfo({...props.storyInfo, mcPersonality: v})} placeholder="+ Tính cách"/>
                    <TagInput label="Bối cảnh" icon={<Palette className="w-3.5 h-3.5" />} options={AVAILABLE_SETTINGS} selected={props.storyInfo.worldSetting} onChange={v => props.setStoryInfo({...props.storyInfo, worldSetting: v})} placeholder="+ Bối cảnh"/>
                    <TagInput label="Lưu phái" icon={<Sword className="w-3.5 h-3.5" />} options={AVAILABLE_FLOWS} selected={props.storyInfo.sectFlow} onChange={v => props.setStoryInfo({...props.storyInfo, sectFlow: v})} placeholder="+ Lưu phái"/>
                </div>
            </div>

            {/* System Tools */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button onClick={props.handleBackup} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 p-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-3 border border-slate-200 dark:border-slate-800 shadow-sm group">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 group-hover:text-indigo-500 transition-colors"><Archive className="w-5 h-5" /></div>
                    Backup (.json)
                </button>
                <label className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 p-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-3 border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer group">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 group-hover:text-emerald-500 transition-colors"><ArchiveRestore className="w-5 h-5" /></div>
                    Restore Data
                    <input type="file" accept=".json" className="hidden" onChange={props.handleRestore} />
                </label>
                <button onClick={props.requestResetApp} className="bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-900/10 text-rose-600 dark:text-rose-400 p-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-3 border border-rose-100 dark:border-rose-900/30 shadow-sm group">
                    <div className="p-2 bg-rose-50 dark:bg-rose-900/30 rounded-full text-rose-400 group-hover:text-rose-600 transition-colors"><Trash2 className="w-5 h-5" /></div>
                    Reset Toàn Bộ App
                </button>
            </div>
        </div>
    );
};
