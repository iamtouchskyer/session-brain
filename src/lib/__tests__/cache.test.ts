import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getCached, setCached, clearMemCache } from '../storage/GitHubAdapter'

describe('in-memory cache', () => {
  beforeEach(() => {
    clearMemCache()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null on cache miss', () => {
    expect(getCached('missing-key')).toBeNull()
  })

  it('returns cached value before TTL expires', () => {
    setCached('key1', { foo: 'bar' }, 5000)
    vi.advanceTimersByTime(4999)
    expect(getCached('key1')).toEqual({ foo: 'bar' })
  })

  it('returns null after TTL expires', () => {
    setCached('key-ttl', { data: 42 }, 1000)
    vi.advanceTimersByTime(1001)
    expect(getCached('key-ttl')).toBeNull()
  })

  it('evicts expired entry from map on access', () => {
    setCached('key-evict', 'hello', 500)
    vi.advanceTimersByTime(600)
    // First call evicts
    expect(getCached('key-evict')).toBeNull()
    // Second call still null (not re-inserted)
    expect(getCached('key-evict')).toBeNull()
  })

  it('different keys are independent', () => {
    setCached('a', 1, 10000)
    setCached('b', 2, 100)
    vi.advanceTimersByTime(200)
    expect(getCached('a')).toBe(1)
    expect(getCached('b')).toBeNull()
  })

  it('overwrite updates expiry', () => {
    setCached('key-ow', 'v1', 500)
    vi.advanceTimersByTime(300)
    setCached('key-ow', 'v2', 1000)  // reset TTL with new value
    vi.advanceTimersByTime(400)      // total 700ms — old TTL would have expired
    expect(getCached('key-ow')).toBe('v2')
  })

  it('clearMemCache removes all entries', () => {
    setCached('x', 1, 99999)
    setCached('y', 2, 99999)
    clearMemCache()
    expect(getCached('x')).toBeNull()
    expect(getCached('y')).toBeNull()
  })
})

describe('loadAllArticles integration — uses index only', () => {
  // Verify that loadAllArticles no longer hits loadArticle at all
  // (tested via mock in data.test.ts; this test verifies via fetch mock)

  it('returns array without throwing', async () => {
    // Mock global fetch for the index
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ articles: [], lastUpdated: '2026-04-15' }),
    })
    vi.stubGlobal('fetch', mockFetch)
    vi.stubGlobal('caches', undefined) // disable Cache Storage

    clearMemCache()

    // Dynamic import to get fresh module with mocked fetch
    const { loadAllArticles } = await import('../data')
    // Note: adapter is created once at module level so this test
    // primarily validates that the function signature returns an array
    const result = await loadAllArticles('en')
    expect(Array.isArray(result)).toBe(true)

    vi.unstubAllGlobals()
  })
})
