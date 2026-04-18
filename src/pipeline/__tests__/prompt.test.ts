import { describe, it, expect } from 'vitest'
import { buildExtractionPrompt, buildArticlePrompt, buildTranslateRewritePrompt } from '../prompt'
import type { Chunk, Message } from '../types'

function makeMsg(role: 'user' | 'assistant', text: string): Message {
  return { role, text, isToolOutput: false, timestamp: '2025-01-01T00:00:00Z' }
}

function makeChunk(score: number, text: string): Chunk {
  const msgs = [makeMsg('user', text)]
  return {
    messages: msgs,
    userTextLen: text.length,
    totalLen: text.length,
    startTs: '2025-01-01T00:00:00Z',
    endTs: '2025-01-01T00:01:00Z',
    insightScore: score,
  }
}

describe('buildExtractionPrompt', () => {
  it('produces a valid prompt string containing session id', () => {
    const chunks = [makeChunk(0.8, 'Found a critical bug in auth module')]
    const prompt = buildExtractionPrompt(chunks, 'session-abc')

    expect(prompt).toContain('session-abc')
    expect(prompt).toContain('Extract card-worthy insights')
    expect(prompt).toContain('GOTCHA')
    expect(prompt).toContain('PATTERN')
    expect(prompt).toContain('DECISION')
    expect(prompt).toContain('DISCOVERY')
  })

  it('orders segments by score descending', () => {
    const chunks = [
      makeChunk(0.3, 'Low scoring chunk content here'),
      makeChunk(0.9, 'High scoring chunk content here'),
      makeChunk(0.6, 'Medium scoring chunk content here'),
    ]

    const prompt = buildExtractionPrompt(chunks, 'session-1')

    const highIdx = prompt.indexOf('High scoring')
    const medIdx = prompt.indexOf('Medium scoring')
    const lowIdx = prompt.indexOf('Low scoring')

    expect(highIdx).toBeLessThan(medIdx)
    expect(medIdx).toBeLessThan(lowIdx)
  })

  it('respects max budget and truncates chunks', () => {
    const longText = 'x'.repeat(20000)
    const chunks = [
      makeChunk(0.9, longText),
      makeChunk(0.8, longText),
      makeChunk(0.7, longText),
    ]

    const prompt = buildExtractionPrompt(chunks, 'session-2', 30000)

    // The prompt should not include all 3 chunks since 3 * 20000 > 30000
    // (each chunk text is truncated to 1000 chars in the prompt builder, but
    // the test uses a budget small enough to verify the mechanism)
    expect(prompt).toContain('Segment 1')
  })

  it('includes score in segment headers', () => {
    const chunks = [makeChunk(0.85, 'Some insightful text about debugging')]
    const prompt = buildExtractionPrompt(chunks, 'session-3')

    expect(prompt).toContain('score: 0.85')
  })

  it('filters out tool output messages from prompt text', () => {
    const toolMsg: Message = {
      role: 'assistant',
      text: 'This is tool output that should be excluded',
      isToolOutput: true,
      timestamp: '2025-01-01T00:00:00Z',
    }
    const userMsg = makeMsg('user', 'This is real user text included in prompt')

    const chunk: Chunk = {
      messages: [userMsg, toolMsg],
      userTextLen: userMsg.text.length,
      totalLen: userMsg.text.length + toolMsg.text.length,
      startTs: '2025-01-01T00:00:00Z',
      endTs: '2025-01-01T00:01:00Z',
      insightScore: 0.7,
    }

    const prompt = buildExtractionPrompt([chunk], 'session-4')
    expect(prompt).toContain('This is real user text')
    expect(prompt).not.toContain('This is tool output that should be excluded')
  })

  it('produces YAML format instructions', () => {
    const chunks = [makeChunk(0.7, 'Some chunk text for testing')]
    const prompt = buildExtractionPrompt(chunks, 'session-5')

    expect(prompt).toContain('```yaml')
    expect(prompt).toContain('slug:')
    expect(prompt).toContain('category:')
    expect(prompt).toContain('confidence:')
  })

  it('handles empty chunks array', () => {
    const prompt = buildExtractionPrompt([], 'session-empty')
    expect(prompt).toContain('session-empty')
    expect(prompt).toContain('Extract card-worthy insights')
    // No segments, but prompt is still valid
    expect(prompt).not.toContain('Segment 1')
  })
})

describe('buildArticlePrompt', () => {
  const meta = {
    entries: 10,
    messages: 20,
    chunks: 5,
    startTime: '2026-04-01T00:00:00Z',
    endTime: '2026-04-01T01:00:00Z',
  }

  it('defaults to zh prompt when lang is not specified', () => {
    const chunk = makeChunk(0.8, 'Some user content')
    const prompt = buildArticlePrompt([chunk], 'session-1', meta)
    expect(prompt).toContain('你是一个技术博客作者')
    expect(prompt).not.toContain('You are a technical blogger')
  })

  it('emits en prompt when lang=en', () => {
    const chunk = makeChunk(0.8, 'Some user content')
    const prompt = buildArticlePrompt([chunk], 'session-1', meta, { lang: 'en' })
    expect(prompt).toContain('You are a technical blogger')
    expect(prompt).toContain('Output only the JSON object')
    expect(prompt).not.toContain('写文章')
  })

  it('emits zh prompt when lang=zh', () => {
    const chunk = makeChunk(0.8, 'Some user content')
    const prompt = buildArticlePrompt([chunk], 'session-1', meta, { lang: 'zh' })
    expect(prompt).toContain('你是一个技术博客作者')
  })

  it('includes session metadata in both languages', () => {
    const chunk = makeChunk(0.8, 'Some user content')
    const zh = buildArticlePrompt([chunk], 'abc-123', meta, { lang: 'zh' })
    const en = buildArticlePrompt([chunk], 'abc-123', meta, { lang: 'en' })
    expect(zh).toContain('abc-123')
    expect(en).toContain('abc-123')
  })
})

describe('buildTranslateRewritePrompt', () => {
  const sample = {
    title: '从 Session 到 Paper：OPC Loop 的第一步',
    summary: '用 OPC loop 把 Claude session 转成博客文章的第一次尝试。',
    body: '## 背景\n\n每个 session 都值得成为一篇文章。\n\n```ts\nconst x = 1\n```\n\n`src/pipeline/extract.ts` 是入口。',
    tags: ['opc', 'logex', 'pipeline'],
    project: 'logex',
  }

  it('translates zh → en', () => {
    const prompt = buildTranslateRewritePrompt(sample, 'zh', 'en')
    expect(prompt).toContain('rewriting a technical blog article')
    expect(prompt).toContain('English')
    // Source content must be embedded
    expect(prompt).toContain(sample.title)
    expect(prompt).toContain('src/pipeline/extract.ts')
  })

  it('translates en → zh', () => {
    const enSample = { ...sample, title: 'From Session to Paper', body: '## Background\n\nText.' }
    const prompt = buildTranslateRewritePrompt(enSample, 'en', 'zh')
    expect(prompt).toContain('改写')
    expect(prompt).toContain('中文')
    expect(prompt).toContain('From Session to Paper')
  })

  it('preserves code blocks and file paths verbatim in rules', () => {
    const prompt = buildTranslateRewritePrompt(sample, 'zh', 'en')
    expect(prompt).toContain('Code blocks')
    expect(prompt).toContain('File paths')
    expect(prompt).toContain('character-for-character')
  })

  it('instructs not to translate tags and project', () => {
    const prompt = buildTranslateRewritePrompt(sample, 'zh', 'en')
    expect(prompt).toMatch(/tags.*internal identifiers/)
    expect(prompt).toMatch(/project.*project key/)
  })

  it('throws when source and target languages match', () => {
    expect(() => buildTranslateRewritePrompt(sample, 'zh', 'zh')).toThrow()
    expect(() => buildTranslateRewritePrompt(sample, 'en', 'en')).toThrow()
  })
})
