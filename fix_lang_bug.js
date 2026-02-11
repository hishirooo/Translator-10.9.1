// Script to fix the language detection bug in App.tsx
// This script adds the sourceLang parameter to validateTranslationIntegrity calls

const fs = require('fs');
const path = require('path');

const targetFile = 'e:\\Make_Installer\\MyTool\\Translator-10.9.1\\App.tsx';

// Read the file
let content = fs.readFileSync(targetFile, 'utf8');

// Pattern to find: validateTranslationIntegrity(f.content, translated, ratioLimits)
// Replace with: validateTranslationIntegrity(f.content, translated, ratioLimits, sourceLang)

// First, we need to add the sourceLang variable declaration before the validation
// Find this pattern in the processBatch function:
const searchPattern = 'const rawCount = countForeignChars(translated); if (rawCount > 0) addLog(`⚠️ [AUTO FIX] File ${f.name} còn ${rawCount} ký tự raw.`, "info"); const integrity = validateTranslationIntegrity(f.content, translated, ratioLimits);';

const replacementPattern = 'const rawCount = countForeignChars(translated); if (rawCount > 0) addLog(`⚠️ [AUTO FIX] File ${f.name} còn ${rawCount} ký tự raw.`, "info"); const sourceLang = storyInfo.languages && storyInfo.languages.length > 0 ? storyInfo.languages[0] : \'Convert thô\'; const integrity = validateTranslationIntegrity(f.content, translated, ratioLimits, sourceLang);';

// Perform the replacement
if (content.includes(searchPattern)) {
    content = content.replace(searchPattern, replacementPattern);
    console.log('✅ Found and replaced the pattern in App.tsx');
    
    // Write back to file
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('✅ File updated successfully!');
} else {
    console.error('❌ Pattern not found in file. Manual fix required.');
    console.error('Looking for:', searchPattern.substring(0, 100) + '...');
}
