import type { Chunk } from './types'

/**
 * Build the extraction prompt from filtered chunks.
 * Sorts by score descending, packs within a character budget.
 */
export function buildExtractionPrompt(
  chunks: Chunk[],
  sessionId: string,
  maxTotalChars = 30000,
): string {
  const sorted = [...chunks].sort(
    (a, b) => (b.insightScore ?? 0) - (a.insightScore ?? 0),
  )

  const selected: { chunk: Chunk; convText: string }[] = []
  let totalChars = 0

  for (const chunk of sorted) {
    const convText = chunk.messages
      .filter((m) => !m.isToolOutput)
      .map((m) => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.text.slice(0, 1000)}`)
      .join('\n')

    if (totalChars + convText.length > maxTotalChars) break
    selected.push({ chunk, convText })
    totalChars += convText.length
  }

  const segments = selected.map(
    ({ chunk, convText }, i) =>
      `### Segment ${i + 1} (score: ${(chunk.insightScore ?? 0).toFixed(2)})\n${convText}`,
  )

  const transcript = segments.join('\n\n---\n\n')

  return `Extract card-worthy insights from this AI coding session.

## Rules
- ATOMIC: one insight per card
- SELECTIVE: only genuinely useful insights (quality > quantity)
- Categories: GOTCHA (non-obvious trap), PATTERN (reusable technique), DECISION (arch choice + rationale), DISCOVERY (new capability learned)
- Confidence 0.0-1.0, only output >= 0.7
- Write in session language (Chinese + English technical terms)
- Format as YAML list

## Output format
\`\`\`yaml
- slug: "kebab-case-english"
  category: "GOTCHA"
  confidence: 0.85
  title: "Title here"
  body: |
    Body with context. Use [[links]] for related concepts.
  tags: ["tag1", "tag2"]
\`\`\`

## Session: ${sessionId}

${transcript}

Extract insights now. Zero insights is fine if nothing is card-worthy.`
}
