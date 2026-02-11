
import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { FileItem, FileStatus } from '../types';
import { splitContentByRegex, splitContentByLength } from '../utils/fileHelpers';

export interface SplitterModalProps {
    isOpen: boolean;
    fileContent: string;
    fileName: string;
    onConfirmSplit: (files: FileItem[]) => void;
    onCancel: () => void;
}

export const SplitterModal: React.FC<SplitterModalProps> = ({ isOpen, fileContent, fileName, onConfirmSplit, onCancel }) => { 
    const [mode, setMode] = useState<'regex' | 'preserve' | 'reindex'>('regex'); 
    const [charLimit, setCharLimit] = useState<number>(6000); 
    const [customRegex, setCustomRegex] = useState<string>(''); 
    const [previewFiles, setPreviewFiles] = useState<FileItem[]>([]);
    const [isCalculating, setIsCalculating] = useState(false); 
    
    const REGEX_PRESETS = [
        { label: "Thông Minh (Đa năng)", value: "" },
        { label: "Cấu Trúc EPUB Gốc", value: "^###EPUB_CHAPTER_SPLIT###\\s+.*$" },
        { label: "Tiếng Anh (Roman/Word)", value: "^(?:(?:Chapter|Part|Book|Vol|Episode)\\s+(?:[IVXLCDM]+|\\d+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Twenty)|(?:[IVXLCDM]+|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Twenty))\\s*[:.])\\s*.*$" },
        { label: "Truyện Nhật (Syosetu)", value: "^(?:[#＃][0-9０-９]+|第\\s*[0-9０-９]+\\s*[話章幕節]|[0-9０-９]+\\s*[.．])\\s*.*$" }, 
        { label: "Truyện Trung (Đa Năng)", value: "^(?:第\\s*[0-9０-９零一二三四五六七八九十百千]+\\s*[章話節回幕卷]|卷\\s*[0-9０-９]+|[0-9０-９]+\\s+[\\u4e00-\\u9fa5]).*$" },
        { label: "Việt/Anh (Chương X)", value: "^(?:Chapter|Chương|Hồi|Tiết|Quyển|Tập)\\s*\\d+.*$" },
    ];

    useEffect(() => { 
        if (!isOpen) return; 
        setIsCalculating(true); 
        const timer = setTimeout(() => { 
            let resultFiles: FileItem[] = [];
            if (mode === 'regex') { 
                resultFiles = splitContentByRegex(fileContent, customRegex); 
            } else { 
                resultFiles = splitContentByLength(fileContent, charLimit, mode === 'reindex' ? 'reindex' : 'preserve'); 
            } 
            setPreviewFiles(resultFiles); 
            setIsCalculating(false); 
        }, 500); 
        return () => clearTimeout(timer); 
    }, [isOpen, mode, charLimit, customRegex, fileContent]); 

    const handleConfirm = () => { 
        onConfirmSplit(previewFiles);
    }; 
    
    const handleKeepAsIs = () => { 
        const file: FileItem = { id: crypto.randomUUID(), name: fileName, content: fileContent, translatedContent: null, status: FileStatus.IDLE, retryCount: 0, originalCharCount: fileContent.length, remainingRawCharCount: 0 }; 
        onConfirmSplit([file]); 
    }; 
    
    if (!isOpen) return null; 

    return ( 
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"> 
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"> 
                <div className="p-6 border-b border-slate-100 shrink-0"> 
                    <h3 className="text-lg font-bold text-slate-800">Bộ Tách Chương (Splitter v2.4 - Regex+)</h3> 
                    <div className="space-y-4 mt-4"> 
                        <div className="flex bg-slate-100 p-1 rounded-xl gap-1"> 
                            <button onClick={() => setMode('regex')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${mode === 'regex' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500'}`}>Regex (Smart)</button> 
                            <button onClick={() => setMode('preserve')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${mode === 'preserve' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Cắt Đoạn</button> 
                            <button onClick={() => setMode('reindex')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${mode === 'reindex' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500'}`}>Cắt & Đánh Số</button> 
                        </div> 
                        
                        {mode === 'regex' ? ( 
                            <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100"> 
                                <div className="flex flex-wrap gap-2"> 
                                    {REGEX_PRESETS.map((preset, idx) => ( 
                                        <button key={idx} onClick={() => setCustomRegex(preset.value)} className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors ${customRegex === preset.value ? 'bg-sky-100 text-sky-700 border-sky-300' : 'bg-white text-slate-500 border-slate-200 hover:border-sky-300 hover:text-sky-600'}`} > {preset.label} </button> 
                                    ))} 
                                </div> 
                                <input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-sky-200 outline-none" placeholder="Regex tùy chỉnh (để trống sẽ dùng Smart Regex)..." value={customRegex} onChange={e => setCustomRegex(e.target.value)} /> 
                                <p className="text-[10px] text-slate-400">Smart Regex hỗ trợ: Chương, Hồi, Chap, Quyển, Phần, Q, C, Ngoại truyện, Side Story...</p> 
                            </div> 
                        ) : ( 
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"> 
                                <p className="text-[10px] text-slate-500 mb-2">{mode === 'preserve' ? 'Cắt nhỏ file theo ký tự, GIỮ NGUYÊN nội dung.' : 'Cắt nhỏ, XÓA tiêu đề cũ và tự động thêm "Chương 1, 2..."'}</p> 
                                <input type="number" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs" value={charLimit} onChange={e => setCharLimit(parseInt(e.target.value) || 6000)} step={500} min={1000} /> 
                            </div> 
                        )} 
                        
                        <div className="flex justify-between items-center px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100"> 
                            <span className="text-xs font-bold text-indigo-700">Dự kiến:</span> 
                            <span className="text-lg font-bold text-indigo-600">{isCalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : `${previewFiles.length} phần`}</span> 
                        </div> 
                    </div> 
                </div> 

                {/* PREVIEW LIST */}
                <div className="flex-1 overflow-y-auto bg-slate-50 p-4 border-b border-slate-100 custom-scrollbar">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Xem trước ({previewFiles.length})</h4>
                    {previewFiles.length > 0 ? (
                        <div className="space-y-1">
                            {previewFiles.slice(0, 100).map((file, idx) => (
                                <div key={idx} className="bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-600 truncate shadow-sm">
                                    <span className="font-mono font-bold text-indigo-500 mr-2">{String(idx+1).padStart(3, '0')}</span>
                                    {file.name}
                                </div>
                            ))}
                            {previewFiles.length > 100 && (
                                <div className="text-center text-xs text-slate-400 italic py-2">
                                    ...và {previewFiles.length - 100} chương khác
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                            Chưa tìm thấy chương nào phù hợp...
                        </div>
                    )}
                </div>

                <div className="p-6 shrink-0 flex flex-col gap-3 bg-white"> 
                    <div className="grid grid-cols-2 gap-3"> 
                        <button onClick={onCancel} className="py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl border border-slate-200">Hủy</button> 
                        <button onClick={handleConfirm} disabled={previewFiles.length === 0} className="py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-sky-200/50"> Thực Hiện </button> 
                    </div> 
                    <button onClick={handleKeepAsIs} className="w-full py-2 text-xs font-bold text-indigo-500 hover:bg-indigo-50 rounded-xl border border-dashed border-indigo-200">Nhập Nguyên Bản (Không Tách)</button> 
                </div> 
            </div> 
        </div> 
    ); 
};
