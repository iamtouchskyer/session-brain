import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ArticleIndex, ArticleMeta } from '../storage/types'
import type { SessionArticle } from '../../pipeline/types'

// Use vi.hoisted so the mock object is available before vi.mock hoisting
const mockAdapter = vi.hoisted(() => ({
  loadIndex: vi.fn(),
  loadArticle: vi.fn(),
}))

vi.mock('../storage', () => ({
  createAdapter: () => mockAdapter,
}))

import { loadIndex, loadArticle, loadAllArticles } from '../data'

const makeMeta = (slug: string, date = '2026-04-15'): ArticleMeta => ({
  slug,
  title: `Article ${slug}`,
  summary: 'summary',
  date,
  tags: [],
  project: 'test',
  path: `2026/04/15/${slug}.json`,
})

const makeIndex = (articles: ArticleMeta[] = []): ArticleIndex => ({
  articles,
  lastUpdated: '2026-04-15',
})

const makeArticle = (slug: string, date = '2026-04-15'): SessionArticle => ({
  slug,
  title: `Article ${slug}`,
  summary: 'summary',
  body: 'body',
  date,
  tags: [],
  project: 'test',
  sessionId: 'test-session-id',
  duration: '1h 0min',
  stats: { entries: 1, messages: 1, chunks: 1 },
})

describe('loadIndex', () => {
  beforeEach(() => vi.clearAllMocks())

  it('delegates to adapter', async () => {
    const index = makeIndex()
    mockAdapter.loadIndex.mockResolvedValueOnce(index)
    const result = await loadIndex()
    expect(result).toEqual(index)
    expect(mockAdapter.loadIndex).toHaveBeenCalledOnce()
  })
})

describe('loadArticle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('delegates to adapter', async () => {
    const article = makeArticle('my-article')
    mockAdapter.loadArticle.mockResolvedValueOnce(article)
    const result = await loadArticle('my-article')
    expect(result).toEqual(article)
    expect(mockAdapter.loadArticle).toHaveBeenCalledWith('my-article')
  })

  it('propagates errors', async () => {
    mockAdapter.loadArticle.mockRejectedValueOnce(new Error('Article not found: missing'))
    await expect(loadArticle('missing')).rejects.toThrow('Article not found: missing')
  })
})

describe('loadAllArticles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ArticleMeta[] sorted newest first — no per-article fetches', async () => {
    const meta1 = makeMeta('a1', '2026-04-15')
    const meta2 = makeMeta('a2', '2026-04-14')
    mockAdapter.loadIndex.mockResolvedValueOnce(makeIndex([meta2, meta1]))

    const result = await loadAllArticles()
    expect(result).toHaveLength(2)
    expect(result[0].slug).toBe('a1')
    expect(result[1].slug).toBe('a2')
    // Crucially: loadArticle must NOT be called
    expect(mockAdapter.loadArticle).not.toHaveBeenCalled()
  })

  it('returns empty array when no articles', async () => {
    mockAdapter.loadIndex.mockResolvedValueOnce(makeIndex([]))
    const result = await loadAllArticles()
    expect(result).toHaveLength(0)
    expect(mockAdapter.loadArticle).not.toHaveBeenCalled()
  })

  it('returns ArticleMeta[] (not full SessionArticle)', async () => {
    const meta = makeMeta('x1', '2026-04-15')
    mockAdapter.loadIndex.mockResolvedValueOnce(makeIndex([meta]))

    const result = await loadAllArticles()
    expect(result[0]).toEqual(meta)
    // No body field — it's just index metadata
    expect('body' in result[0]).toBe(false)
  })
})
