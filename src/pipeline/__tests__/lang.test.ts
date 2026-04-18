import { describe, it, expect } from 'vitest'
import { detectPrimaryLang, cjkRatio, otherLang } from '../lang'
import type { Chunk, Message } from '../types'

function makeMsg(role: 'user' | 'assistant', text: string, isToolOutput = false): Message {
  return { role, text, isToolOutput, timestamp: '2025-01-01T00:00:00Z' }
}

function makeChunk(messages: Message[]): Chunk {
  const totalLen = messages.reduce((s, m) => s + m.text.length, 0)
  const userTextLen = messages
    .filter((m) => m.role === 'user')
    .reduce((s, m) => s + m.text.length, 0)
  return {
    messages,
    userTextLen,
    totalLen,
    startTs: '2025-01-01T00:00:00Z',
    endTs: '2025-01-01T00:01:00Z',
  }
}

describe('cjkRatio', () => {
  it('returns 0 for empty text', () => {
    expect(cjkRatio('')).toBe(0)
  })
  it('returns ~1 for pure Chinese', () => {
    expect(cjkRatio('我是中国人')).toBeGreaterThan(0.9)
  })
  it('returns 0 for pure English', () => {
    expect(cjkRatio('hello world foo bar')).toBe(0)
  })
  it('returns a mid value for mixed text', () => {
    const r = cjkRatio('写一个 React 组件') // 5 CJK + "React" "组件" + 1
    expect(r).toBeGreaterThan(0.3)
    expect(r).toBeLessThan(1)
  })
  it('ignores whitespace and punctuation', () => {
    const r = cjkRatio('   !@#   ')
    expect(r).toBe(0)
  })
})

describe('detectPrimaryLang', () => {
  it('detects zh for predominantly Chinese user messages', () => {
    const chunk = makeChunk([
      makeMsg('user', '帮我写一个博客的国际化支持'),
      makeMsg('assistant', 'Sure, let me help you with i18n.'),
    ])
    expect(detectPrimaryLang([chunk])).toBe('zh')
  })

  it('detects en for pure English user messages', () => {
    const chunk = makeChunk([
      makeMsg('user', 'Please help me add internationalization to the blog.'),
    ])
    expect(detectPrimaryLang([chunk])).toBe('en')
  })

  it('ignores assistant text when detecting', () => {
    // User is English, assistant replies in Chinese — should still be 'en'
    const chunk = makeChunk([
      makeMsg('user', 'Refactor this function for clarity.'),
      makeMsg('assistant', '好的，我会帮你重构这个函数，让它更清晰。'),
    ])
    expect(detectPrimaryLang([chunk])).toBe('en')
  })

  it('ignores tool outputs', () => {
    const chunk = makeChunk([
      makeMsg('user', 'Run the tests.'),
      makeMsg('assistant', '测试中。。。中文中文中文中文中文中文', true),
    ])
    expect(detectPrimaryLang([chunk])).toBe('en')
  })

  it('treats heavy mixed content with majority CJK as zh', () => {
    const chunk = makeChunk([
      makeMsg('user', '帮我用 Playwright 写一个 E2E 测试覆盖登录流程，注意认证的路径设置，顺便把错误处理也补一下'),
    ])
    expect(detectPrimaryLang([chunk])).toBe('zh')
  })

  it('falls back to en for empty input', () => {
    expect(detectPrimaryLang([])).toBe('en')
    expect(detectPrimaryLang([makeChunk([])])).toBe('en')
  })
})

describe('otherLang', () => {
  it('swaps zh ↔ en', () => {
    expect(otherLang('zh')).toBe('en')
    expect(otherLang('en')).toBe('zh')
  })
})
