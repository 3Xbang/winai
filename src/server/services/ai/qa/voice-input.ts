/**
 * Voice Input — Server-side handler for voice-to-text transcription
 * Browser uses Web Speech API; server receives transcribed text.
 * Requirements: 28.4
 */

// ─── Types ──────────────────────────────────────────────────

export interface VoiceInputResult {
  text: string;
  language: string;
  confidence: number;
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Process voice input text received from browser's Web Speech API.
 * The actual speech-to-text happens client-side; this validates and normalizes.
 */
export function processVoiceInput(
  transcribedText: string,
  detectedLanguage?: string,
): VoiceInputResult {
  const text = transcribedText.trim();
  const language = detectedLanguage || detectLanguageHeuristic(text);

  return {
    text,
    language,
    confidence: text.length > 0 ? 0.85 : 0,
  };
}

function detectLanguageHeuristic(text: string): string {
  if (/[\u4e00-\u9fa5]/.test(text)) return 'zh';
  if (/[\u0e00-\u0e7f]/.test(text)) return 'th';
  return 'en';
}
