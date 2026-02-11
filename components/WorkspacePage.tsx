import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
    FileArchive, FileUp, UserX, Copy, AlertTriangle
} from 'lucide-react';
import { FileItem, FileStatus, StoryInfo } from '../types';
import { getInvalidPronounLines, isVietnameseContent, isEnglishContent } from '../utils/textHelpers';
import FileCard from './FileCard';

interface WorkspacePageProps {
    files: FileItem[];
    visibleFiles: FileItem[];
    selectedFiles: Set<string>;
    currentPage: number;
    setCurrentPage: (v: number) => void;
    totalPages: number;
    handleSelectFile: (id: string, shiftKey: boolean) => void;
    handleManualFixSingle: (e: React.MouseEvent, id: string) => void;
    handleRescueCopy: (e: React.MouseEvent, file: FileItem) => void;
    requestRetranslateSingle: (e: React.MouseEvent, id: string) => void;
    openEditor: (file: FileItem) => void;
    handleRemoveFile: (id: string) => void;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;

    // Bottom Bar Logic
    setShowPasteModal: (v: boolean) => void;
    selectAll: () => void;
    rangeStart: string;
    setRangeStart: (v: string) => void;
    rangeEnd: string;
    setRangeEnd: (v: string) => void;
    handleRangeSelect: () => void;
    setShowFindReplace: (v: boolean) => void;
    isProcessing: boolean;
    handleSmartFix: () => void;

    // Filter Logic
    showFilterPanel: boolean;
    setShowFilterPanel: (v: boolean) => void;
    filterModels: Set<string>;
    filterStatuses: Set<string>;
    toggleFilterModel: (key: string) => void;
    toggleFilterStatus: (key: string) => void;
    clearFilters: () => void;

    handleScanJunk: () => void;
    handleManualCleanup: (scope: 'all' | 'selected') => void;
    setShowRetranslateModal: (v: boolean) => void;
    handleSmartDelete: () => void;
    requestDeleteAll: () => void;
    handleDownloadRaw: () => void;
    handleDownloadTranslatedZip: () => void;
    handleDownloadMerged: () => void;
    handleDownloadSelected: () => void;
    handleDownloadEpub: () => void;
    stopProcessing: () => void;
    handleStartButton: () => void;

    // Story Info for Pronoun Check
    storyInfo: StoryInfo;
}

export const WorkspacePage: React.FC<WorkspacePageProps> = (props) => {
    const [jumpPage, setJumpPage] = useState('');
    const paginationRef = useRef<HTMLDivElement>(null);
    const activePageRef = useRef<HTMLButtonElement>(null);

    // Auto-scroll to active page when currentPage changes
    useEffect(() => {
        if (activePageRef.current && paginationRef.current) {
            const container = paginationRef.current;
            const activeBtn = activePageRef.current;
            const containerRect = container.getBoundingClientRect();
            const btnRect = activeBtn.getBoundingClientRect();

            if (btnRect.left < containerRect.left || btnRect.right > containerRect.right) {
                activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        }
    }, [props.currentPage]);

    const handleJumpPage = () => {
        const pageNum = parseInt(jumpPage);
        if (pageNum >= 1 && pageNum <= props.totalPages) {
            props.setCurrentPage(pageNum);
            setJumpPage('');
        }
    };

    // --- REAL-TIME STATS CALCULATION ---
    const counts = useMemo(() => {
        return {
            selected: props.selectedFiles.size,
            completed: props.files.filter(f => f.status === FileStatus.COMPLETED && f.remainingRawCharCount === 0).length,
            raw: props.files.filter(f => f.status === FileStatus.COMPLETED && f.remainingRawCharCount > 0).length,
            error: props.files.filter(f => f.status === FileStatus.ERROR && !f.errorMessage?.includes("English")).length,
            english: props.files.filter(f => f.status === FileStatus.ERROR && f.errorMessage?.includes("English")).length,
            short: props.files.filter(f => f.content.length < 1200).length,
            processing: props.files.filter(f => f.status === FileStatus.PROCESSING || f.status === FileStatus.REPAIRING).length,
            // Pronoun Errors: Completed + Clean + Has Bad Pronouns
            pronoun: props.files.filter(f =>
                f.status === FileStatus.COMPLETED &&
                f.remainingRawCharCount === 0 &&
                getInvalidPronounLines(f.translatedContent || "", props.storyInfo.genres).length > 0
            ).length,
            // Unchanged/Lazy: Completed but content is identical to input
            unchanged: props.files.filter(f =>
                f.status === FileStatus.COMPLETED &&
                f.translatedContent &&
                f.translatedContent.trim() === f.content.trim()
            ).length,
            // Low Ratio
            lowRatio: props.files.filter(f => {
                if (f.status !== FileStatus.COMPLETED || !f.translatedContent) return false;
                const ratio = f.originalCharCount > 0 ? f.translatedContent.length / f.originalCharCount : 0;
                const isLatin = isVietnameseContent(f.content) || isEnglishContent(f.content);
                return ratio < (isLatin ? 0.6 : 2.3);
            }).length,

            // Models
            m3pro: props.files.filter(f => f.usedModel?.includes('gemini-3-pro')).length,
            m25pro: props.files.filter(f => f.usedModel?.includes('gemini-2.5-pro')).length,
            m3flash: props.files.filter(f => f.usedModel?.includes('gemini-3-flash')).length,
            m25flash: props.files.filter(f => f.usedModel?.includes('gemini-2.5-flash')).length,
        };
    }, [props.files, props.selectedFiles, props.storyInfo.genres]);

    const renderFilterBadge = (label: string, count: number, active: boolean, onClick: () => void, colorClass: string, icon?: React.ReactNode) => (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-2 
            ${active ? colorClass : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'}`}
        >
            <div className="flex items-center gap-1.5">
                {icon}
                <span>{label}</span>
            </div>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${active ? 'bg-white/30' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {count}
            </span>
        </button>
    );

    // Filter Logic inside WorkspacePage
    const localVisibleFiles = useMemo(() => {
        let filtered = props.files;
        if (props.filterStatuses.size > 0 || props.filterModels.size > 0) {
            filtered = props.files.filter(f => {
                let statusMatch = true;
                if (props.filterStatuses.size > 0) {
                    if (props.filterStatuses.has('selected')) { if (!props.selectedFiles.has(f.id)) return false; if (props.filterStatuses.size === 1) return true; }

                    const isCompleted = f.status === FileStatus.COMPLETED;
                    const isError = f.status === FileStatus.ERROR;
                    const isEnglishError = isError && f.errorMessage?.includes("English");
                    const isRaw = isCompleted && f.remainingRawCharCount > 0;
                    const isClean = isCompleted && f.remainingRawCharCount === 0;
                    const isProcessing = f.status === FileStatus.PROCESSING || f.status === FileStatus.REPAIRING;
                    const isPending = f.status === FileStatus.IDLE;
                    const isShort = f.content.length < 1200;
                    const hasPronounError = isClean && getInvalidPronounLines(f.translatedContent || "", props.storyInfo.genres).length > 0;
                    const isUnchanged = isCompleted && f.translatedContent?.trim() === f.content.trim();

                    const isErrorFilterMatch = props.filterStatuses.has('error') && ((isError && !isEnglishError) || isProcessing);

                    // LOW RATIO FILTER
                    let isLowRatio = false;
                    if (props.filterStatuses.has('low_ratio')) {
                        if (isCompleted && f.translatedContent) {
                            const ratio = f.originalCharCount > 0 ? f.translatedContent.length / f.originalCharCount : 0;
                            const isLatin = isVietnameseContent(f.content) || isEnglishContent(f.content);
                            if (ratio < (isLatin ? 0.6 : 2.3)) isLowRatio = true;
                        }
                    }

                    const matchesStandardStatus = (
                        (props.filterStatuses.has('completed') && isClean) ||
                        (props.filterStatuses.has('raw') && isRaw) ||
                        isErrorFilterMatch ||
                        (props.filterStatuses.has('english') && isEnglishError) ||
                        (props.filterStatuses.has('processing') && isProcessing) ||
                        (props.filterStatuses.has('pending') && isPending) ||
                        (props.filterStatuses.has('short') && isShort) ||
                        (props.filterStatuses.has('pronoun_error') && hasPronounError) ||
                        (props.filterStatuses.has('unchanged') && isUnchanged)
                    );

                    if (props.filterStatuses.size > (props.filterStatuses.has('selected') ? 1 : 0)) {
                        statusMatch = matchesStandardStatus || isLowRatio;
                    }
                }

                let modelMatch = true;
                if (props.filterModels.size > 0) {
                    if (!f.usedModel) modelMatch = false;
                    else {
                        const m = f.usedModel;
                        modelMatch = (
                            (props.filterModels.has('3pro') && m.includes('gemini-3-pro')) ||
                            (props.filterModels.has('25pro') && m.includes('gemini-2.5-pro')) ||
                            (props.filterModels.has('3flash') && m.includes('gemini-3-flash')) ||
                            (props.filterModels.has('25flash') && m.includes('gemini-2.5-flash'))
                        );
                    }
                }
                return statusMatch && modelMatch;
            });
        }

        if (props.currentPage === 0) return filtered;
        const startIndex = (props.currentPage - 1) * 50;
        const endIndex = startIndex + 50;
        return filtered.slice(startIndex, endIndex);
    }, [props.files, props.filterStatuses, props.filterModels, props.currentPage, props.selectedFiles, props.storyInfo.genres]);

    return (
        <div className="flex flex-col h-full relative animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
            {/* Toolbar & Pagination */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shadow-sm flex-wrap gap-2 shrink-0 z-20">
                <div ref={paginationRef} className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
                    <button
                        onClick={() => props.setCurrentPage(0)}
                        ref={props.currentPage === 0 ? activePageRef : null}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${props.currentPage === 0 ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                    >
                        Tất cả ({props.files.length})
                    </button>
                    {Array.from({ length: props.totalPages }).map((_, idx) => (
                        <button
                            key={idx}
                            ref={props.currentPage === idx + 1 ? activePageRef : null}
                            onClick={() => props.setCurrentPage(idx + 1)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${props.currentPage === idx + 1 ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        >
                            Trang {idx + 1}
                        </button>
                    ))}
                </div>

                {/* Jump Page Input */}
                <div className="flex items-center gap-2 shrink-0 pl-4 border-l border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Nhảy tới:</span>
                    <input
                        type="number"
                        min="1"
                        max={props.totalPages}
                        value={jumpPage}
                        onChange={(e) => setJumpPage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleJumpPage()}
                        placeholder={`1-${props.totalPages}`}
                        className="w-20 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-center text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                    <button
                        onClick={handleJumpPage}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                        Go
                    </button>
                </div>
            </div>

            {/* Filter Panel */}
            {props.showFilterPanel && (
                <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-4 animate-in slide-in-from-top-2 shrink-0 z-10">
                    <div className="max-w-7xl mx-auto flex flex-col gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-24 text-xs font-bold text-slate-400 uppercase mt-2">Trạng thái:</div>
                            <div className="flex flex-wrap gap-2 flex-1">
                                {renderFilterBadge("Đã chọn", counts.selected, props.filterStatuses.has('selected'), () => props.toggleFilterStatus('selected'), 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800')}
                                {renderFilterBadge("Hoàn thành", counts.completed, props.filterStatuses.has('completed'), () => props.toggleFilterStatus('completed'), 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800')}
                                {renderFilterBadge("Còn Raw", counts.raw, props.filterStatuses.has('raw'), () => props.toggleFilterStatus('raw'), 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800')}
                                {renderFilterBadge("Ratio Thấp", counts.lowRatio, props.filterStatuses.has('low_ratio'), () => props.toggleFilterStatus('low_ratio'), 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800', <AlertTriangle className="w-3.5 h-3.5" />)}
                                {renderFilterBadge("Không dịch (Lỗi)", counts.unchanged, props.filterStatuses.has('unchanged'), () => props.toggleFilterStatus('unchanged'), 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800', <Copy className="w-3.5 h-3.5" />)}
                                {renderFilterBadge("Lỗi Xưng Hô", counts.pronoun, props.filterStatuses.has('pronoun_error'), () => props.toggleFilterStatus('pronoun_error'), 'bg-fuchsia-100 dark:bg-fuchsia-900/50 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800', <UserX className="w-3.5 h-3.5" />)}
                                {renderFilterBadge("Lỗi / Treo", counts.error + counts.processing, props.filterStatuses.has('error'), () => props.toggleFilterStatus('error'), 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800')}
                                {renderFilterBadge("Lỗi Tiếng Anh", counts.english, props.filterStatuses.has('english'), () => props.toggleFilterStatus('english'), 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800')}
                                {renderFilterBadge("Quá ngắn (<1200)", counts.short, props.filterStatuses.has('short'), () => props.toggleFilterStatus('short'), 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600')}
                            </div>
                        </div>
                        <div className="flex items-start gap-4 border-t border-slate-200 dark:border-slate-700 pt-3">
                            <div className="w-24 text-xs font-bold text-slate-400 uppercase mt-2">Model:</div>
                            <div className="flex flex-wrap gap-2 flex-1">
                                {renderFilterBadge("3.0 Pro", counts.m3pro, props.filterModels.has('3pro'), () => props.toggleFilterModel('3pro'), 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800')}
                                {renderFilterBadge("2.5 Pro", counts.m25pro, props.filterModels.has('25pro'), () => props.toggleFilterModel('25pro'), 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800')}
                                {renderFilterBadge("3.0 Flash", counts.m3flash, props.filterModels.has('3flash'), () => props.toggleFilterModel('3flash'), 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800')}
                                {renderFilterBadge("2.5 Flash", counts.m25flash, props.filterModels.has('25flash'), () => props.toggleFilterModel('25flash'), 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800')}
                            </div>
                            <button onClick={props.clearFilters} className="px-3 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors ml-auto">
                                Xóa bộ lọc
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* File Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50 dark:bg-slate-950/50">
                {props.files.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-300/50 dark:border-slate-700/50 rounded-3xl bg-white/50 dark:bg-slate-900/50">
                        <div className="p-8 bg-white dark:bg-slate-800 rounded-full shadow-xl shadow-indigo-100 dark:shadow-none mb-6 animate-bounce"><FileArchive className="w-16 h-16 text-indigo-200 dark:text-indigo-800" /></div>
                        <h3 className="text-xl font-display font-bold text-slate-600 dark:text-slate-300 mb-2">Chưa có file nào</h3>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mb-8 max-w-xs text-center">Kéo thả file .txt, .zip, .epub, .pdf vào đây</p>
                        <label className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-50 dark:hover:bg-indigo-900 cursor-pointer transition-all flex items-center gap-2">
                            <FileUp className="w-4 h-4" /> Tải Truyện Lên
                            <input type="file" multiple accept=".txt,.zip,.epub,.docx,.doc,.pdf" className="hidden" onChange={props.handleFileUpload} />
                        </label>
                    </div>
                ) : (
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6">
                        {localVisibleFiles.map(file => (
                            <FileCard
                                key={file.id}
                                file={file}
                                isSelected={props.selectedFiles.has(file.id)}
                                storyInfo={props.storyInfo}
                                handleSelectFile={props.handleSelectFile}
                                handleManualFixSingle={props.handleManualFixSingle}
                                requestRetranslateSingle={props.requestRetranslateSingle}
                                handleRescueCopy={props.handleRescueCopy}
                                openEditor={props.openEditor}
                                handleRemoveFile={props.handleRemoveFile}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
