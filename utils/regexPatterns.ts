
/**
 * CENTRALIZED REGEX ENGINE v1.1
 * Contains advanced patterns for Chapter Splitting and Text Cleaning.
 */

export const REGEX_PATTERNS = {
    // --- UNIVERSAL CHAPTER SPLITTER ---
    // Matches:
    // 1. CJK: 第10章, 第十章, 第10话, 卷一, 番外, 【Title】, [Title]
    // 2. VN: Chương 10, Hồi 10, Quyển 1, Phần 2, Màn 1
    // 3. EN: Chapter 10, Vol 1, Book 1, Episode 5, Part 3, Arc 1, Act 1
    // 4. Roman: Chapter IV, Part X
    // 5. Special: Prologue, Epilogue, Side Story, Ngoại truyện, Phiên ngoại, Lời dẫn, Kết thúc
    // 6. Generic Numeric: "1. Title" or "1、Title" at start of line
    UNIVERSAL_CHAPTER_MATCH: /^(?:\s*)(?:(?:第\s*[0-9０-９零一二三四五六七八九十百千]+\s*[章話節回幕卷部].*)|(?:Chapter|Chap|Ch|Chương|Hồi|Tiết|Quyển|Tập|Episode|Vol\.?|Book|Màn|Phần|Q|C|Arc|Act|Session)\s*[\dIVXLCDM]+.*|[#＃][0-9０-９]+.*|[0-9０-９]+\s*[.．、]\s*.*|[0-9０-９]+\s+[\u4e00-\u9fa5].*|Ngoại\s*truyện.*|Side\s*Story.*|Phiên\s*ngoại.*|Prologue.*|Epilogue.*|Mở\s*đầu.*|Lời\s*dẫn.*|Kết\s*thúc.*|Phần\s*kết.*|【.*?】.*|\[.*?\]\s*.*|(?:###)?\s*EPUB_CHAPTER_SPLIT.*)$/im,

    // --- DICTIONARY ---
    // Cleans keys like [Key] -> Key
    DICT_KEY_CLEANER: /^\[|\]$/g,

    // --- JUNK KEYWORDS (DETECTION) ---
    // Keywords indicating "Junk" chapters (Author notes, leave requests, voting begging)
    JUNK_KEYWORDS: /thông báo|xin nghỉ|cầu phiếu|đề cử|tác giả|phiếu|nghỉ phép|lời nói đầu|cảm nghĩ|tổng kết|đôi lời|chúc mừng|nghỉ ngơi|convert|converter|cầu nguyệt phiếu|cầu donate|ps:|p\/s:|nhảm nhí|chương chống trộm|momo|banking|chuyển khoản|donate|ủng hộ|viettinbank|vcb|agribank/i,

    // --- JUNK / WATERMARK CLEANER (REMOVAL) ---
    // Aggressive patterns to strip noise from convert/raw sources
    JUNK_PATTERNS: [
        /^\s*(?:Convert|Cv|Converter|Edit)\s*(?:by|:)?\s*.*$/gim, // Convert by...
        /^\s*(?:Nguồn|Source)\s*[:]\s*.*$/gim, // Nguồn: ...
        /^\s*(?:TruyenFull|TangThuVien|Metruyenchu|Wikidich|Uukanshu|Qidian|Faloo|Wattpad|TTV|Bachngocsach)\s*.*$/gim, // Site names
        /^\s*(?:Cầu|Xin)\s*(?:phiếu|nguyệt phiếu|đề cử|donate|hoa|kẹo|lì xì|cất chứa|theo dõi|đánh giá|bình luận).*$/gim, // Begging
        /^\s*(?:Momo|Banking|Stk|Ck|Agribank|Vietcombank|Techcombank|Paypal)\s*[:].*$/gim, // Payment info
        /^\s*(?:-{3,}|={3,}|\*{3,}|_{3,})\s*$/gm, // Separators lines
        /https?:\/\/[^\s]+/g, // URL Links
        /^\s*(?:Ps|P\/s|Note|Ghi chú)[:：].*$/gim, // Postscripts
        /^\s*Mời\s*(?:bạn|các)\s*đọc\s*.*$/gim, // Invitation
    ],

    // --- PUNCTUATION NORMALIZATION ---
    // Rules to fix spacing and standardizing characters
    PUNCTUATION_NORMALIZE: [
        { find: /\.{4,}/g, replace: '...' }, // .... -> ...
        { find: /([?!])\1+/g, replace: '$1' }, // ?? -> ?
        { find: /([,.?!:;])(?=[A-Za-zÀ-ỹ])/g, replace: '$1 ' }, // "word.word" -> "word. word" (Add space)
        { find: /\s+([,.?!:;])/g, replace: '$1' }, // "word , word" -> "word, word" (Remove space before)
        { find: /[「『【《]/g, replace: '“' }, // Open quotes to standard
        { find: /[」』】》]/g, replace: '”' }, // Close quotes to standard
        { find: /[\u200B\u200C\u200D\uFEFF]/g, replace: '' }, // Zero width chars (Invisible garbage)
    ]
};
