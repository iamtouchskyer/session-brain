import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { parseJsonl, extractMessages } from './parse'
import { chunkByConversation, scoreChunk, filterChunks } from './chunk'
import { buildExtractionPrompt } from './prompt'
import type { InsightCard, SessionMeta, CardIndex } from './types'

/**
 * Parse YAML-ish cards from the LLM response.
 * Handles the structured YAML output from the extraction prompt.
 */
function parseCardsFromResponse(text: string, sessionId: string): InsightCard[] {
  // Extract YAML block if wrapped in code fences
  const yamlMatch = text.match(/```ya?ml\n([\s\S]*?)```/)
  const yamlText = yamlMatch ? yamlMatch[1] : text

  const cards: InsightCard[] = []
  // Split on top-level list items
  const items = yamlText.split(/\n(?=- slug:)/)

  for (const item of items) {
    const trimmed = item.trim()
    if (!trimmed.startsWith('- slug:') && !trimmed.startsWith('slug:')) continue

    const clean = trimmed.replace(/^- /, '')

    const slug = extractYamlField(clean, 'slug')
    const category = extractYamlField(clean, 'category') as InsightCard['category']
    const confidenceStr = extractYamlField(clean, 'confidence')
    const title = extractYamlField(clean, 'title')
    const body = extractYamlBlock(clean, 'body')
    const tagsStr = extractYamlField(clean, 'tags')

    if (!slug || !category || !title) continue

    const confidence = parseFloat(confidenceStr || '0')
    if (confidence < 0.7) continue

    // Parse tags from ["tag1", "tag2"] format
    const tags: string[] = []
    if (tagsStr) {
      const tagMatch = tagsStr.match(/\[([^\]]*)\]/)
      if (tagMatch) {
        for (const t of tagMatch[1].split(',')) {
          const cleaned = t.trim().replace(/['"]/g, '')
          if (cleaned) tags.push(cleaned)
        }
      }
    }

    cards.push({
      slug,
      category,
      confidence,
      title,
      body: body || '',
      tags,
      sessionId,
      extractedAt: new Date().toISOString(),
    })
  }

  return cards
}

function extractYamlField(text: string, field: string): string {
  const re = new RegExp(`^${field}:\\s*["']?(.+?)["']?\\s*$`, 'm')
  const match = text.match(re)
  return match ? match[1].trim() : ''
}

function extractYamlBlock(text: string, field: string): string {
  const re = new RegExp(`^${field}:\\s*\\|\\n((?:[ \\t]+.+\\n?)*)`, 'm')
  const match = text.match(re)
  if (!match) {
    // Fall back to single-line
    return extractYamlField(text, field)
  }
  return match[1]
    .split('\n')
    .map((l) => l.replace(/^ {2,4}/, ''))
    .join('\n')
    .trim()
}

/**
 * Read or initialize the card index.
 */
function loadIndex(outputDir: string): CardIndex {
  const indexPath = join(outputDir, 'index.json')
  if (existsSync(indexPath)) {
    return JSON.parse(readFileSync(indexPath, 'utf-8'))
  }
  return { cards: [], sessions: [], lastUpdated: new Date().toISOString() }
}

/**
 * Main extraction pipeline.
 * Reads JSONL → parse → chunk → filter → LLM extract → write cards.
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('Usage: npx tsx src/pipeline/extract.ts <session.jsonl> [--output-dir public/data]')
    process.exit(1)
  }

  const jsonlPath = args[0]
  let outputDir = 'public/data'

  const outputIdx = args.indexOf('--output-dir')
  if (outputIdx !== -1 && args[outputIdx + 1]) {
    outputDir = args[outputIdx + 1]
  }

  // 1. Parse
  const entries = parseJsonl(jsonlPath)
  const sessionId = entries[0]?.sessionId ?? 'unknown'
  console.error(`Session: ${sessionId}`)
  console.error(`Entries: ${entries.length}`)

  // 2. Extract messages
  const messages = extractMessages(entries)
  console.error(`Messages: ${messages.length}`)

  // 3. Chunk
  const chunks = chunkByConversation(messages)
  console.error(`Chunks: ${chunks.length}`)

  // Score all chunks (for metadata)
  for (const chunk of chunks) {
    chunk.insightScore = scoreChunk(chunk)
  }

  // 4. Filter
  const filtered = filterChunks(chunks)
  console.error(
    `Signal chunks: ${filtered.length} / ${chunks.length} (${Math.round((filtered.length / Math.max(chunks.length, 1)) * 100)}%)`,
  )

  if (filtered.length === 0) {
    console.error('No signal chunks found. Exiting.')
    writeSessionMeta(outputDir, {
      sessionId,
      cwd: process.cwd(),
      startTime: messages[0]?.timestamp ?? '',
      endTime: messages[messages.length - 1]?.timestamp ?? '',
      totalEntries: entries.length,
      totalMessages: messages.length,
      totalChunks: chunks.length,
      signalChunks: 0,
      cardsExtracted: 0,
    })
    process.exit(0)
  }

  // 5. Build prompt
  const prompt = buildExtractionPrompt(filtered, sessionId)
  console.error(`Prompt: ${prompt.length} chars (~${Math.round(prompt.length / 4)} tokens)`)

  // 6. Call Claude API
  console.error('Calling Claude API...')
  const client = new Anthropic()
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')

  // 7. Parse cards
  const cards = parseCardsFromResponse(responseText, sessionId)
  console.error(`Cards extracted: ${cards.length}`)

  // 8. Write output
  mkdirSync(join(outputDir, 'cards'), { recursive: true })
  mkdirSync(join(outputDir, 'sessions'), { recursive: true })

  const index = loadIndex(outputDir)

  for (const card of cards) {
    const cardPath = join(outputDir, 'cards', `${card.slug}.json`)
    writeFileSync(cardPath, JSON.stringify(card, null, 2))
    console.error(`  → ${cardPath}`)

    if (!index.cards.includes(card.slug)) {
      index.cards.push(card.slug)
    }
  }

  // Update index
  if (!index.sessions.includes(sessionId)) {
    index.sessions.push(sessionId)
  }
  index.lastUpdated = new Date().toISOString()
  writeFileSync(join(outputDir, 'index.json'), JSON.stringify(index, null, 2))

  // Write session metadata
  writeSessionMeta(outputDir, {
    sessionId,
    cwd: process.cwd(),
    startTime: messages[0]?.timestamp ?? '',
    endTime: messages[messages.length - 1]?.timestamp ?? '',
    totalEntries: entries.length,
    totalMessages: messages.length,
    totalChunks: chunks.length,
    signalChunks: filtered.length,
    cardsExtracted: cards.length,
  })

  console.error('Done.')
}

function writeSessionMeta(outputDir: string, meta: SessionMeta): void {
  mkdirSync(join(outputDir, 'sessions'), { recursive: true })
  const metaPath = join(outputDir, 'sessions', `${meta.sessionId}.json`)
  writeFileSync(metaPath, JSON.stringify(meta, null, 2))
  console.error(`  → ${metaPath}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
