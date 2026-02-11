import React, { memo } from 'react';
import {
    CheckCircle, AlertCircle, Hammer, Loader2, Clock,
    FileText, Check, Bug, UserX, AlignLeft, RefreshCw, Edit3, X, LifeBuoy
} from 'lucide-react';
import { FileItem, FileStatus, StoryInfo } from '../types';
import { getInvalidPronounLines } from '../utils/textHelpers';

interface FileCardProps {
    file: FileItem;
    isSelected: boolean;
    storyInfo: StoryInfo;
    handleSelectFile: (id: string, shiftKey: boolean) => void;
    handleManualFixSingle: (e: React.MouseEvent, id: string) => void;
    requestRetranslateSingle: (e: React.MouseEvent, id: string) => void;
    openEditor: (file: FileItem) => void;
    handleRemoveFile: (id: string) => void;
    handleRescueCopy: (e: React.MouseEvent, file: FileItem) => void;
}

const FileCard: React.FC<FileCardProps> = ({
    file, isSelected, storyInfo,
    handleSelectFile, handleManualFixSingle, requestRetranslateSingle, openEditor, handleRemoveFile, handleRescueCopy
}) => {
    const formatNumber = (num: number) => new Intl.NumberFormat('vi-VN').format(num);
    const isRepairing = file.status === FileStatus.REPAIRING;
    const isProcessing = file.status === FileStatus.PROCESSING;

    // Ratio Calculation
    const ratio = file.originalCharCount > 0 && file.translatedContent ? (file.translatedContent.length / file.originalCharCount) : 0;
    const ratioPercent = Math.round(ratio * 100);
    const isRatioLow = ratio < 0.8 && file.status === FileStatus.ERROR;

    // Check Pronoun Error for Badge
    const hasPronounError = file.status === FileStatus.COMPLETED && file.remainingRawCharCount === 0 && getInvalidPronounLines(file.translatedContent || "", storyInfo.genres).length > 0;

    // Has Content to Show?
    const hasContent = file.translatedContent && file.translatedContent.length > 0;

    // Helper for button visibility (Processing states usually lock actions)
    const isLocked = isProcessing || isRepairing;

    // Dynamic glow effect based on status (10.8.5 style)
    const getCardGlowClass = () => {
        if (isSelected) return 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-200/50 dark:shadow-indigo-500/20';
        if (isProcessing) return 'ring-1 ring-sky-400 shadow-md shadow-sky-200/50 dark:shadow-sky-500/20 animate-pulse';
        if (isRepairing) return 'ring-1 ring-purple-400 shadow-md shadow-purple-200/50 dark:shadow-purple-500/20';
        if (file.status === FileStatus.COMPLETED) {
            if (hasPronounError) return 'hover:shadow-md hover:shadow-fuchsia-200/50 dark:hover:shadow-fuchsia-500/20';
            if (file.remainingRawCharCount === 0) return 'hover:shadow-md hover:shadow-emerald-200/50 dark:hover:shadow-emerald-500/20';
            return 'hover:shadow-md hover:shadow-amber-200/50 dark:hover:shadow-amber-500/20';
        }
        if (file.status === FileStatus.ERROR) return 'hover:shadow-md hover:shadow-rose-200/50 dark:hover:shadow-rose-500/20';
        return 'hover:shadow-md hover:shadow-slate-200/50 dark:hover:shadow-slate-500/20';
    };

    return (
        <div onClick={(e) => { if (!(e.target as HTMLElement).closest('button')) handleSelectFile(file.id, e.shiftKey) }}
            className={`group relative bg-white dark:bg-slate-900 border rounded-xl p-2.5 pb-10 transition-all duration-200 cursor-pointer backdrop-blur-sm
            ${isSelected ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/30' : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'} 
            ${getCardGlowClass()}`}
        >
            <div className="flex flex-col gap-1.5">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm transition-all group-hover:scale-110 
                        ${file.status === FileStatus.COMPLETED ? 'bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-600 dark:from-emerald-950/50 dark:to-emerald-900/30 dark:text-emerald-400' :
                            file.status === FileStatus.ERROR ? 'bg-gradient-to-br from-rose-100 to-rose-200 text-rose-500 dark:from-rose-950/50 dark:to-rose-900/30 dark:text-rose-400' :
                                isRepairing ? 'bg-gradient-to-br from-purple-100 to-purple-200 text-purple-600 dark:from-purple-900/50 dark:to-purple-900/30 dark:text-purple-400' :
                                    isProcessing ? 'bg-gradient-to-br from-sky-100 to-sky-200 text-sky-600 dark:from-sky-900/50 dark:to-sky-900/30 dark:text-sky-400' :
                                        'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 dark:from-slate-800 dark:to-slate-700 dark:text-slate-500'}`}>
                        {file.status === FileStatus.COMPLETED ? <CheckCircle className="w-4 h-4" /> :
                            file.status === FileStatus.ERROR ? <AlertCircle className="w-4 h-4" /> :
                                isRepairing ? <Hammer className="w-4 h-4 animate-bounce" /> :
                                    isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                        <FileText className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0 pr-8">
                        <h3 className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate leading-tight mb-0.5" title={file.name}>{file.name}</h3>
                        <div className="flex items-center gap-2 text-[9px] font-medium text-slate-400 dark:text-slate-500">
                            {file.processingDuration ? (
                                <span className="flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5 text-slate-300 dark:text-slate-500" /> {(file.processingDuration / 1000).toFixed(1)}s
                                </span>
                            ) : (
                                <span className="text-slate-400">{file.status === FileStatus.IDLE ? 'Chờ dịch' : '...'}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Status & Badges */}
                <div className="flex items-center gap-1 flex-wrap">
                    {/* Main Status Badge */}
                    {file.status === FileStatus.COMPLETED ? (
                        file.remainingRawCharCount === 0 ? (
                            hasPronounError ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md border bg-fuchsia-50 dark:bg-fuchsia-950/30 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-900/50 flex items-center gap-0.5 shadow-sm">
                                    <UserX className="w-2.5 h-2.5" /> Xưng Hô
                                </span>
                            ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md border bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 flex items-center gap-0.5 shadow-sm">
                                    <Check className="w-2.5 h-2.5" /> Sạch
                                </span>
                            )
                        ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md border bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900/50 flex items-center gap-0.5 shadow-sm">
                                <Bug className="w-2.5 h-2.5" /> {file.remainingRawCharCount} Raw
                            </span>
                        )
                    ) : (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border shadow-sm
                            ${file.status === FileStatus.ERROR ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50' :
                                isProcessing ? 'bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-900/50' :
                                    'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                            {file.status === FileStatus.ERROR ? (isRatioLow ? 'Thiếu nội dung' : 'Lỗi') :
                                isProcessing && hasContent ? 'Streaming...' : file.status}
                        </span>
                    )}

                    {file.usedModel && (
                        <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md truncate max-w-[70px] shadow-sm">
                            {file.usedModel.replace('gemini-', '').replace('-preview', '')}
                        </span>
                    )}
                </div>

                {/* Metrics - Always Visible */}
                <div className={`flex justify-between items-center gap-1 text-[9px] font-mono p-1.5 rounded-lg border shadow-inner
                    ${isRatioLow ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-900/40' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700'}`}>

                    <div className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400" title="Ký tự gốc">
                        <AlignLeft className="w-2.5 h-2.5" /> {formatNumber(file.originalCharCount)}
                    </div>

                    {hasContent ? (
                        <>
                            <div className="flex justify-center">
                                <div className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold flex items-center justify-center min-w-[28px] shadow-sm
                                    ${ratioPercent < 50 ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400' :
                                        ratioPercent > 250 ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400' :
                                            ratioPercent === 0 ? 'bg-slate-100 dark:bg-slate-700 text-slate-400' :
                                                'bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400'}`} title="Tỷ lệ dịch">
                                    {ratioPercent}%
                                </div>
                            </div>

                            <div className="flex items-center justify-end font-bold text-slate-700 dark:text-slate-300" title="Ký tự dịch">
                                <span className={isRatioLow ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>{formatNumber(file.translatedContent!.length)}</span>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 text-right">
                            <span className="text-[8px] text-slate-300 dark:text-slate-600 italic">
                                Chờ dịch...
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Button (Keep Top Right - Always Visible) */}
            <button
                onClick={(e) => { e.stopPropagation(); handleRemoveFile(file.id); }}
                className="absolute -top-1.5 -right-1.5 bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-500 rounded-full p-0.5 shadow-md border border-slate-100 dark:border-slate-700 transition-all z-10 opacity-0 group-hover:opacity-100 hover:scale-110"
                title="Xóa file"
            >
                <X className="w-3 h-3" />
            </button>

            {/* Actions Bar (Bottom Right - Slide in on hover) */}
            <div className="absolute bottom-2 right-2 flex gap-1 z-20 translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-200">
                {/* Smart Fix - Only if Completed */}
                {file.status === FileStatus.COMPLETED && (
                    <button onClick={(e) => { e.stopPropagation(); handleManualFixSingle(e, file.id); }} className="p-1.5 bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 rounded-lg shadow-md border border-slate-100 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:scale-110 transition-all" title="Quick Fix">
                        <Hammer className="w-3.5 h-3.5" />
                    </button>
                )}

                {/* Editor - Always Available */}
                <button onClick={(e) => { e.stopPropagation(); openEditor(file); }} className="p-1.5 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-lg shadow-md border border-slate-100 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:scale-110 transition-all" title="Xem/Sửa">
                    <Edit3 className="w-3.5 h-3.5" />
                </button>

                {/* Rescue - Always Available */}
                <button onClick={(e) => { e.stopPropagation(); handleRescueCopy(e, file); }} className="p-1.5 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 rounded-lg shadow-md border border-slate-100 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:scale-110 transition-all" title="Cứu hộ (Copy Prompt)">
                    <LifeBuoy className="w-3.5 h-3.5" />
                </button>

                {/* Retranslate / Start - Always Available (Unless locked) */}
                {!isLocked && (
                    <button onClick={(e) => { e.stopPropagation(); requestRetranslateSingle(e, file.id); }} className="p-1.5 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg shadow-md border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-110 transition-all" title="Dịch lại / Dịch ngay">
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default memo(FileCard);
