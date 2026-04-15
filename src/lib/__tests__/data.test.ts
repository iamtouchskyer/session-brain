import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ArticleIndex } from '../storage/types'
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

const makeIndex = (articles: ArticleIndex['articles'] = []): ArticleIndex => ({
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

  it('loads and merges all articles sorted newest first', async () => {
    const meta1 = { slug: 'a1', title: 'A1', summary: '', date: '2026-04-15', tags: [], project: 'p', path: '2026/04/15/a1.json' }
    const meta2 = { slug: 'a2', title: 'A2', summary: '', date: '2026-04-14', tags: [], project: 'p', path: '2026/04/14/a2.json' }
    mockAdapter.loadIndex.mockResolvedValueOnce(makeIndex([meta1, meta2]))
    mockAdapter.loadArticle.mockResolvedValueOnce(makeArticle('a1', '2026-04-15'))
    mockAdapter.loadArticle.mockResolvedValueOnce(makeArticle('a2', '2026-04-14'))

    const result = await loadAllArticles()
    expect(result).toHaveLength(2)
    expect(result[0].slug).toBe('a1')
    expect(result[1].slug).toBe('a2')
  })

  it('skips failed article fetches gracefully', async () => {
    const meta1 = { slug: 'a1', title: 'A1', summary: '', date: '2026-04-15', tags: [], project: 'p', path: '2026/04/15/a1.json' }
    const meta2 = { slug: 'fail', title: 'Fail', summary: '', date: '2026-04-14', tags: [], project: 'p', path: '2026/04/14/fail.json' }
    mockAdapter.loadIndex.mockResolvedValueOnce(makeIndex([meta1, meta2]))
    mockAdapter.loadArticle.mockResolvedValueOnce(makeArticle('a1', '2026-04-15'))
    mockAdapter.loadArticle.mockRejectedValueOnce(new Error('not found'))

    const result = await loadAllArticles()
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('a1')
  })

  it('returns empty array when no articles', async () => {
    mockAdapter.loadIndex.mockResolvedValueOnce(makeIndex([]))
    const result = await loadAllArticles()
    expect(result).toHaveLength(0)
  })
})
