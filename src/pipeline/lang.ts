import type { Chunk, Lang } from './types'

/**
 * CJK ideograph range. We treat any Han character as a "zh" signal.
 * This is an intentional simplification: sessions that are primarily
 * Japanese or Korean would currently map to 'zh', but our corpus is
 * zh/en only, so that's fine.
 */
const CJK_RE = /[\u4e00-\u9fff]/g

const CHAR_RE = /[\p{L}\p{N}]/gu

/**
 * Count CJK vs total word-ish characters in a text blob.
 * Returns the ratio of CJK characters to letters+digits.
 */
export function cjkRatio(text: string): number {
  const chars = text.match(CHAR_RE)?.length ?? 0
  if (chars === 0) return 0
  const cjk = text.match(CJK_RE)?.length ?? 0
  return cjk / chars
}

/**
 * Detect the primary language of a session from its chunks.
 *
 * Rules:
 * - Only look at user messages (assistants mirror whatever language the user
 *   used; the user's messages are the ground truth for intent).
 * - Exclude tool outputs.
 * - If CJK characters make up > 30% of word-ish characters, call it 'zh'.
 *   Technical keywords ("OPC", "session", "pipeline") keep the ratio low even
 *   in mostly-Chinese transcripts, so 30% is a generous threshold.
 * - Empty / no-user-text → fall back to 'en'.
 */
export function detectPrimaryLang(chunks: Chunk[]): Lang {
  const userText = chunks
    .flatMap((c) => c.messages)
    .filter((m) => m.role === 'user' && !m.isToolOutput)
    .map((m) => m.text)
    .join('\n')

  if (!userText.trim()) return 'en'

  return cjkRatio(userText) > 0.3 ? 'zh' : 'en'
}

/**
 * Helper for the translation step: given a primary language, return the
 * target language for the secondary rewrite.
 */
export function otherLang(lang: Lang): Lang {
  return lang === 'zh' ? 'en' : 'zh'
}
