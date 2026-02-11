
import { RatioLimits } from '../types';
import { REGEX_PATTERNS } from './regexPatterns';

// Regex to detect Chinese (Hanzi), Japanese (Hiragana/Katakana), Korean (Hangul), and Cyrillic
export const FOREIGN_CHARS_REGEX = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0400-\u04ff]/;

export interface LineContext {
  index: number;
  originalLine: string;
}

// ... (isVietnameseContent, isEnglishContent, detectJunkChapter, toTitleCase - Unchanged)
// Robust Title Case function: Capitalize first letter of each word
export const toTitleCase = (str: string): string => {
    return str.toLowerCase().replace(/(?:^|\s|['"({[])\S/g, function(a) { 
        return a.toUpperCase(); 
    });
};

// Check for Structural Vietnamese Words to identify Convert vs Raw
export const isVietnameseContent = (text: string): boolean => {
    if (!text || text.length < 50) return false;
    const sample = text.substring(0, 2000).toLowerCase();
    const accentMatches = sample.match(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g);
    if ((accentMatches?.length || 0) > 5) return true;
    const viMatches = sample.match(/\b(của|là|và|những|được|người|trong|một|không|có|anh|hắn|cô|nàng)\b/g);
    return (viMatches?.length || 0) > 3; 
};

export const isEnglishContent = (text: string): boolean => {
    if (!text || text.length < 50) return false;
    const sample = text.substring(0, 1000).toLowerCase();
    const enMatches = sample.match(/\b(the|and|is|that|with|from|have|this|are|was|for|not|but|you|they|he|she)\b/g);
    const enCount = enMatches ? enMatches.length : 0;
    if (isVietnameseContent(sample)) return false;
    const viMatches = sample.match(/\b(là|và|của|những|được|trong|with|người|khi|đã|đang|sẽ|này|đó|như|còn)\b/g);
    const viCount = viMatches ? viMatches.length : 0;
    return enCount > (viCount * 2) && enCount > 5;
};

export const detectJunkChapter = (title: string, content: string): boolean => {
    const len = content.length;
    if (len < 1200 && REGEX_PATTERNS.JUNK_KEYWORDS.test(title)) return true;
    const sample = content.substring(0, 500); 
    if (REGEX_PATTERNS.JUNK_KEYWORDS.test(sample) && len < 2000) return true;
    return false;
};

/**
 * Trợ lý Local - Định dạng chuẩn sách in (Enhanced with ALL CAPS FIX)
 */
export const formatBookStyle = (content: string): string => {
    if (!content) return "";
    let text = content;

    // 1. Run Junk Filter
    REGEX_PATTERNS.JUNK_PATTERNS.forEach(pattern => {
        text = text.replace(pattern, '');
    });

    // 1.1 Aggressive Character Cleanup
    text = text.replace(/[*#=]+/g, '');
    text = text.replace(/(?:-[ \t]*){2,}/g, '');
    text = text.replace(/(?:_[ \t]*){2,}/g, '');

    // 2. Normalization (Punctuation, Quotes)
    REGEX_PATTERNS.PUNCTUATION_NORMALIZE.forEach(rule => {
        text = text.replace(rule.find, rule.replace);
    });

    // 3. Artifact Cleanup
    text = text.replace(/^(?:\[(Fixed|Corrected|Sửa|Done|Solved)\]|Fixed:|Corrected:)\s*[:.-]?\s*/gim, '');

    const lines = text.split('\n');
    const formattedLines = lines
        .map(l => l.trim()) 
        .filter(l => l.length > 0)
        .map(l => {
            // ALL CAPS FIX: If line is > 30 chars and > 80% uppercase -> Convert to Sentence case
            if (l.length > 30) {
                const upperChars = l.replace(/[^A-ZÀ-Ỹ]/g, '').length;
                const totalChars = l.replace(/[^a-zA-Zà-ỹ]/g, '').length;
                if (totalChars > 0 && (upperChars / totalChars) > 0.8) {
                    // Force sentence case: Capitalize first letter, rest lowercase
                    // Be careful with proper nouns inside, but ALL CAPS is worse.
                    l = l.charAt(0).toUpperCase() + l.slice(1).toLowerCase();
                }
            }

            // 4. Header Processing
            const headerMatch = l.match(/^\s*(?:[#\-\=\*\.]\s*)*(Chương|Chapter|Hồi|Quyển|Màn|Tập|Vol|Book|Part|Episode|第|卷)\s+((?:[0-9]+)|(?:[IVXLCDM]+\b)|(?:[\u4e00-\u9fa5]+)|(?:Một|Hai|Ba|Bốn|Năm|Sáu|Bảy|Tám|Chín|Mười|Trăm|Ngàn|Đệ|Thứ|Quyển|Tập|Thượng|Hạ|Trung|Cuối|Kết)|(?:Mở\s*Đầu|Lời\s*Dẫn|Ngoại\s*Truyện))([:.\s].*)?$/i);
            
            // Special check for ambiguous keywords
            const ambiguousKeywords = ['Hồi', 'Màn', 'Quyển', 'Part'];
            
            if (headerMatch) {
                const prefix = headerMatch[1]; 
                const num = headerMatch[2] || ""; 
                let title = headerMatch[3] || ""; 

                const isAmbiguous = ambiguousKeywords.some(k => k.toLowerCase() === prefix.toLowerCase());
                if (isAmbiguous) {
                    const isRealNumber = /^[0-9IVXLCDM]+$/.test(num) || /^(Một|Hai|Ba|Bốn|Năm|Sáu|Bảy|Tám|Chín|Mười|Đệ|Thứ|Thượng|Hạ|Kết)/i.test(num);
                    if (!isRealNumber) {
                        return `    ${l}`;
                    }
                }

                title = title.replace(/^[\s:\.\-\_]+/, '').trim();
                title = title.replace(/[\.。]$/, '');

                if (title) {
                    title = toTitleCase(title);
                    return `${prefix} ${num}: ${title}`;
                } else {
                    return `${prefix} ${num}`;
                }
            }

            // 5. Paragraph Processing (Indent)
            return `    ${l}`;
        });

    return formattedLines.join('\n\n');
};

export const findLinesWithForeignChars = (text: string): LineContext[] => {
  if (!text) return [];
  const lines = text.split('\n');
  const badLines: LineContext[] = [];
  lines.forEach((line, index) => {
    if (line.trim().length > 0 && FOREIGN_CHARS_REGEX.test(line)) {
      badLines.push({ index, originalLine: line });
    }
  });
  return badLines;
};

// ... (getInvalidPronounLines, mergeFixedLines, countForeignChars, replacePromptVariables, deduplicateDictionary, validateTranslationIntegrity, optimizeDictionary, optimizeContext, cleanRepetitiveContent - Unchanged)
export const getInvalidPronounLines = (text: string, genres: string[] = []): LineContext[] => {
    return []; // Placeholder, can implement detailed checks later
};

export const mergeFixedLines = (fullText: string, fixedLines: { index: number; text: string }[]): string => {
  const lines = fullText.split('\n');
  fixedLines.forEach((fix) => {
    if (fix.index >= 0 && fix.index < lines.length) {
      lines[fix.index] = fix.text;
    }
  });
  return lines.join('\n');
};

export const countForeignChars = (text: string): number => {
  if (!text) return 0;
  const globalRegex = new RegExp(FOREIGN_CHARS_REGEX, 'g');
  const matches = text.match(globalRegex);
  return matches ? matches.length : 0;
};

export const replacePromptVariables = (template: string, info: any): string => {
    if (!template) return "";
    let result = template;
    const val = (v: any) => {
        if (Array.isArray(v)) return v.join(', ');
        return v ? String(v) : 'Chưa rõ';
    };
    result = result.replace(/\{\{TITLE\}\}/g, val(info.title));
    result = result.replace(/\{\{AUTHOR\}\}/g, val(info.author));
    result = result.replace(/\{\{LANGUAGE\}\}/g, val(info.languages));
    result = result.replace(/\{\{GENRE\}\}/g, val(info.genres));
    result = result.replace(/\{\{PERSONALITY\}\}/g, val(info.mcPersonality));
    result = result.replace(/\{\{SETTING\}\}/g, val(info.worldSetting));
    result = result.replace(/\{\{FLOW\}\}/g, val(info.sectFlow));
    return result;
};

export const deduplicateDictionary = (dictContent: string): string => {
    if (!dictContent) return "";
    const lines = dictContent.split('\n');
    const categories = new Map<string, Map<string, string>>();
    let currentCategory = "UNKNOWN";
    
    const CATEGORY_ORDER = [
        "QUY TẮC BẮT BUỘC / CORE RULES",
        "XƯNG HÔ & ĐẠI TỪ / PRONOUNS",
        "NHÂN VẬT / CHARACTERS",
        "ĐỊA DANH / LOCATIONS",
        "TỔ CHỨC / ORGANIZATIONS",
        "VẬT PHẨM & TRANG BỊ / ITEMS",
        "TU LUYỆN & CẢNH GIỚI / CULTIVATION",
        "KỸ NĂNG & CÔNG PHÁP / SKILLS",
        "QUÁI VẬT & CHỦNG TỘC / BEASTS",
        "THUẬT NGỮ KHÁC / OTHERS",
        "UNKNOWN"
    ];

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const headerMatch = trimmed.match(/^#\s*===+\s*\[?(.*?)\]?\s*===+/);
        if (headerMatch) {
            let catName = headerMatch[1].trim().toUpperCase();
            const known = CATEGORY_ORDER.find(c => c.includes(catName) || catName.includes(c.split(' / ')[0]));
            currentCategory = known || catName;
            if (!categories.has(currentCategory)) {
                categories.set(currentCategory, new Map());
            }
            return;
        }
        if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
            if (trimmed.startsWith('# --')) {
                 if (!categories.has(currentCategory)) categories.set(currentCategory, new Map());
                 categories.get(currentCategory)?.set(`__COMMENT_${crypto.randomUUID()}`, trimmed);
            }
            return;
        }
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex !== -1) {
            let rawKey = trimmed.substring(0, eqIndex).trim();
            let val = trimmed.substring(eqIndex + 1).trim();
            const normalizedKey = rawKey.replace(/^\[+|\]+$/g, '');
            let cleanVal = val.replace(/^\[+|\]+$/g, '').trim();
            if (normalizedKey && cleanVal) {
                if (!categories.has(currentCategory)) categories.set(currentCategory, new Map());
                categories.get(currentCategory)?.set(normalizedKey, `[${normalizedKey}] = ${cleanVal}`);
            }
        }
    });

    let result = "";
    CATEGORY_ORDER.forEach(cat => {
        if (categories.has(cat)) {
            const items = categories.get(cat);
            if (items && items.size > 0) {
                result += `\n# === [${cat}] ===\n`;
                const sortedItems = Array.from(items.entries()).sort((a, b) => {
                    if (a[0].startsWith('__COMMENT')) return -1; 
                    return a[0].localeCompare(b[0]); 
                });
                sortedItems.forEach(([key, val]) => result += `${val}\n`);
            }
            categories.delete(cat);
        }
    });
    categories.forEach((items, cat) => {
        if (items.size > 0) {
            result += `\n# === [${cat}] ===\n`;
            Array.from(items.values()).forEach(val => result += `${val}\n`);
        }
    });
    return result.trim();
};

export const validateTranslationIntegrity = (source: string, target: string, limits?: RatioLimits, sourceLanguage?: string): { isValid: boolean; reason?: string; ratio: number } => {
    if (!source || !target) return { isValid: false, reason: "Nội dung rỗng", ratio: 0 };
    
    const srcLen = source.length;
    const tgtLen = target.length;
    const ratio = tgtLen / Math.max(1, srcLen);
    
    if (srcLen < 200) {
        if (tgtLen === 0) return { isValid: false, reason: "Mất nội dung (Empty)", ratio };
        if (ratio > 10) return { isValid: false, reason: "Ảo giác (Quá dài so với gốc)", ratio };
        return { isValid: true, ratio };
    }

    let minRatio = 0.3; 
    let maxRatio = 2.0; 
    
    const lang = (sourceLanguage || '').toLowerCase();
    let detectedLang = 'vietnamese';

    if (lang.includes('trung') || lang.includes('chinese') || lang.includes('cn')) {
        detectedLang = 'chinese';
    } else if (lang.includes('nhật') || lang.includes('japan') || lang.includes('hàn') || lang.includes('korean')) {
        detectedLang = 'krjp';
    } else if (lang.includes('anh') || lang.includes('english')) {
        detectedLang = 'english';
    }

    const hasJunk = REGEX_PATTERNS.JUNK_KEYWORDS.test(source) || REGEX_PATTERNS.JUNK_KEYWORDS.test(target);

    if (limits) {
        if (detectedLang === 'vietnamese') { 
            minRatio = limits.vn.min; maxRatio = limits.vn.max; 
        } else if (detectedLang === 'english') { 
            minRatio = limits.en.min; maxRatio = limits.en.max; 
        } else if (detectedLang === 'krjp') { 
            minRatio = limits.krjp.min; maxRatio = limits.krjp.max; 
        } else if (detectedLang === 'chinese') { 
            minRatio = limits.cn.min; maxRatio = limits.cn.max; 
        }
    } else {
        if (detectedLang === 'vietnamese') { minRatio = 0.6; maxRatio = 1.4; } 
        else if (detectedLang === 'english') { minRatio = 0.8; maxRatio = 1.5; }
        else if (detectedLang === 'krjp') { minRatio = 1.2; maxRatio = 3.5; }
        else { minRatio = 1.5; maxRatio = 4.0; } 
    }

    if (hasJunk) minRatio = Math.min(minRatio, 0.3);

    if (ratio < minRatio) return { isValid: false, reason: `Nội dung quá ngắn (Ratio: ${ratio.toFixed(2)} < ${minRatio}). Khả năng mất đoạn hoặc chưa dịch hết. [Lang: ${detectedLang}]`, ratio };
    if (ratio > maxRatio) return { isValid: false, reason: `Nội dung quá dài (Ratio: ${ratio.toFixed(2)} > ${maxRatio}). Khả năng bịa chuyện (Hallucination). [Lang: ${detectedLang}]`, ratio };

    return { isValid: true, ratio };
};

export const optimizeDictionary = (dictionary: string, content: string): string => {
  if (!content || !dictionary) return '';
  const lines = dictionary.split('\n');
  const categorizedEntries = new Map<string, string[]>();
  let currentCategory = "GENERAL"; 
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const headerMatch = trimmed.match(/^#\s*===+\s*\[?(.*?)\]?\s*===+/);
    if (headerMatch) {
        currentCategory = headerMatch[0]; 
        if (!categorizedEntries.has(currentCategory)) categorizedEntries.set(currentCategory, []);
        continue;
    }
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    if (!categorizedEntries.has(currentCategory)) categorizedEntries.set(currentCategory, []);
    categorizedEntries.get(currentCategory)?.push(trimmed);
  }

  const lowerContent = content.toLowerCase();
  const finalOutput: string[] = [];

  for (const [categoryHeader, entries] of categorizedEntries.entries()) {
      const usedEntries: string[] = [];
      for (const entry of entries) {
          const eqIndex = entry.indexOf('=');
          const rawKey = entry.substring(0, eqIndex).trim();
          const searchKey = rawKey.replace(REGEX_PATTERNS.DICT_KEY_CLEANER, '').trim().toLowerCase();
          if (searchKey && lowerContent.includes(searchKey)) usedEntries.push(entry);
      }
      if (usedEntries.length > 0) {
          if (categoryHeader !== "GENERAL") {
              finalOutput.push(""); 
              finalOutput.push(categoryHeader);
          }
          finalOutput.push(...usedEntries);
      }
  }
  return finalOutput.join('\n').trim();
};

export const optimizeContext = (context: string, content: string): string => {
    if (!context || !content) return "";
    const blocks = context.split(/\n\s*\n/);
    const relevantBlocks: string[] = [];
    for (const block of blocks) {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) continue;
        if (trimmedBlock.startsWith('#') || trimmedBlock.startsWith('===') || trimmedBlock.startsWith('[METADATA]')) {
            relevantBlocks.push(block);
            continue;
        }
        if (trimmedBlock.startsWith('!')) {
            relevantBlocks.push(block.replace(/^!/, ''));
            continue;
        }
        const lowerBlock = trimmedBlock.toLowerCase();
        if (lowerBlock.includes('văn phong') || lowerBlock.includes('quy tắc') || lowerBlock.includes('lưu ý') || lowerBlock.includes('tông giọng') || lowerBlock.includes('ma trận xưng hô') || lowerBlock.includes('hồ sơ nhân vật') || lowerBlock.includes('quan hệ') || lowerBlock.includes('ngữ cảnh') || lowerBlock.includes('sự kiện') || lowerBlock.includes('cốt truyện') || lowerBlock.includes('cơ chế') || lowerBlock.includes('ghi chú') || lowerBlock.includes('tiến trình') || lowerBlock.includes('tích lũy') || lowerBlock.includes('plot')) {
            relevantBlocks.push(block);
            continue;
        }
        const firstLine = trimmedBlock.split('\n')[0];
        let subject = "";
        if (firstLine.includes('->')) subject = firstLine.split('->')[0]; 
        else if (firstLine.includes(':')) subject = firstLine.split(':')[0]; 
        else subject = firstLine;
        subject = subject.replace(/^[\s\-\*\[\]]+|[\s\[\]]+$/g, '');
        if (subject.length > 1) {
            if (content.includes(subject)) relevantBlocks.push(block);
            else if (trimmedBlock.length < 50) relevantBlocks.push(block);
        } else relevantBlocks.push(block);
    }
    return relevantBlocks.join('\n\n');
};

export const cleanRepetitiveContent = (text: string): string => {
    if (!text) return "";
    return text.split('\n').filter(line => {
        if (/[^ \-=\*#_]\1{9,}/.test(line)) return false;
        if (/(\S{2,})\s\1\s\1\s\1\s\1/.test(line)) return false;
        return true;
    }).join('\n');
};
