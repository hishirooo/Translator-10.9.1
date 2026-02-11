
import { BASE_TRANSLATION_IDENTITY, BASE_OUTPUT_FORMAT, METADATA_TEMPLATE, STYLE_GUIDES_TEMPLATE, SPECIFIC_RULES, GENRE_RULES_PRESETS } from './prompts/translation';
import { AUTO_ANALYZE_PROMPT, GLOSSARY_ANALYSIS_PROMPT, NAME_ANALYSIS_PROMPT, MERGE_CONTEXT_PROMPT, MERGE_GLOSSARY_PROMPT } from './prompts/analysis';

// Re-export for Service usage
export { 
    AUTO_ANALYZE_PROMPT, 
    GLOSSARY_ANALYSIS_PROMPT, 
    NAME_ANALYSIS_PROMPT, 
    MERGE_CONTEXT_PROMPT, 
    MERGE_GLOSSARY_PROMPT 
};

// --- MAIN PROMPT CONSTRUCTION ---

export const DEFAULT_PROMPT = `${BASE_TRANSLATION_IDENTITY}

${GENRE_RULES_PRESETS.ANCIENT}

${METADATA_TEMPLATE}

${STYLE_GUIDES_TEMPLATE}

${SPECIFIC_RULES}

${BASE_OUTPUT_FORMAT}`;

export const USER_TRANSLATION_PROMPT_CONTENT = DEFAULT_PROMPT;

// --- DYNAMIC HELPERS ---

/**
 * Automatically selects the appropriate Genre Preset based on the input genres.
 */
export const getPronounRules = (genres: string[]): string => {
    const lowerGenres = genres.map(g => g.toLowerCase());
    const rules: string[] = [];

    // 1. Cổ Trang / Tiên Hiệp / Kiếm Hiệp
    if (lowerGenres.some(g => g.includes('tiên hiệp') || g.includes('kiếm hiệp') || g.includes('cổ đại') || g.includes('tu tiên') || g.includes('huyền huyễn') || g.includes('đông phương'))) {
        rules.push(GENRE_RULES_PRESETS.ANCIENT);
    }

    // 2. Hiện Đại / Đô Thị / Ngôn Tình
    else if (lowerGenres.some(g => g.includes('đô thị') || g.includes('hiện đại') || g.includes('ngôn tình') || g.includes('hài hước') || g.includes('thanh xuân'))) {
         rules.push(GENRE_RULES_PRESETS.MODERN);
    }

    // 3. Võng Du / Game
    if (lowerGenres.some(g => g.includes('võng du') || g.includes('game') || g.includes('esport') || g.includes('hệ thống'))) {
        rules.push(GENRE_RULES_PRESETS.GAME);
    }

    // 4. Western / Fantasy / Phương Tây
    if (lowerGenres.some(g => g.includes('phương tây') || g.includes('fantasy') || g.includes('ma pháp') || g.includes('âu cổ') || g.includes('huyền bí'))) {
        rules.push(GENRE_RULES_PRESETS.WESTERN);
    }

    // 5. Light Novel / Japan / Anime
    if (lowerGenres.some(g => g.includes('light novel') || g.includes('isekai') || g.includes('nhật') || g.includes('đồng nhân') || g.includes('anime'))) {
        rules.push(GENRE_RULES_PRESETS.JAPAN);
    }

    // 6. Mạt Thế / Khoa Huyễn
    if (lowerGenres.some(g => g.includes('mạt thế') || g.includes('khoa huyễn') || g.includes('zombie') || g.includes('quân sự') || g.includes('sci-fi'))) {
        rules.push(GENRE_RULES_PRESETS.SCIFI);
    }

    // Default fallback if nothing matches
    if (rules.length === 0) {
        rules.push(GENRE_RULES_PRESETS.ANCIENT); // Default to Ancient for safe sino-vietnamese
    }

    return rules.join('\n\n');
};

/**
 * Helper to replace variables in the template
 */
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
    
    // Replace Target Audience if exists
    result = result.replace(/\{\{TARGET_AUDIENCE\}\}/g, "Độc giả Việt Nam");

    return result;
};