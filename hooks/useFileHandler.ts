
import React, { useState } from 'react';
import { FileItem, FileStatus, StoryInfo } from '../types';
import { unzipFiles, parseEpub, parseDocx, parsePdf, readFileAsText, parseFilenameMetadata, renumberFiles, sortFiles, createMergedFile, downloadRawAsZip, downloadTranslatedAsZip, generateExportFileName, downloadTextFile, generateEpub, downloadEpubFile, fileToBase64, base64ToFile, downloadJsonFile } from '../utils/fileHelpers';
import { detectJunkChapter } from '../utils/textHelpers';

export const useFileHandler = (
    core: any, // useCoreState return type
    ui: any    // useUIState return type
) => {
    
    // --- IMPORT LOGIC ---
    const processFiles = async (fileList: File[]) => {
        if (fileList.length === 0) return;
        ui.setImportProgress({ current: 0, total: fileList.length, message: 'Đang chuẩn bị...' });
        const processedNewFiles: FileItem[] = [];
        let updatedStoryInfo = { ...core.storyInfo };
        let infoFound = false;
        let needsExplicitSplit = false;

        try {
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                ui.setImportProgress({ current: i, total: fileList.length, message: `Đang đọc ${file.name}...` });
                await new Promise(r => setTimeout(r, 20));

                if (file.name.endsWith('.zip')) {
                    try {
                        const { title, author } = parseFilenameMetadata(file.name);
                        if (title && !updatedStoryInfo.title) { updatedStoryInfo.title = title; if (author) updatedStoryInfo.author = author; infoFound = true; }
                        const extractedFiles = await unzipFiles(file, (current, total, percent) => {
                            ui.setImportProgress({ current: percent, total: 100, message: `Đang mở chương ${current} / ${total}` });
                        });
                        processedNewFiles.push(...extractedFiles);
                    } catch (e) { ui.addToast(`Lỗi ZIP: ${file.name}`, 'error'); }
                } else if (file.name.endsWith('.epub')) {
                    try {
                        const result = await parseEpub(file, (current, total, percent) => {
                            ui.setImportProgress({ current: percent, total: 100, message: `Đang đọc chương ${current} / ${total}` });
                        });
                        if (result.info.title && !updatedStoryInfo.title) { updatedStoryInfo.title = result.info.title; if (result.info.author && !updatedStoryInfo.author) { updatedStoryInfo.author = result.info.author; } infoFound = true; }
                        if (result.coverBlob) { core.setCoverImage(new File([result.coverBlob], "cover.jpg", { type: result.coverBlob.type })); }
                        if (result.needsSplit && result.files.length === 1) { needsExplicitSplit = true; processedNewFiles.push(result.files[0]); } else { processedNewFiles.push(...result.files); }
                    } catch (e: any) { ui.addToast(`Lỗi EPUB: ${e.message}`, 'error'); }
                } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
                    try {
                        const { content, title, author } = await parseDocx(file);
                        if (title && !updatedStoryInfo.title) { updatedStoryInfo.title = title; infoFound = true; }
                        if (author && !updatedStoryInfo.author) { updatedStoryInfo.author = author; infoFound = true; }
                        if (!infoFound) { const meta = parseFilenameMetadata(file.name); if(meta.title) updatedStoryInfo.title = meta.title; if(meta.author) updatedStoryInfo.author = meta.author; infoFound = true; }
                        processedNewFiles.push({ id: crypto.randomUUID(), name: file.name, content: content, translatedContent: null, status: FileStatus.IDLE, retryCount: 0, originalCharCount: content.length, remainingRawCharCount: 0 });
                    } catch(e: any) { ui.addToast(`Lỗi DOCX: ${e.message}`, 'error'); }
                } else if (file.name.endsWith('.pdf')) {
                    try {
                        const { content, files, title, author } = await parsePdf(file, (percent, msg) => ui.setImportProgress({current: percent, total: 100, message: msg}));
                        if (title && !updatedStoryInfo.title) { updatedStoryInfo.title = title; infoFound = true; }
                        if (author && !updatedStoryInfo.author) { updatedStoryInfo.author = author; infoFound = true; }
                        if (!infoFound) { const meta = parseFilenameMetadata(file.name); if(meta.title) updatedStoryInfo.title = meta.title; if(meta.author) updatedStoryInfo.author = meta.author; infoFound = true; }
                        if (files.length > 0) { processedNewFiles.push(...files); } else { processedNewFiles.push({ id: crypto.randomUUID(), name: file.name, content: content, translatedContent: null, status: FileStatus.IDLE, retryCount: 0, originalCharCount: content.length, remainingRawCharCount: 0 }); }
                    } catch (e: any) { ui.addToast(`Lỗi PDF: ${e.message}`, 'error'); }
                } else if (file.name.endsWith('.txt')) {
                    const content = await readFileAsText(file);
                    processedNewFiles.push({ id: crypto.randomUUID(), name: file.name, content: content, translatedContent: null, status: FileStatus.IDLE, retryCount: 0, originalCharCount: content.length, remainingRawCharCount: 0 });
                }
            }

            if (processedNewFiles.length === 0) { ui.setImportProgress(null); return; }
            
            const hasLargeFile = processedNewFiles.some(f => f.content.length > 10000);
            
            if (processedNewFiles.length > 1 && hasLargeFile && !needsExplicitSplit) {
                ui.setImportModal({ isOpen: false, pendingFiles: processedNewFiles, tempInfo: infoFound ? updatedStoryInfo : null });
                ui.setZipActionModal(true);
                ui.setImportProgress(null);
                return;
            }

            if (needsExplicitSplit || hasLargeFile) {
                ui.setImportProgress({ current: 100, total: 100, message: 'Phát hiện chương gộp. Đang hợp nhất để tách lại...' });
                await new Promise(r => setTimeout(r, 100));
                const sortedForMerge = sortFiles(processedNewFiles);
                const hugeContent = sortedForMerge.map(f => f.content).join('\n\n');
                const mergedTitle = infoFound ? updatedStoryInfo.title : sortedForMerge[0].name;
                if (infoFound) core.setStoryInfo(updatedStoryInfo);
                ui.setSplitterModal({ isOpen: true, content: hugeContent, name: mergedTitle });
                ui.setImportProgress(null);
                return;
            }

            if (core.files.length > 0) {
                ui.setImportModal({ isOpen: true, pendingFiles: processedNewFiles, tempInfo: infoFound ? updatedStoryInfo : null });
            } else {
                const sorted = sortFiles(processedNewFiles);
                core.setFiles(sorted);
                if (infoFound) core.setStoryInfo(updatedStoryInfo);
                ui.addToast(`Đã thêm ${processedNewFiles.length} file`, 'success');
            }
        } catch (e: any) {
            ui.addToast(`Lỗi nhập file: ${e.message}`, 'error');
        } finally {
            ui.setImportProgress(null);
        }
    };

    const handleSplitConfirm = (splitFiles: FileItem[]) => {
        ui.setSplitterModal({ isOpen: false, content: '', name: '' });
        if (splitFiles.length === 0) { ui.addToast("Không tách được chương nào", 'error'); return; }
        if (core.files.length > 0) {
            ui.setImportModal({ isOpen: true, pendingFiles: splitFiles, tempInfo: null });
        } else {
            core.setFiles(splitFiles);
            ui.addToast(`Đã tách thành ${splitFiles.length} chương`, 'success');
        }
    };

    const handleImportAppend = () => {
        let nextIndex = 1;
        if (core.files.length > 0) {
            const lastFile = core.files[core.files.length - 1];
            const match = lastFile.name.match(/^(\d{5})\s/);
            if (match) { nextIndex = parseInt(match[1], 10) + 1; } else { nextIndex = core.files.length + 1; }
        }
        const renumberedFiles = renumberFiles(ui.importModal.pendingFiles, nextIndex);
        const merged = [...core.files, ...renumberedFiles];
        core.setFiles(sortFiles(merged));
        ui.setImportModal({ isOpen: false, pendingFiles: [] });
        ui.addToast(`Đã thêm nối tiếp ${ui.importModal.pendingFiles.length} file`, 'success');
    };

    const handleImportOverwrite = () => {
        core.setFiles(sortFiles(ui.importModal.pendingFiles));
        if (ui.importModal.tempInfo) {
            core.setStoryInfo({ ...ui.importModal.tempInfo, languages: ['Convert thô'], genres: ['Tiên Hiệp'], mcPersonality: [], worldSetting: [], sectFlow: [], contextNotes: '', summary: '' });
            core.setAdditionalDictionary('');
            core.setCoverImage(null);
        }
        ui.setImportModal({ isOpen: false, pendingFiles: [] });
        ui.addToast(`Đã tạo truyện mới với ${ui.importModal.pendingFiles.length} file`, 'success');
    };

    const handleZipKeepSeparate = () => {
        ui.setZipActionModal(false);
        const pending = ui.importModal.pendingFiles;
        const info = ui.importModal.tempInfo;
        if (pending.length === 0) return;
        if (core.files.length > 0) {
            ui.setImportModal({ isOpen: true, pendingFiles: pending, tempInfo: info });
        } else {
            core.setFiles(sortFiles(pending));
            if (info) core.setStoryInfo(info);
            ui.addToast(`Đã nhập ${pending.length} file (Giữ nguyên cấu trúc)`, 'success');
            ui.setImportModal({ isOpen: false, pendingFiles: [] });
        }
    };

    const handleZipMergeAndSplit = () => {
        ui.setZipActionModal(false);
        const pending = ui.importModal.pendingFiles;
        const info = ui.importModal.tempInfo;
        if (pending.length === 0) return;
        const sortedForMerge = sortFiles(pending);
        const hugeContent = sortedForMerge.map(f => f.content).join('\n\n');
        const mergedTitle = info ? info.title : sortedForMerge[0].name;
        if (info) core.setStoryInfo(info);
        ui.setSplitterModal({ isOpen: true, content: hugeContent, name: mergedTitle });
        ui.setImportModal({ isOpen: false, pendingFiles: [] });
    };

    const handlePasteConfirm = (title: string, content: string) => {
        const contentLen = content.length;
        if (contentLen > 10000) {
            ui.setSplitterModal({ isOpen: true, content: content, name: title || "Truyện dán" });
            return;
        }
        const newFile: FileItem = { id: crypto.randomUUID(), name: title || `Chương ${core.files.length + 1}`, content: content, translatedContent: null, status: FileStatus.IDLE, retryCount: 0, originalCharCount: contentLen, remainingRawCharCount: 0 };
        if (core.files.length > 0) {
            ui.setImportModal({ isOpen: true, pendingFiles: [newFile], tempInfo: null });
        } else {
            core.setFiles([newFile]);
            ui.addToast("Đã thêm nội dung", "success");
        }
    };

    // --- DOWNLOAD LOGIC ---
    const handleDownloadMerged = () => {
        ui.setActionProgress({ current: 0, total: 100, message: "Đang gộp và định dạng nội dung (Local AI)..." });
        setTimeout(() => {
            const content = createMergedFile(core.files);
            if(!content) { ui.addToast("Chưa có nội dung", 'error'); ui.setActionProgress(null); return; }
            const fileName = generateExportFileName(core.storyInfo.title, core.storyInfo.author, '.txt');
            downloadTextFile(fileName, content);
            ui.addToast("Đã tải xuống file Gộp (Đã lọc rác & định dạng)", 'success');
            ui.setActionProgress(null);
        }, 100);
    };

    const handleDownloadRaw = async () => {
        if (core.files.length === 0) { ui.addToast("Không có file nào", 'error'); return; }
        try {
            ui.setActionProgress({ current: 0, total: 100, message: "Đang chuẩn bị ZIP Raw (Auto Clean)..." });
            const fileName = generateExportFileName(core.storyInfo.title, core.storyInfo.author, '_Raw.zip');
            await downloadRawAsZip(core.files, fileName, (percent, msg) => { ui.setActionProgress({ current: percent, total: 100, message: msg }); });
            ui.addToast("Đã tải xuống file ZIP raw (Đã lọc rác)", 'success');
        } catch (e: any) { ui.addToast(`Lỗi tạo ZIP: ${e.message}`, 'error'); } finally { ui.setActionProgress(null); }
    };

    const handleDownloadTranslatedZip = async () => {
        if (core.files.length === 0) { ui.addToast("Không có file nào", 'error'); return; }
        try {
            ui.setActionProgress({ current: 0, total: 100, message: "Đang chuẩn bị ZIP Dịch (Auto Clean)..." });
            const fileName = generateExportFileName(core.storyInfo.title, core.storyInfo.author, '_Dich.zip');
            await downloadTranslatedAsZip(core.files, fileName, (percent, msg) => { ui.setActionProgress({ current: percent, total: 100, message: msg }); });
            ui.addToast("Đã tải xuống file ZIP các chương dịch (Đã lọc rác & định dạng)", 'success');
        } catch (e: any) { ui.addToast(`Lỗi: ${e.message}`, 'error'); } finally { ui.setActionProgress(null); }
    };

    const performEpubGeneration = async (updatedInfo: StoryInfo, updatedCover: File | null) => {
        ui.setShowEpubModal(false);
        const readyFiles = core.files.filter(f => f.status === FileStatus.COMPLETED && f.translatedContent);
        if (readyFiles.length === 0) return;
        ui.setActionProgress({ current: 0, total: 100, message: "Đang tạo Ebook chuẩn (Batch Processing)..." });
        try {
            core.setStoryInfo(updatedInfo);
            if (updatedCover !== core.coverImage) core.setCoverImage(updatedCover);
            const blob = await generateEpub(
                readyFiles, updatedInfo, updatedCover, updatedInfo.summary || "", 
                (percent) => ui.setActionProgress({ current: percent, total: 100, message: `Đang đóng gói EPUB ${percent}%` })
            );
            const fileName = generateExportFileName(updatedInfo.title, updatedInfo.author, '.epub');
            downloadEpubFile(fileName, blob);
            ui.addToast("Đã xuất bản EPUB thành công!", "success");
        } catch (e: any) { ui.addToast(`Lỗi tạo EPUB: ${e.message}`, "error"); } finally { ui.setActionProgress(null); }
    };

    const handleScanJunk = () => {
        if (ui.filterStatuses.has('selected') && ui.selectedFiles.size > 0) {
            ui.setSelectedFiles(new Set());
            ui.setFilterStatuses(new Set());
            ui.addToast("Đã hủy chế độ xem rác. Trở về danh sách đầy đủ.", 'info');
            return;
        }
        const junkIds = new Set<string>();
        core.files.forEach(f => { if (detectJunkChapter(f.name, f.content)) junkIds.add(f.id); });
        if (junkIds.size > 0) {
            ui.setSelectedFiles(junkIds);
            ui.setFilterStatuses(new Set(['selected']));
            ui.setCurrentPage(0);
            ui.addToast(`Đã tìm thấy ${junkIds.size} chương rác. (Nhấn lại nút này để bỏ chọn)`, 'warning');
        } else {
            ui.addToast("Không tìm thấy chương rác nào rõ ràng.", 'success');
        }
    };

    const handleBackup = async () => {
        let coverBase64 = null;
        if (core.coverImage) {
            try { coverBase64 = await fileToBase64(core.coverImage); } catch(e) { console.warn("Lỗi mã hóa ảnh bìa:", e); }
        }
        const dataToSave = { ...core.stateRef.current, coverImageBase64: coverBase64, lastSaved: new Date().toISOString() };
        const { coverImage: _, ...safeData } = dataToSave;
        downloadJsonFile(`Backup_${core.storyInfo.title || 'Data'}_${new Date().toISOString().split('T')[0]}.json`, safeData);
        ui.addToast("Đã xuất file Backup (.json) kèm Ảnh bìa", "success");
    };

    const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await readFileAsText(file);
            const data = JSON.parse(text);
            if (data.files && Array.isArray(data.files)) {
                core.setFiles(data.files);
                if (data.storyInfo) core.setStoryInfo(data.storyInfo);
                if (data.promptTemplate) core.setPromptTemplate(data.promptTemplate);
                if (data.additionalDictionary) core.setAdditionalDictionary(data.additionalDictionary);
                if (data.coverImageBase64) {
                    try { core.setCoverImage(base64ToFile(data.coverImageBase64, "restored_cover.png")); } catch (e) {}
                }
                ui.addToast("Khôi phục dữ liệu thành công!", "success");
            } else { ui.addToast("File Backup không hợp lệ", "error"); }
        } catch (err: any) { ui.addToast(`Lỗi khôi phục: ${err.message}`, "error"); }
        e.target.value = '';
    };

    return {
        processFiles,
        handleSplitConfirm,
        handleImportAppend,
        handleImportOverwrite,
        handleZipKeepSeparate,
        handleZipMergeAndSplit,
        handlePasteConfirm,
        handleDownloadMerged,
        handleDownloadRaw,
        handleDownloadTranslatedZip,
        performEpubGeneration,
        handleScanJunk,
        handleBackup,
        handleRestore
    };
};
