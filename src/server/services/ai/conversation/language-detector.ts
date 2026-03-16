/**
 * Language Detector (语言检测器)
 * Detects the dominant language of input text using character-based analysis.
 * Supports Chinese (zh), Thai (th), and English (en).
 *
 * Requirements: 21.7, 28.6
 */

// ─── Unicode Range Helpers ──────────────────────────────────

/**
 * Check if a character code point falls within CJK Unified Ideographs ranges.
 * Covers CJK Unified Ideographs (U+4E00–U+9FFF) and extensions.
 */
function isCJK(code: number): boolean {
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||   // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4dbf) ||   // CJK Unified Ideographs Extension A
    (code >= 0x20000 && code <= 0x2a6df) || // CJK Unified Ideographs Extension B
    (code >= 0xf900 && code <= 0xfaff) ||   // CJK Compatibility Ideographs
    (code >= 0x3000 && code <= 0x303f) ||   // CJK Symbols and Punctuation
    (code >= 0xff00 && code <= 0xffef)      // Fullwidth Forms
  );
}

/**
 * Check if a character code point falls within Thai script range.
 * Thai: U+0E00–U+0E7F
 */
function isThai(code: number): boolean {
  return code >= 0x0e00 && code <= 0x0e7f;
}

/**
 * Check if a character code point is a Latin letter (basic + extended).
 */
function isLatin(code: number): boolean {
  return (
    (code >= 0x0041 && code <= 0x005a) || // A-Z
    (code >= 0x0061 && code <= 0x007a) || // a-z
    (code >= 0x00c0 && code <= 0x024f)    // Latin Extended
  );
}

// ─── Language Detection ─────────────────────────────────────

/**
 * Detect the dominant language of the input text by counting
 * CJK, Thai, and Latin characters.
 *
 * Returns 'zh' for Chinese, 'th' for Thai, 'en' for English.
 * Defaults to 'en' when no clear dominant language is found.
 */
export function detectLanguage(text: string): 'zh' | 'th' | 'en' {
  let cjkCount = 0;
  let thaiCount = 0;
  let latinCount = 0;

  for (const char of text) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;

    if (isCJK(code)) {
      cjkCount++;
    } else if (isThai(code)) {
      thaiCount++;
    } else if (isLatin(code)) {
      latinCount++;
    }
  }

  const total = cjkCount + thaiCount + latinCount;

  if (total === 0) {
    return 'en'; // Default for empty or non-alphabetic input
  }

  if (cjkCount >= thaiCount && cjkCount >= latinCount) {
    return 'zh';
  }
  if (thaiCount >= cjkCount && thaiCount >= latinCount) {
    return 'th';
  }
  return 'en';
}
