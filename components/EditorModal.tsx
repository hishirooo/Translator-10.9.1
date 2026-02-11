
import React, { useState, useRef, useEffect } from 'react';
import { Columns, Link2, Replace, Bug, LifeBuoy, Save, X, FileText, Copy, Edit3, UserX, Maximize2, Minimize2, Lock, Unlock } from 'lucide-react';
import { FileItem, FileStatus } from '../types';
import { countForeignChars, FOREIGN_CHARS_REGEX, getInvalidPronounLines, optimizeContext, optimizeDictionary } from '../utils/textHelpers';

interface EditorModalProps {
    file: FileItem;
    onClose: () => void;
    onSave: (fileId: string, newContent: string) => void;
    storyInfoContext: string;
    dictionary: string;
    promptTemplate: string;
    onAddToGlossary: (raw: string, edit: string) => void;
    onReplaceAll: (find: string, replace: string) => void;
    addToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    genres: string[]; // NEW: Genres needed for pronoun check
}

export const EditorModal: React.FC<EditorModalProps> = ({ 
    file, onClose, onSave, storyInfoContext, dictionary, promptTemplate, 
    onAddToGlossary, onReplaceAll, addToast, genres
}) => {
    const [editContent, setEditContent] = useState<string>(file.translatedContent || "");
    const [checkMode, setCheckMode] = useState<'none' | 'raw' | 'pronoun'>('none');
    const [glossarySelection, setGlossarySelection] = useState<{raw: string, edit: string} | null>(null);
    const [editingGlossary, setEditingGlossary] = useState<{raw: string, edit: string}>({raw: '', edit: ''});
    
    // NEW: Focus Mode & Sync Toggle
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [isSyncScroll, setIsSyncScroll] = useState(true);

    // NEW: Auto-sync content when file updates (Streaming)
    useEffect(() => {
        if (file.translatedContent && file.translatedContent !== editContent) {
            setEditContent(file.translatedContent);
        }
    }, [file.translatedContent]);

    const rawPanelRef = useRef<HTMLDivElement>(null);
    const editPanelRef = useRef<HTMLTextAreaElement>(null);
    const highlightOverlayRef = useRef<HTMLDivElement>(null);
    const isSyncingLeft = useRef(false);
    const isSyncingRight = useRef(false);
    const rawSelectionRef = useRef<string>(""); 
    const editSelectionRef = useRef<string>("");

    const handleSyncScroll = (e: React.UIEvent<HTMLDivElement | HTMLTextAreaElement>, isLeft: boolean) => {
        if (!isSyncScroll) {
            // If sync is off, still update the highlight overlay for edit panel
            if (!isLeft && highlightOverlayRef.current) {
                highlightOverlayRef.current.scrollTop = e.currentTarget.scrollTop;
            }
            return;
        }

        const source = e.currentTarget;
        const target = isLeft ? editPanelRef.current : rawPanelRef.current;
        const overlay = highlightOverlayRef.current;
        if (!target) return;
        
        // Calculate percentage to handle different heights if needed
        const percentage = source.scrollTop / (source.scrollHeight - source.clientHeight);
        
        if (isLeft) {
            if (isSyncingLeft.current) { isSyncingLeft.current = false; return; }
            isSyncingRight.current = true;
            target.scrollTop = percentage * (target.scrollHeight - target.clientHeight);
        } else {
            if (isSyncingRight.current) { isSyncingRight.current = false; return; }
            isSyncingLeft.current = true;
            target.scrollTop = percentage * (target.scrollHeight - target.clientHeight);
            if (overlay) { overlay.scrollTop = source.scrollTop; }
        }
    };

    const handleSelection = (isLeft: boolean) => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (text) {
            if (isLeft) rawSelectionRef.current = text;
            else editSelectionRef.current = text;
            
            if (rawSelectionRef.current && editSelectionRef.current) {
                const newSel = { raw: rawSelectionRef.current, edit: editSelectionRef.current };
                setGlossarySelection(newSel);
                setEditingGlossary(newSel);
            }
        }
    };

    const handleRescueCopy = async () => {
        const localDict = optimizeDictionary(dictionary, file.content);
        const localContext = optimizeContext(storyInfoContext || "", file.content);
        const rescuePrompt = `*** BẠN LÀ HỆ THỐNG CỨU HỘ DỊCH THUẬT ***\nHãy dịch nội dung sau sang tiếng Việt.\n[NGỮ CẢNH]:\n${localContext}\n[TỪ ĐIỂN]:\n${localDict}\n[YÊU CẦU]: ${promptTemplate}\n[NỘI DUNG RAW]:\n${file.content}`;
        try {
            await navigator.clipboard.writeText(rescuePrompt.trim());
            addToast("Đã copy gói cứu hộ! (Đã lọc Từ điển & Ngữ cảnh)", "success");
        } catch (err) {
            addToast("Không thể copy vào clipboard", "error");
        }
    };

    const handleSave = () => {
        onSave(file.id, editContent);
    };

    const handleAddToGlossary = () => {
        if (editingGlossary.raw && editingGlossary.edit) {
            onAddToGlossary(editingGlossary.raw, editingGlossary.edit);
            setGlossarySelection(null);
            rawSelectionRef.current = "";
            editSelectionRef.current = "";
        }
    };

    // Calculate bad lines for Pronoun Check mode
    const badPronounIndices = checkMode === 'pronoun' ? new Set(getInvalidPronounLines(editContent, genres).map(l => l.index)) : new Set();

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm md:p-4 animate-in fade-in duration-200">
            {/* Full screen on Mobile (h-full w-full rounded-none) */}
            <div className="bg-white dark:bg-slate-900 md:rounded-3xl shadow-2xl w-full h-full md:h-[92vh] max-w-7xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20 dark:border-slate-700 ring-1 ring-black/5 rounded-none relative">
                
                {/* Header - Fixed Flex Layout for Horizontal Scrolling */}
                <div className={`px-3 py-2 md:px-4 md:py-3 border-b border-slate-100 dark:border-slate-800 flex items-center bg-white dark:bg-slate-900 shrink-0 z-30 gap-3 transition-all duration-300 ${isFocusMode ? '-mt-20 opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    
                    {/* Title Section (Shrinks if needed) */}
                    <div className="flex items-center gap-2 md:gap-3 min-w-[50px] shrink overflow-hidden">
                        <div className="p-1.5 md:p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0 hidden sm:block"><Columns className="w-4 h-4 md:w-5 md:h-5" /></div>
                        <div className="min-w-0">
                            <h3 className="font-display font-bold text-sm md:text-lg text-slate-800 dark:text-slate-100 truncate">Biên Tập</h3>
                            <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-mono truncate hidden sm:block" title={file.name}>{file.name}</p>
                        </div>
                    </div>
                    
                    {/* Spacer to push Toolbar to the right */}
                    <div className="flex-1"></div>

                    {/* Toolbar Actions - Scrollable Container */}
                    {/* Key Fix: max-w-[calc(100%-80px)] ensures it doesn't push title out completely on tiny screens */}
                    <div className="flex gap-2 items-center overflow-x-auto no-scrollbar max-w-[calc(100%-60px)] sm:max-w-none" style={{ scrollbarWidth: 'none' }}>
                        
                        {glossarySelection && (
                            <div className="flex items-center gap-1 mr-1 animate-in fade-in slide-in-from-top-2 bg-slate-50 dark:bg-slate-800 p-1 rounded-lg border border-slate-100 dark:border-slate-700 shrink-0">
                                <div className="flex flex-col gap-0.5">
                                    <input className="w-16 md:w-24 text-[10px] border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 rounded px-1" value={editingGlossary.raw} onChange={e => setEditingGlossary(p => ({...p, raw: e.target.value}))} placeholder="Gốc" />
                                    <input className="w-16 md:w-24 text-[10px] border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 rounded px-1" value={editingGlossary.edit} onChange={e => setEditingGlossary(p => ({...p, edit: e.target.value}))} placeholder="Dịch" />
                                </div>
                                <div className="flex flex-col gap-1">
                                        <button onClick={handleAddToGlossary} className="p-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50" title="Thêm vào từ điển"><Link2 className="w-3 h-3" /></button>
                                        <button onClick={() => { onReplaceAll(editingGlossary.raw, editingGlossary.edit); setGlossarySelection(null); }} className="p-1 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-900/50" title="Thay thế toàn bộ"><Replace className="w-3 h-3" /></button>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-1 md:gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                            <button onClick={() => setCheckMode('none')} className={`px-2 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${checkMode === 'none' ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Edit</button>
                            <button onClick={() => setCheckMode('raw')} className={`px-2 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap shrink-0 ${checkMode === 'raw' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><Bug className="w-3 h-3" /> Raw</button>
                            <button onClick={() => setCheckMode('pronoun')} className={`px-2 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap shrink-0 ${checkMode === 'pronoun' ? 'bg-white dark:bg-slate-700 text-fuchsia-600 dark:text-fuchsia-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><UserX className="w-3 h-3" /> Xưng Hô</button>
                        </div>
                        
                        {/* Rescue Button */}
                        <button onClick={handleRescueCopy} className="flex px-3 py-2.5 bg-rose-100 dark:bg-rose-900/30 hover:bg-rose-200 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl font-bold transition-all items-center gap-2 text-xs shrink-0" title="Copy gói cứu hộ">
                            <LifeBuoy className="w-4 h-4" /> <span className="hidden sm:inline">Cứu Hộ</span>
                        </button>
                        
                        {/* Focus Mode Toggle */}
                        <button onClick={() => setIsFocusMode(true)} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-slate-700 transition-all shrink-0" title="Chế độ tập trung (Ẩn công cụ)">
                            <Maximize2 className="w-4 h-4" />
                        </button>

                        <button onClick={handleSave} className="px-3 md:px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200/50 dark:shadow-none transition-all flex items-center gap-2 text-xs shrink-0"><Save className="w-4 h-4" /> <span className="hidden sm:inline">Lưu</span></button>
                        <button onClick={onClose} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0"><X className="w-5 h-5" /></button>
                    </div>
                </div>
                
                {/* Floating Exit Focus Button */}
                {isFocusMode && (
                    <button 
                        onClick={() => setIsFocusMode(false)} 
                        className="absolute top-4 right-4 z-50 p-2 bg-slate-900/50 hover:bg-slate-900 text-white rounded-full backdrop-blur-sm transition-all shadow-lg animate-in fade-in"
                        title="Thoát chế độ tập trung"
                    >
                        <Minimize2 className="w-5 h-5" />
                    </button>
                )}

                {/* Body - Improved layout for scrolling */}
                <div className="flex-1 bg-slate-50 dark:bg-slate-950 relative overflow-hidden flex flex-col md:flex-row min-h-0">
                    {/* Raw Panel */}
                    <div className="flex-1 border-r border-slate-200/60 dark:border-slate-800/60 flex flex-col h-1/2 md:h-full min-h-0 relative group/raw">
                        {/* Panel Header */}
                        <div className={`px-4 py-2.5 bg-slate-100/80 dark:bg-slate-900/80 border-b border-slate-200/60 dark:border-slate-800/60 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex justify-between items-center backdrop-blur-md shrink-0 transition-all duration-300 ${isFocusMode ? '-mt-10 opacity-0' : 'opacity-100'}`}>
                            <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Bản Gốc (Raw)</span>
                            <div className="flex gap-2">
                                <button onClick={() => setIsSyncScroll(!isSyncScroll)} className={`text-[10px] flex items-center gap-1 ${isSyncScroll ? 'text-indigo-600 font-bold' : 'text-slate-400'}`} title={isSyncScroll ? "Tắt đồng bộ cuộn" : "Bật đồng bộ cuộn"}>
                                    {isSyncScroll ? <Lock className="w-3 h-3"/> : <Unlock className="w-3 h-3"/>} Sync
                                </button>
                                <button onClick={async () => { await navigator.clipboard.writeText(file.content); addToast("Đã copy Raw", "success"); }} className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"><Copy className="w-3 h-3"/> Copy</button>
                            </div>
                        </div>
                        
                        <div 
                            className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/30 dark:bg-slate-950/30 custom-scrollbar touch-pan-y"
                            ref={rawPanelRef}
                            onScroll={(e) => handleSyncScroll(e, true)}
                            onMouseUp={() => handleSelection(true)}
                        >
                            <div className="whitespace-pre-wrap font-mono text-base leading-relaxed text-slate-600 dark:text-slate-400 selection:bg-slate-200 dark:selection:bg-slate-700 pb-32">
                                {file.content}
                            </div>
                        </div>
                    </div>

                    {/* Edit Panel */}
                    <div className="flex-1 flex flex-col h-1/2 md:h-full min-h-0 bg-white dark:bg-slate-900 relative group/editor">
                        {/* Panel Header */}
                        <div className={`px-4 py-2.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex justify-between items-center shrink-0 z-20 transition-all duration-300 ${isFocusMode ? '-mt-10 opacity-0' : 'opacity-100'}`}>
                            <span className="flex items-center gap-1.5"><Edit3 className="w-3.5 h-3.5" /> Bản Dịch (Editor)</span>
                        </div>
                        
                        {/* Container for Editor & Overlay */}
                        <div className="flex-1 relative min-h-0">
                            {checkMode !== 'none' && (
                                <div 
                                    ref={highlightOverlayRef}
                                    className="absolute inset-0 p-4 md:p-6 whitespace-pre-wrap font-sans text-lg leading-8 text-transparent pointer-events-none z-0 overflow-hidden custom-scrollbar pb-32"
                                    aria-hidden="true"
                                >
                                    {checkMode === 'raw' ? (
                                        editContent.split('').map((char, index) => {
                                            const isForeign = FOREIGN_CHARS_REGEX.test(char);
                                            return (
                                                <span key={index} className={isForeign ? "bg-rose-500/40 dark:bg-rose-500/50 text-transparent border-b-2 border-rose-600 dark:border-rose-400" : "text-transparent"}>
                                                    {char}
                                                </span>
                                            );
                                        })
                                    ) : (
                                        editContent.split('\n').map((line, index) => {
                                            const isBad = badPronounIndices.has(index);
                                            return (
                                                <div key={index} className={isBad ? "bg-fuchsia-300/40 dark:bg-fuchsia-600/40 text-transparent border-l-4 border-fuchsia-500" : ""}>
                                                    {line || ' '} 
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                            <textarea
                                className="absolute inset-0 w-full h-full p-4 md:p-6 bg-transparent resize-none outline-none font-sans text-lg leading-8 text-slate-800 dark:text-slate-200 focus:bg-slate-50/30 dark:focus:bg-slate-800/30 transition-colors z-10 selection:bg-indigo-100 dark:selection:bg-indigo-900 custom-scrollbar pb-32 touch-pan-y"
                                value={editContent}
                                onChange={e => setEditContent(e.target.value)}
                                ref={editPanelRef}
                                onScroll={(e) => handleSyncScroll(e, false)}
                                onMouseUp={() => handleSelection(false)}
                                spellCheck={false}
                            />
                            
                            {/* Floating Copy Button (Only show if not in Focus Mode or on hover) */}
                            <div className={`absolute bottom-6 right-6 flex gap-2 transition-opacity z-20 ${isFocusMode ? 'opacity-0 group-hover/editor:opacity-100' : 'opacity-0 group-hover/editor:opacity-100'}`}>
                                <button onClick={async () => { await navigator.clipboard.writeText(editContent); addToast("Đã copy", "success"); }} className="p-3 bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-slate-700 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:scale-105 transition-all" title="Copy toàn bộ"><Copy className="w-5 h-5" /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
