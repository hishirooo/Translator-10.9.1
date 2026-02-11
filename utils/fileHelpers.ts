
import JSZip from 'jszip';
import { FileItem, FileStatus, StoryInfo } from '../types';
import { formatBookStyle } from './textHelpers';
import * as pdfjsLib from 'pdfjs-dist';
import { REGEX_PATTERNS } from './regexPatterns';

// Configure PDF Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

const padNumber = (num: number, size: number = 5): string => {
    let s = String(num);
    while (s.length < size) s = "0" + s;
    return s;
};

const sanitizeFilename = (name: string): string => {
    return name.replace(/[:/\\?%*|"<>]/g, ' ').replace(/\s+/g, ' ').trim();
};

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

export const base64ToFile = (base64: string, filename: string): File => {
    try {
        const arr = base64.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/png';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        return new File([u8arr], filename, { type: mime });
    } catch (e) {
        console.error("Lỗi chuyển đổi ảnh từ backup:", e);
        return new File([""], "error.png", { type: "image/png" });
    }
};

export const generateExportFileName = (title: string, author: string, extension: string = ""): string => {
    const safeTitle = title ? title.trim() : "Truyen_Moi";
    const safeAuthor = author ? author.trim() : "";
    let baseName = safeAuthor ? `${safeTitle}_${safeAuthor}` : safeTitle;
    baseName = baseName.replace(/[\\/:*?"<>|]/g, "").trim();
    if (!baseName) baseName = "Exported_Story";
    return extension ? `${baseName}${extension}` : baseName;
};

const cleanContentArtifacts = (content: string): string => {
    if (!content) return "";
    let clean = content;
    clean = clean.replace(/^(?:###)?\s*EPUB_CHAPTER_SPLIT\s*.*$/gim, '');
    clean = clean.replace(/^Part \d+ \(Split\)$/gim, '');
    clean = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    clean = formatBookStyle(clean);
    return clean.trim();
};

export const renumberFiles = (files: FileItem[], startIndex: number): FileItem[] => {
    return files.map((file, index) => {
        const currentIndex = startIndex + index;
        const paddedIndex = padNumber(currentIndex);
        const cleanName = file.name.replace(/^\d{5}\s+/, '');
        return { ...file, name: `${paddedIndex} ${cleanName}` };
    });
};

export const sortFiles = (list: FileItem[]) => { 
    const re = /(\d+)/; 
    return [...list].sort((a, b) => { 
        const aParts = a.name.split(re); 
        const bParts = b.name.split(re); 
        const len = Math.min(aParts.length, bParts.length); 
        for (let i = 0; i < len; i++) { 
            const aPart = aParts[i]; 
            const bPart = bParts[i]; 
            if (aPart === bPart) continue; 
            const aNum = parseInt(aPart, 10); 
            const bNum = parseInt(bPart, 10); 
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum; 
            return aPart.localeCompare(bPart); 
        } 
        return aParts.length - bParts.length; 
    }); 
};

export const parseFilenameMetadata = (filename: string): { title: string, author: string } => {
    let cleanName = filename.replace(/\.(epub|zip|docx|doc|txt|rar|pdf|xhtml|html|xml)$/i, '');
    cleanName = cleanName.replace(/\s*\(\d+\)$/, '');
    const suffixRegex = /([_\-\s]+(part|tap|tập|quyen|quyển|vol|book|phan|phần|chuong|chương)[_\-\s]*\d+.*$)|([_\-\s]+(full|prc|epub|mobi|azw3|text|convert|vp|vpro).*$)/i;
    cleanName = cleanName.replace(suffixRegex, '');
    cleanName = cleanName.trim();
    let title = cleanName;
    let author = "";
    if (cleanName.includes('_')) {
        const parts = cleanName.split('_');
        if (parts.length >= 2) {
            author = parts.pop()?.trim() || "";
            title = parts.join(' ').trim();
        }
    } else if (cleanName.includes(' - ')) {
        const parts = cleanName.split(' - ');
        if (parts.length >= 2) {
            author = parts.pop()?.trim() || "";
            title = parts.join(' - ').trim();
        }
    }
    title = title.replace(/_/g, ' ').trim();
    author = author.replace(/_/g, ' ').trim();
    return { title, author };
};

export const unzipFiles = async (file: File, onProgress?: (current: number, total: number, percent: number) => void): Promise<FileItem[]> => {
  const zip = new JSZip();
  if (onProgress) onProgress(0, 0, 5);
  const loadedZip = await zip.loadAsync(file);
  const files: FileItem[] = [];
  const filePaths = Object.keys(loadedZip.files).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const total = filePaths.length;
  const BATCH_SIZE = 50; 

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batchPaths = filePaths.slice(i, i + BATCH_SIZE);
    const batchPromises = batchPaths.map(async (relativePath) => {
        const zipEntry = loadedZip.files[relativePath];
        if (!zipEntry.dir) {
            const lowerName = zipEntry.name.toLowerCase();
            if (lowerName.endsWith('.txt') || lowerName.endsWith('.xml') || lowerName.endsWith('.html') || lowerName.endsWith('.md') || lowerName.endsWith('.xhtml')) {
                let content = await zipEntry.async('string');
                if (lowerName.endsWith('.html') || lowerName.endsWith('.xhtml') || lowerName.endsWith('.xml')) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(content, "text/html");
                        const scripts = doc.getElementsByTagName('script');
                        const styles = doc.getElementsByTagName('style');
                        for (let j = scripts.length - 1; j >= 0; j--) scripts[j].parentNode?.removeChild(scripts[j]);
                        for (let j = styles.length - 1; j >= 0; j--) styles[j].parentNode?.removeChild(styles[j]);
                        const text = doc.body ? doc.body.innerText : (doc.documentElement.textContent || content);
                        content = text.trim();
                    } catch (e) { console.warn("Failed to parse HTML/XHTML in zip", e); }
                }
                const pureName = zipEntry.name.split('/').pop() || zipEntry.name;
                return { id: crypto.randomUUID(), name: pureName, content: content, translatedContent: null, status: FileStatus.IDLE, retryCount: 0, originalCharCount: content.length, remainingRawCharCount: 0 } as FileItem;
            }
        }
        return null;
    });
    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(res => { if (res) files.push(res); });
    if (onProgress) {
        const currentCount = Math.min(i + BATCH_SIZE, total);
        const percent = 10 + Math.round((currentCount / total) * 90);
        onProgress(currentCount, total, percent);
    }
    await new Promise(r => setTimeout(r, 0));
  }
  if (onProgress) onProgress(total, total, 100);
  return files;
};

export const parseDocx = async (file: File): Promise<{ content: string, title?: string, author?: string }> => {
    try {
        const zip = new JSZip();
        const loadedZip = await zip.loadAsync(file);
        const xmlContent = await loadedZip.file("word/document.xml")?.async("string");
        if (!xmlContent) throw new Error("File DOCX không hợp lệ");
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
        const paragraphs = xmlDoc.getElementsByTagName("w:p");
        let fullText = "";
        for (let i = 0; i < paragraphs.length; i++) {
            const p = paragraphs[i];
            let pText = "";
            const texts = p.getElementsByTagName("w:t");
            for (let j = 0; j < texts.length; j++) pText += texts[j].textContent;
            if (pText) fullText += pText + "\n";
        }
        let title = undefined;
        let author = undefined;
        const coreXml = await loadedZip.file("docProps/core.xml")?.async("string");
        if (coreXml) {
            const coreDoc = parser.parseFromString(coreXml, "text/xml");
            const titleNode = coreDoc.getElementsByTagName("dc:title")[0] || coreDoc.getElementsByTagName("title")[0];
            const creatorNode = coreDoc.getElementsByTagName("dc:creator")[0] || coreDoc.getElementsByTagName("creator")[0];
            if (titleNode && titleNode.textContent) title = titleNode.textContent.trim();
            if (creatorNode && creatorNode.textContent) author = creatorNode.textContent.trim();
        }
        return { content: fullText.trim(), title, author };
    } catch (e: any) { throw new Error(`Lỗi đọc file DOCX: ${e.message}`); }
};

export const parsePdf = async (file: File, onProgress?: (percent: number, msg: string) => void): Promise<{ content: string, files: FileItem[], title?: string, author?: string }> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;
        let metaTitle = undefined;
        let metaAuthor = undefined;
        try {
            const metadata = await pdf.getMetadata();
            if (metadata.info) {
                if ((metadata.info as any).Title) metaTitle = (metadata.info as any).Title;
                if ((metadata.info as any).Author) metaAuthor = (metadata.info as any).Author;
            }
        } catch (e) {}
        const pageCache: string[] = new Array(totalPages + 1).fill("");
        const BATCH_SIZE = 10;
        for (let i = 1; i <= totalPages; i += BATCH_SIZE) {
            const end = Math.min(i + BATCH_SIZE - 1, totalPages);
            const promises = [];
            if (onProgress) onProgress(Math.round(((i - 1) / totalPages) * 70), `Đang đọc trang ${i}-${end}/${totalPages}...`);
            for (let p = i; p <= end; p++) {
                promises.push(pdf.getPage(p).then(async (page) => {
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(' ');
                    page.cleanup();
                    if (pageText.length < 50 && textContent.items.length < 5) return `\n\n[TRANG ${p}: KHÔNG TÌM THẤY VĂN BẢN]\n`;
                    else return pageText + "\n\n";
                }));
            }
            const results = await Promise.all(promises);
            results.forEach((txt, idx) => { pageCache[i + idx] = txt; });
            await new Promise(r => setTimeout(r, 10));
        }
        if (onProgress) onProgress(80, "Đang kiểm tra mục lục...");
        const outline = await pdf.getOutline();
        const splitFiles: FileItem[] = [];
        let fullText = "";
        if (outline && outline.length > 0) {
            if (onProgress) onProgress(90, "Phát hiện mục lục! Đang chia chương...");
            const getPageIndex = async (dest: any): Promise<number> => {
                if (typeof dest === 'string') return await pdf.getPageIndex(await pdf.getDestination(dest));
                else if (Array.isArray(dest)) return await pdf.getPageIndex(dest[0]);
                return -1;
            };
            const chapters: { title: string, startPage: number }[] = [];
            for (const item of outline) {
                if (item.dest) {
                    try {
                        const pageIdx = await getPageIndex(item.dest);
                        if (pageIdx >= 0) chapters.push({ title: item.title, startPage: pageIdx + 1 });
                    } catch (e) {}
                }
            }
            chapters.sort((a, b) => a.startPage - b.startPage);
            const uniqueChapters = chapters.filter((c, index, self) => index === 0 || c.startPage > self[index - 1].startPage);
            for (let i = 0; i < uniqueChapters.length; i++) {
                const current = uniqueChapters[i];
                const next = uniqueChapters[i + 1];
                const startPage = current.startPage;
                const endPage = next ? next.startPage - 1 : totalPages;
                let chapterContent = "";
                for (let p = startPage; p <= endPage; p++) chapterContent += pageCache[p] || "";
                if (chapterContent.trim().length > 0) {
                    const chapterIndex = splitFiles.length + 1;
                    let safeTitle = sanitizeFilename(current.title);
                    if (safeTitle.length > 80) safeTitle = safeTitle.substring(0, 80);
                    splitFiles.push({ id: crypto.randomUUID(), name: `${padNumber(chapterIndex)} ${safeTitle}`, content: chapterContent.trim(), translatedContent: null, status: FileStatus.IDLE, retryCount: 0, originalCharCount: chapterContent.length, remainingRawCharCount: 0 });
                }
            }
        }
        if (splitFiles.length === 0) fullText = pageCache.join("");
        if (onProgress) onProgress(100, "Hoàn tất.");
        return { content: fullText.trim(), files: splitFiles, title: metaTitle, author: metaAuthor };
    } catch (e: any) { throw new Error(`Lỗi đọc PDF: ${e.message}`); }
};

export const readDocumentContent = async (file: File): Promise<string> => {
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.docx')) {
        const result = await parseDocx(file);
        return result.content;
    } else if (fileName.endsWith('.pdf')) {
        const result = await parsePdf(file);
        if (result.files.length > 0) return result.files.map(f => f.content).join("\n\n");
        return result.content;
    } else {
        return await readFileAsText(file);
    }
};

export const splitContentByRegex = (content: string, customRegex?: string): FileItem[] => {
    // UPDATED: Use Universal Regex Pattern if custom is not provided
    const regex = customRegex ? new RegExp(customRegex, 'im') : REGEX_PATTERNS.UNIVERSAL_CHAPTER_MATCH;
    
    const cleanSource = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleanSource.split('\n');
    const files: FileItem[] = [];
    let currentBuffer: string[] = [];
    let currentTitle = "Mở đầu / Giới thiệu";
    
    const finalizeChapter = (title: string, buffer: string[]) => {
        if (buffer.length === 0) return;
        if (buffer.length > 0 && /^(?:###)?\s*EPUB_CHAPTER_SPLIT/.test(buffer[0])) buffer.shift();
        const rawContent = buffer.join('\n').trim();
        if (rawContent.length < 30) return; // Skip ghost chapters
        let safeTitle = sanitizeFilename(title).replace(/^###EPUB_CHAPTER_SPLIT###\s*/, '').replace(/^[\*\->=\s]+/, '').trim();
        if (safeTitle.length > 80) safeTitle = safeTitle.substring(0, 80) + "...";
        // Index is files.length + 1
        const index = files.length + 1;
        if (!safeTitle) safeTitle = `Chương ${index}`;
        files.push({ id: crypto.randomUUID(), name: `${padNumber(index)} ${safeTitle}`, content: rawContent, translatedContent: null, status: FileStatus.IDLE, retryCount: 0, originalCharCount: rawContent.length, remainingRawCharCount: 0 });
    };
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) { currentBuffer.push(line); continue; }
        const cleanLine = trimmedLine.replace(/^[\s\*\->=\+]+/, '');
        if (regex.test(cleanLine)) {
            if (currentBuffer.length > 0) {
                finalizeChapter(currentTitle, currentBuffer);
            }
            currentTitle = cleanLine;
            currentBuffer = [line]; 
        } else {
            currentBuffer.push(line);
        }
    }
    finalizeChapter(currentTitle, currentBuffer);
    
    if (files.length === 0 && cleanSource.length > 0) {
         files.push({ id: crypto.randomUUID(), name: "00001 Toàn Văn (Không tách được)", content: cleanSource, translatedContent: null, status: FileStatus.IDLE, retryCount: 0, originalCharCount: cleanSource.length, remainingRawCharCount: 0 });
    }
    return files;
};

export const splitContentByLength = (content: string, charLimit: number = 6000, mode: 'preserve' | 'reindex' = 'preserve'): FileItem[] => {
    const cleanSource = content.replace(/^(?:###)?\s*EPUB_CHAPTER_SPLIT\s*.*$/gim, '');
    const files: FileItem[] = [];
    let currentIndex = 0;
    let partCount = 1;
    const totalLen = cleanSource.length;
    while (currentIndex < totalLen) {
        let endIndex = Math.min(currentIndex + charLimit, totalLen);
        if (endIndex < totalLen) {
            const nextNewline = cleanSource.indexOf('\n', endIndex);
            if (nextNewline !== -1 && (nextNewline - endIndex) < 500) endIndex = nextNewline + 1; 
            else {
                 const prevNewline = cleanSource.lastIndexOf('\n', endIndex);
                 if (prevNewline > currentIndex) endIndex = prevNewline + 1;
            }
        }
        let chunkText = cleanSource.substring(currentIndex, endIndex).trim(); 
        if (chunkText.length > 0) {
             let finalContent = chunkText;
             let finalName = "";
             if (mode === 'reindex') {
                 const header = `Chương ${partCount}`;
                 finalName = `${padNumber(partCount)} ${header}`;
                 finalContent = `${header}\n\n${chunkText}`;
             } else {
                 finalName = `${padNumber(partCount)} Part ${partCount} (Split)`;
             }
             files.push({ id: crypto.randomUUID(), name: finalName, content: finalContent, translatedContent: null, status: FileStatus.IDLE, retryCount: 0, originalCharCount: chunkText.length, remainingRawCharCount: 0 });
            partCount++;
        }
        currentIndex = endIndex;
    }
    return files;
};

export const parseEpub = async (file: File, onProgress?: (current: number, total: number, percent: number) => void): Promise<{ files: FileItem[], info: Partial<StoryInfo>, coverBlob: Blob | null, needsSplit: boolean }> => {
  const zip = new JSZip();
  if (onProgress) onProgress(0, 0, 5);
  const loadedZip = await zip.loadAsync(file);
  if (onProgress) onProgress(0, 0, 15);
  const containerXml = await loadedZip.file("META-INF/container.xml")?.async("string");
  if (!containerXml) throw new Error("File EPUB lỗi: Không tìm thấy META-INF/container.xml");
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, "text/xml");
  const rootFileNode = containerDoc.getElementsByTagName("rootfile")[0];
  const opfPath = rootFileNode?.getAttribute("full-path");
  if (!opfPath) throw new Error("File EPUB lỗi: Không tìm thấy file gốc (rootfile)");
  const opfContent = await loadedZip.file(opfPath)?.async("string");
  if (!opfContent) throw new Error(`File EPUB lỗi: Không tìm thấy file OPF`);
  const opfDoc = parser.parseFromString(opfContent, "text/xml");
  const { title: fnTitle, author: fnAuthor } = parseFilenameMetadata(file.name);
  const getMetaText = (tag: string) => {
      const el = opfDoc.getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", tag)[0] || opfDoc.getElementsByTagName("dc:" + tag)[0] || opfDoc.getElementsByTagName(tag)[0];
      return el ? el.textContent?.trim() || "" : "";
  };
  let metadataTitle = getMetaText("title");
  let metadataAuthor = getMetaText("creator");
  const isGeneric = (s: string) => !s || s.trim() === "" || /^(unknown|untitled|ebook|sách|truyện|no title|generated by|calibre|author)$/i.test(s.trim());
  if (isGeneric(metadataTitle)) metadataTitle = fnTitle;
  if (isGeneric(metadataAuthor)) metadataAuthor = fnAuthor;
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/'));
  const getFullPath = (href: string) => opfDir ? `${opfDir}/${href}` : href;
  const manifestItems = opfDoc.getElementsByTagName("item");
  const manifest: Record<string, string> = {};
  let coverHref: string | null = null;
  let metaCoverId: string | null = null;
  const metaElements = opfDoc.getElementsByTagName("meta");
  for(let i=0; i<metaElements.length; i++) { if(metaElements[i].getAttribute("name") === "cover") { metaCoverId = metaElements[i].getAttribute("content"); break; } }
  const imageCandidates: {href: string, id: string}[] = [];
  for (let i = 0; i < manifestItems.length; i++) {
    const item = manifestItems[i];
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) {
        manifest[id] = href;
        if (/\.(jpg|jpeg|png|webp|gif)$/i.test(href)) imageCandidates.push({ href, id });
        if (item.getAttribute("properties")?.includes("cover-image")) coverHref = href;
    }
  }
  if (!coverHref && metaCoverId && manifest[metaCoverId]) coverHref = manifest[metaCoverId];
  if (!coverHref && imageCandidates.length > 0) coverHref = imageCandidates[0].href;
  let coverBlob: Blob | null = null;
  if (coverHref) {
      const coverFile = loadedZip.file(getFullPath(coverHref));
      if (coverFile) coverBlob = await coverFile.async("blob");
  }
  const spineItems = opfDoc.getElementsByTagName("itemref");
  const rawFiles: FileItem[] = [];
  const processedPaths = new Set<string>();
  const totalSpine = spineItems.length;
  const BATCH_SIZE = 50; 
  for (let i = 0; i < totalSpine; i += BATCH_SIZE) {
    const batchSpine = Array.from(spineItems).slice(i, i + BATCH_SIZE);
    const itemsToProcess: { barePath: string, index: number }[] = [];
    for(const itemRef of batchSpine) {
        const idref = itemRef.getAttribute("idref");
        if (!idref || !manifest[idref]) continue;
        const fullPath = getFullPath(manifest[idref]);
        const barePath = fullPath.split('#')[0];
        if (!processedPaths.has(barePath)) {
            processedPaths.add(barePath);
            itemsToProcess.push({ barePath, index: 0 }); 
        }
    }
    const contentPromises = itemsToProcess.map(async (item) => {
        const fileContent = await loadedZip.file(item.barePath)?.async("string");
        if (!fileContent) return null;
        const htmlDoc = parser.parseFromString(fileContent, "text/html");
        const scripts = htmlDoc.getElementsByTagName('script');
        const styles = htmlDoc.getElementsByTagName('style');
        for (let j = scripts.length - 1; j >= 0; j--) scripts[j].parentNode?.removeChild(scripts[j]);
        for (let j = styles.length - 1; j >= 0; j--) styles[j].parentNode?.removeChild(styles[j]);
        let rawText = htmlDoc.body ? htmlDoc.body.innerText : (htmlDoc.documentElement.innerText || "");
        rawText = rawText.trim();
        if (!rawText) return null;
        let extractedTitle = htmlDoc.querySelector("title")?.textContent?.trim();
        if (!extractedTitle) extractedTitle = htmlDoc.querySelector("h1")?.textContent?.trim();
        return { rawText, extractedTitle };
    });
    const contents = await Promise.all(contentPromises);
    contents.forEach((data) => {
        if (data) {
            const chapterIndex = rawFiles.length + 1;
            let displayTitle = data.extractedTitle ? sanitizeFilename(data.extractedTitle) : `Chương ${chapterIndex}`;
            if (displayTitle.length > 60) displayTitle = displayTitle.substring(0, 60) + "...";
            rawFiles.push({ id: crypto.randomUUID(), name: `${padNumber(chapterIndex)} ${displayTitle}`, content: data.rawText, translatedContent: null, status: FileStatus.IDLE, retryCount: 0, originalCharCount: data.rawText.length, remainingRawCharCount: 0 });
        }
    });
    if (onProgress) {
        const currentCount = Math.min(i + BATCH_SIZE, totalSpine);
        const percent = 20 + Math.round((currentCount / totalSpine) * 80);
        onProgress(currentCount, totalSpine, percent);
    }
    await new Promise(r => setTimeout(r, 0));
  }
  const hasHugeFile = rawFiles.some(f => f.content.length > 10000);
  const avgChars = rawFiles.length > 0 ? rawFiles.reduce((a,b)=>a+b.content.length,0)/rawFiles.length : 0;
  const needsSplit = hasHugeFile || (rawFiles.length > 10 && avgChars < 300);
  if (onProgress) onProgress(totalSpine, totalSpine, 100);
  return { files: rawFiles, info: { title: metadataTitle, author: metadataAuthor }, coverBlob, needsSplit };
};

export const createMergedFile = (files: FileItem[]): string => {
  const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  return sortedFiles.filter((f) => f.status === FileStatus.COMPLETED && f.translatedContent)
    .map((f) => cleanContentArtifacts(f.translatedContent || "").trim())
    .join('\n\n'); 
};

export const downloadRawAsZip = async (files: FileItem[], filename: string, onProgress?: (percent: number, msg: string) => void) => {
    const zip = new JSZip();
    const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    if (onProgress) onProgress(0, "Đang chuẩn bị dữ liệu...");
    sortedFiles.forEach((f, index) => {
        let safeName = sanitizeFilename(f.name);
        if (!safeName.toLowerCase().endsWith('.txt')) safeName += '.txt';
        zip.file(safeName, cleanContentArtifacts(f.content));
        if (onProgress && index % 10 === 0) onProgress(Math.round((index / sortedFiles.length) * 20), `Đang thêm file: ${safeName}`);
    });
    if (onProgress) onProgress(20, "Đang nén file Zip...");
    const blob = await zip.generateAsync({ type: "blob" }, (metadata) => { if (onProgress) onProgress(20 + Math.round(metadata.percent * 0.8), `Đang nén: ${Math.round(metadata.percent)}%`); });
    if (onProgress) onProgress(100, "Tải xuống...");
    const element = document.createElement('a');
    const url = URL.createObjectURL(blob);
    element.href = url;
    element.download = filename.endsWith('.zip') ? filename : `${filename}.zip`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
};

export const downloadTranslatedAsZip = async (files: FileItem[], filename: string, onProgress?: (percent: number, msg: string) => void) => {
    const zip = new JSZip();
    const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    if (onProgress) onProgress(0, "Đang chuẩn bị...");
    const readyFiles = sortedFiles.filter(f => f.status === FileStatus.COMPLETED && f.translatedContent);
    if (readyFiles.length === 0) throw new Error("Chưa có chương nào hoàn thành để tải.");
    readyFiles.forEach((f, index) => {
        let safeName = sanitizeFilename(f.name);
        if (!safeName.toLowerCase().endsWith('.txt')) safeName += '.txt';
        zip.file(safeName, cleanContentArtifacts(f.translatedContent!));
        if (onProgress && index % 10 === 0) onProgress(Math.round((index / readyFiles.length) * 20), `Đang thêm: ${safeName}`);
    });
    if (onProgress) onProgress(20, "Đang nén file Zip...");
    const blob = await zip.generateAsync({ type: "blob" }, (metadata) => { if (onProgress) onProgress(20 + Math.round(metadata.percent * 0.8), `Đang nén: ${Math.round(metadata.percent)}%`); });
    if (onProgress) onProgress(100, "Tải xuống...");
    const element = document.createElement('a');
    const url = URL.createObjectURL(blob);
    element.href = url;
    element.download = filename.endsWith('.zip') ? filename : `${filename}.zip`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
};

export const createMergedRawFile = (files: FileItem[]): string => {
  const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  return sortedFiles.map((f) => cleanContentArtifacts(f.content).trim()).join('\n\n'); 
};

export const downloadTextFile = (filename: string, content: string) => {
  const element = document.createElement('a');
  const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(file);
  element.href = url;
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  URL.revokeObjectURL(url);
};

export const downloadJsonFile = (filename: string, data: any) => {
  const element = document.createElement('a');
  const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  element.href = url;
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  URL.revokeObjectURL(url);
};

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

export const downloadEpubFile = (filename: string, blob: Blob) => {
  const element = document.createElement('a');
  const url = URL.createObjectURL(blob);
  element.href = url;
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  URL.revokeObjectURL(url);
};

const escapeXml = (unsafe: string) => {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) { case '<': return '&lt;'; case '>': return '&gt;'; case '&': return '&amp;'; case '\'': return '&apos;'; case '"': return '&quot;'; default: return c; }
  });
};

export const generateEpub = async (files: FileItem[], storyInfo: StoryInfo, coverImage: File | null, epubDescription: string = "", onProgress?: (percent: number) => void): Promise<Blob> => {
  const zip = new JSZip();
  const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  if (sortedFiles.length === 0) throw new Error("Không có chương nào để tạo EPUB");
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  const title = storyInfo.title || "Unknown Title";
  const author = storyInfo.author || "Unknown Author";
  const uuidVal = crypto.randomUUID();
  const date = new Date().toISOString().split('T')[0];
  const timestamp = new Date().toISOString(); 
  const oebps = zip.folder("OEBPS");
  if (!oebps) throw new Error("Lỗi tạo thư mục OEBPS");
  const metaInf = zip.folder("META-INF");
  metaInf?.file("container.xml", `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  let coverManifest = "";
  let coverMeta = "";
  let coverImgFilename = "";
  if (coverImage) {
      const ext = coverImage.name.split('.').pop() || 'jpg';
      coverImgFilename = `Images/cover.${ext}`;
      coverManifest = `<item id="cover-image" href="${coverImgFilename}" media-type="${coverImage.type}" properties="cover-image"/>`;
      coverMeta = `<meta name="cover" content="cover-image" />`;
      oebps.file(coverImgFilename, coverImage);
  }
  oebps.file("Styles/style.css", `body{font-family:serif;line-height:1.6;margin:0;padding:5%;text-align:justify}h1,h2{text-align:center;font-weight:bold;margin:1.5em 0 1em;page-break-after:avoid;page-break-before:always}p{text-indent:1.5em;margin:0.5em 0;margin-bottom:1em}img{max-width:100%;height:auto;display:block;margin:1em auto}.intro-container{text-align:center;margin-top:2em}.intro-title{font-size:2em;font-weight:bold;margin-bottom:0.5em}.intro-author{font-size:1.2em;color:#555;margin-bottom:2em}.tag{display:inline-block;background:#eee;padding:2px 8px;border-radius:4px;font-size:0.8em;margin:5px}`);
  const manifestItems: string[] = [];
  const spineItems: string[] = [];
  const navPoints: string[] = []; 
  const navLinks: string[] = [];
  const introFilename = "Text/intro.xhtml";
  let coverHtml = coverImgFilename ? `<div style="text-align:center"><img src="../${coverImgFilename}" alt="Cover" style="max-height:50vh" /></div>` : "";
  const tagsHtml = storyInfo.genres.map(g => `<span class="tag">${escapeXml(g)}</span>`).join('');
  const introXhtml = `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" lang="vi"><head><title>Giới Thiệu</title><link href="../Styles/style.css" rel="stylesheet" type="text/css"/></head><body><section class="intro-container">${coverHtml}<h1 class="intro-title">${escapeXml(title)}</h1><div class="intro-author">${escapeXml(author)}</div><div class="intro-info"><div>${tagsHtml}</div><hr/><h3>Giới Thiệu</h3><div>${escapeXml(epubDescription).replace(/\n/g, '<br/>')}</div></div></section></body></html>`;
  oebps.file(introFilename, introXhtml);
  manifestItems.push(`<item id="intro" href="${introFilename}" media-type="application/xhtml+xml"/>`);
  spineItems.push(`<itemref idref="intro"/>`);
  navPoints.push(`<navPoint id="nav-intro" playOrder="1"><navLabel><text>Giới Thiệu</text></navLabel><content src="${introFilename}"/></navPoint>`);
  navLinks.push(`<li><a href="intro.xhtml">Giới Thiệu</a></li>`);
  const totalFiles = sortedFiles.length;
  const updateStep = Math.max(20, Math.floor(totalFiles / 20));
  for (let i = 0; i < totalFiles; i++) {
      if (i % updateStep === 0) { if (onProgress) onProgress(Math.round((i / totalFiles) * 80)); await new Promise(resolve => setTimeout(resolve, 0)); }
      const file = sortedFiles[i];
      const rawContent = file.translatedContent || file.content || "";
      const content = cleanContentArtifacts(rawContent);
      if (!content.trim()) continue;
      const chapterId = `ch${i + 1}`;
      const filename = `Text/${chapterId}.xhtml`;
      let displayTitle = file.name.replace(/\.(txt|zip)$/i, '').replace(/^\d{5}[\s_]/, '');
      const lines = content.split('\n').map(l => l.trim()).filter(l => l);
      let bodyLines = lines;
      if (lines.length > 0 && lines[0].length < 150) { displayTitle = lines[0]; bodyLines = lines.slice(1); }
      const htmlBody = bodyLines.map(l => `<p>${escapeXml(l)}</p>`).join('');
      const xhtml = `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" lang="vi"><head><title>${escapeXml(displayTitle)}</title><link href="../Styles/style.css" rel="stylesheet" type="text/css"/></head><body><h2>${escapeXml(displayTitle)}</h2>${htmlBody}</body></html>`;
      oebps.file(filename, xhtml);
      manifestItems.push(`<item id="${chapterId}" href="${filename}" media-type="application/xhtml+xml"/>`);
      spineItems.push(`<itemref idref="${chapterId}"/>`);
      const order = i + 2; 
      const navPointId = `nav-point-${i+1}`; 
      navPoints.push(`<navPoint id="${navPointId}" playOrder="${order}"><navLabel><text>${escapeXml(displayTitle)}</text></navLabel><content src="${filename}"/></navPoint>`);
      const relativePath = `${chapterId}.xhtml`;
      navLinks.push(`<li><a href="${relativePath}">${escapeXml(displayTitle)}</a></li>`);
  }
  const navFilename = "Text/nav.xhtml";
  const navXhtml = `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="vi"><head><title>Mục Lục</title><link href="../Styles/style.css" rel="stylesheet" type="text/css"/></head><body><nav epub:type="toc" id="toc"><h1>Mục Lục</h1><ol>${navLinks.join('')}</ol></nav></body></html>`;
  oebps.file(navFilename, navXhtml);
  manifestItems.push(`<item id="nav" href="${navFilename}" media-type="application/xhtml+xml" properties="nav"/>`);
  const ncxFilename = "toc.ncx";
  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:${uuidVal}"/><meta name="dtb:depth" content="1"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head><docTitle><text>${escapeXml(title)}</text></docTitle><navMap>${navPoints.join('')}</navMap></ncx>`;
  oebps.file(ncxFilename, tocNcx);
  manifestItems.push(`<item id="ncx" href="${ncxFilename}" media-type="application/x-dtbncx+xml"/>`);
  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"><dc:title>${escapeXml(title)}</dc:title><dc:creator>${escapeXml(author)}</dc:creator><dc:language>vi</dc:language><dc:identifier id="BookId">urn:uuid:${uuidVal}</dc:identifier><meta property="dcterms:modified">${timestamp}</meta><dc:date>${date}</dc:date>${coverMeta}</metadata><manifest><item id="style" href="Styles/style.css" media-type="text/css"/>${coverManifest}${manifestItems.join('')}</manifest><spine toc="ncx">${spineItems.join('')}</spine></package>`;
  oebps.file("content.opf", contentOpf);
  return await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 2 } }, (metadata) => { if (onProgress) { const finalPercent = 80 + Math.round(metadata.percent * 0.2); onProgress(Math.min(99, finalPercent)); } });
};
