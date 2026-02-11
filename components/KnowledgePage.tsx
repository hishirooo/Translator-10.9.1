
import React, { useState, useMemo, useEffect } from 'react';
import { 
    BookA, BookOpen, Download, Upload, Microscope, Sparkles, Loader2, 
    Zap, Eye, EyeOff, Wrench, RefreshCw, Search, ArrowDownAZ, ArrowUpAZ,
    Trash2, Plus, AlertTriangle, Check
} from 'lucide-react';
import { DEFAULT_PROMPT, DEFAULT_DICTIONARY } from '../constants';
import { StoryInfo } from '../types';

interface GlossaryEntry {
    id: string;
    key: string;
    value: string;
    isComment: boolean;
    conflict?: string; // New field for conflict warning
}

interface KnowledgePageProps {
    // Context
    storyInfo: StoryInfo;
    setStoryInfo: React.Dispatch<React.SetStateAction<StoryInfo>>;
    handleContextDownload: () => void;
    handleContextFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    setShowContextBuilder: (v: boolean) => void;
    setShowNameAnalysisModal: (v: boolean) => void;
    isAnalyzingNames: boolean;
    setShowSmartStartModal: (v: boolean) => void;

    // Dictionary
    handleDictionaryDownload: () => void;
    handleDictionaryUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    dictTab: 'custom' | 'default';
    setDictTab: (v: 'custom' | 'default') => void;
    additionalDictionary: string;
    setAdditionalDictionary: (v: string) => void;

    // Prompt
    viewOriginalPrompt: boolean;
    setViewOriginalPrompt: (v: boolean) => void;
    handlePromptUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    resetPrompt: () => void;
    promptTemplate: string;
    setPromptTemplate: (v: string) => void;
    setShowPromptDesigner: (v: boolean) => void;
    isOptimizingPrompt: boolean;
}

const GlossaryTable = ({ content, onChange }: { content: string, onChange: (v: string) => void }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [entries, setEntries] = useState<GlossaryEntry[]>([]);
    const [page, setPage] = useState(0);
    const [isTesting, setIsTesting] = useState(false);
    const ROWS_PER_PAGE = 20;

    // Parse content on init or external change
    useEffect(() => {
        const lines = content.split('\n');
        const parsed: GlossaryEntry[] = lines.map((line, idx) => {
            const isComment = line.trim().startsWith('#') || line.trim().startsWith('//') || !line.includes('=');
            let key = '', value = '';
            if (!isComment) {
                const parts = line.split('=');
                key = parts[0].trim().replace(/^\[|\]$/g, '');
                value = parts.slice(1).join('=').trim();
            }
            return {
                id: `row-${idx}`,
                key: isComment ? line : key,
                value: isComment ? '' : value,
                isComment
            };
        });
        setEntries(parsed);
    }, [content]);

    const handleUpdate = (newEntries: GlossaryEntry[]) => {
        setEntries(newEntries);
        // Serialize back to string
        const str = newEntries.map(e => e.isComment ? e.key : `[${e.key}] = ${e.value}`).join('\n');
        onChange(str);
    };

    const handleEdit = (id: string, field: 'key' | 'value', text: string) => {
        const newEntries = entries.map(e => e.id === id ? { ...e, [field]: text } : e);
        handleUpdate(newEntries);
    };

    const handleAdd = () => {
        const newEntry = { id: crypto.randomUUID(), key: '', value: '', isComment: false };
        handleUpdate([newEntry, ...entries]);
    };

    const handleDelete = (id: string) => {
        handleUpdate(entries.filter(e => e.id !== id));
    };

    const handleSort = () => {
        const sorted = [...entries].sort((a, b) => {
            if (a.isComment && !b.isComment) return -1;
            if (!a.isComment && b.isComment) return 1;
            return a.key.localeCompare(b.key);
        });
        handleUpdate(sorted);
    };

    const handleDeduplicate = () => {
        const seen = new Set();
        const unique = entries.filter(e => {
            if (e.isComment) return true;
            const k = e.key.toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
        handleUpdate(unique);
    };

    const handleTestConflict = () => {
        setIsTesting(true);
        setTimeout(() => {
            const keys = entries.filter(e => !e.isComment && e.key.trim()).map(e => e.key.trim());
            const newEntries = entries.map(entry => {
                if (entry.isComment || !entry.key) return { ...entry, conflict: undefined };
                // Check if this key is a substring of another key
                const superKey = keys.find(k => k !== entry.key && k.includes(entry.key));
                if (superKey) {
                    return { ...entry, conflict: `Xung đột: Là tập con của "${superKey}"` };
                }
                return { ...entry, conflict: undefined };
            });
            // Don't update parent string, just local state for display
            setEntries(newEntries);
            setIsTesting(false);
        }, 100);
    };

    const filtered = useMemo(() => {
        if (!searchTerm) return entries;
        const low = searchTerm.toLowerCase();
        return entries.filter(e => e.key.toLowerCase().includes(low) || e.value.toLowerCase().includes(low));
    }, [entries, searchTerm]);

    const paginated = filtered.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
    const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
            {/* Toolbar */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex gap-2 items-center bg-slate-50 dark:bg-slate-900/50">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input 
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                        placeholder="Tìm kiếm..."
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                    />
                </div>
                <button onClick={handleAdd} className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200" title="Thêm từ"><Plus className="w-4 h-4" /></button>
                <button onClick={handleSort} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300" title="Sắp xếp A-Z"><ArrowDownAZ className="w-4 h-4" /></button>
                <button onClick={handleDeduplicate} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300" title="Lọc trùng"><Trash2 className="w-4 h-4" /></button>
                <button onClick={handleTestConflict} className={`p-2 rounded-lg hover:bg-amber-200 transition-colors ${isTesting ? 'bg-amber-200 text-amber-700' : 'bg-amber-100 text-amber-600'}`} title="Kiểm tra xung đột (Test)"><AlertTriangle className="w-4 h-4" /></button>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50 sticky top-0 z-10">
                        <tr>
                            <th className="px-3 py-2 rounded-l-lg w-1/3">Từ Gốc (Key)</th>
                            <th className="px-3 py-2 w-1/3">Nghĩa (Value)</th>
                            <th className="px-3 py-2 rounded-r-lg w-10 text-center">Xóa</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginated.map(row => (
                            <tr key={row.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                {row.isComment ? (
                                    <td colSpan={3} className="px-2 py-1">
                                        <input 
                                            className="w-full bg-transparent text-slate-400 italic outline-none py-1" 
                                            value={row.key} 
                                            onChange={e => handleEdit(row.id, 'key', e.target.value)}
                                        />
                                    </td>
                                ) : (
                                    <>
                                        <td className="px-2 py-1 relative">
                                            <input 
                                                className={`w-full bg-transparent font-bold outline-none py-1 focus:bg-white dark:focus:bg-slate-900 rounded px-1 ${row.conflict ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}
                                                value={row.key}
                                                onChange={e => handleEdit(row.id, 'key', e.target.value)}
                                                placeholder="Key"
                                            />
                                            {row.conflict && (
                                                <span className="absolute right-2 top-2 text-rose-500" title={row.conflict}><AlertTriangle className="w-3 h-3" /></span>
                                            )}
                                        </td>
                                        <td className="px-2 py-1">
                                            <input 
                                                className="w-full bg-transparent text-slate-700 dark:text-slate-300 outline-none py-1 focus:bg-white dark:focus:bg-slate-900 rounded px-1"
                                                value={row.value}
                                                onChange={e => handleEdit(row.id, 'value', e.target.value)}
                                                placeholder="Value"
                                            />
                                        </td>
                                        <td className="px-2 py-1 text-center">
                                            <button onClick={() => handleDelete(row.id)} className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-600 transition-opacity">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                        {paginated.length === 0 && (
                            <tr><td colSpan={3} className="text-center py-8 text-slate-400 italic">Không tìm thấy dữ liệu</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="p-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs text-slate-500">
                    <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded disabled:opacity-50 hover:bg-slate-200">Trước</button>
                    <span>Trang {page + 1} / {totalPages}</span>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded disabled:opacity-50 hover:bg-slate-200">Sau</button>
                </div>
            )}
        </div>
    );
};

export const KnowledgePage: React.FC<KnowledgePageProps> = (props) => {
    const [viewMode, setViewMode] = useState<'table' | 'text'>('table');

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Left Column: Context & Dictionary */}
            <div className="flex flex-col gap-4">
                
                {/* 1. Context Section */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex-1 flex flex-col min-h-[350px]">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-base font-display font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-amber-500" /> Ngữ Cảnh (Context)
                        </h3>
                        <div className="flex gap-1">
                            <button onClick={props.handleContextDownload} className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg transition-colors" title="Tải về"><Download className="w-3.5 h-3.5" /></button>
                            <label className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg transition-colors cursor-pointer" title="Tải lên">
                                <Upload className="w-3.5 h-3.5" />
                                <input type="file" accept=".txt,.docx,.doc,.pdf" className="hidden" onChange={props.handleContextFileUpload} />
                            </label>
                        </div>
                    </div>
                    
                    <textarea 
                        className="flex-1 w-full bg-amber-50/30 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-3 text-xs font-mono text-slate-700 dark:text-slate-300 resize-none outline-none focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-800 transition-all custom-scrollbar leading-relaxed" 
                        placeholder="Nhập thông tin bối cảnh, tóm tắt cốt truyện, quan hệ nhân vật..." 
                        value={props.storyInfo.contextNotes || ''} 
                        onChange={e => props.setStoryInfo({...props.storyInfo, contextNotes: e.target.value})}
                    />

                    <div className="grid grid-cols-2 gap-2 mt-3">
                        <button onClick={() => props.setShowNameAnalysisModal(true)} disabled={props.isAnalyzingNames} className="py-2.5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all">
                             {props.isAnalyzingNames ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Microscope className="w-3.5 h-3.5" />} Phân Tích Sâu
                        </button>
                        <button onClick={() => props.setShowSmartStartModal(true)} className="py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-200/50 hover:shadow-orange-200/80 transition-all flex items-center justify-center gap-2">
                            <Sparkles className="w-3.5 h-3.5" /> Smart Start
                        </button>
                    </div>
                </div>

                {/* 2. Dictionary Section */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex-1 flex flex-col min-h-[450px]">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-base font-display font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <BookA className="w-4 h-4 text-emerald-500" /> Từ Điển (Glossary)
                        </h3>
                        <div className="flex gap-2 items-center">
                            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                                <button onClick={() => setViewMode('table')} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600' : 'text-slate-400'}`}>Table</button>
                                <button onClick={() => setViewMode('text')} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'text' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600' : 'text-slate-400'}`}>Raw</button>
                            </div>
                            <div className="w-px h-3 bg-slate-200 dark:bg-slate-700"></div>
                            <button onClick={() => props.setDictTab(props.dictTab === 'custom' ? 'default' : 'custom')} className="text-[10px] font-bold px-2 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50">
                                {props.dictTab === 'custom' ? "Mặc định" : "Tùy chỉnh"}
                            </button>
                            <label className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer">
                                <Upload className="w-3.5 h-3.5" />
                                <input type="file" multiple accept=".txt,.docx,.doc,.pdf" className="hidden" onChange={props.handleDictionaryUpload} />
                            </label>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0">
                        {props.dictTab === 'custom' ? (
                            viewMode === 'table' ? (
                                <GlossaryTable content={props.additionalDictionary} onChange={props.setAdditionalDictionary} />
                            ) : (
                                <textarea 
                                    className="w-full h-full bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3 text-xs font-mono text-slate-700 dark:text-slate-300 resize-none outline-none focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800 transition-all custom-scrollbar whitespace-pre leading-relaxed" 
                                    placeholder="Mỗi dòng một từ: Trung=Việt" 
                                    value={props.additionalDictionary} 
                                    onChange={e => props.setAdditionalDictionary(e.target.value)} 
                                />
                            )
                        ) : (
                            <textarea 
                                className="w-full h-full bg-slate-50 dark:bg-slate-800 border-0 rounded-xl p-3 text-xs font-mono text-slate-500 dark:text-slate-400 resize-none outline-none custom-scrollbar leading-relaxed" 
                                value={DEFAULT_DICTIONARY} 
                                readOnly 
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Right Column: Prompt Engineering */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-full min-h-[600px]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-display font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-indigo-500" /> Prompt Engineering
                    </h3>
                    <div className="flex gap-2">
                         <button onClick={() => props.setViewOriginalPrompt(!props.viewOriginalPrompt)} className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors" title={props.viewOriginalPrompt ? "Quay lại" : "Xem gốc"}>
                             {props.viewOriginalPrompt ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                         </button>
                         <label className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors cursor-pointer" title="Load Prompt">
                             <Upload className="w-4 h-4" />
                             <input type="file" accept=".txt,.docx,.doc" className="hidden" onChange={props.handlePromptUpload} />
                         </label>
                         {!props.viewOriginalPrompt && <button onClick={props.resetPrompt} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors" title="Reset"><RefreshCw className="w-4 h-4" /></button>}
                    </div>
                </div>

                {/* Improved Editor Area */}
                <div className="flex-1 relative mb-3 min-h-[400px] rounded-xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden bg-[#f8fafc] dark:bg-slate-950 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-900 transition-all group">
                     <textarea 
                        className="absolute inset-0 w-full h-full bg-transparent p-4 text-xs font-mono text-slate-800 dark:text-slate-200 resize-none outline-none custom-scrollbar whitespace-pre-wrap leading-6" 
                        placeholder="Nội dung Prompt..." 
                        value={props.viewOriginalPrompt ? DEFAULT_PROMPT : props.promptTemplate} 
                        onChange={e => !props.viewOriginalPrompt && props.setPromptTemplate(e.target.value)}
                        readOnly={props.viewOriginalPrompt}
                        spellCheck={false}
                    />
                </div>
                
                <button onClick={() => props.setShowPromptDesigner(true)} disabled={props.isOptimizingPrompt} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200/50 transition-all flex items-center justify-center gap-2">
                    {props.isOptimizingPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />} 
                    {props.isOptimizingPrompt ? "Đang Tối Ưu..." : "Tối Ưu Hóa Prompt (AI Architect)"}
                </button>
            </div>
        </div>
    );
};
