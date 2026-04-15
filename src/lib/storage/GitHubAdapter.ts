import type { SessionArticle } from '../../pipeline/types'
import type { StorageAdapter, ArticleIndex } from './types'

const REPO = import.meta.env.VITE_GITHUB_REPO ?? 'iamtouchskyer/logex-data'
const BRANCH = import.meta.env.VITE_GITHUB_BRANCH ?? 'main'
// ⚠️  SECURITY: VITE_* vars are inlined into the browser bundle at build time.
// NEVER set VITE_GITHUB_TOKEN in .env.production or CI for public deployments —
// it exposes the token to all visitors. Private repo access must go through a
// server-side proxy that holds the token out of the client bundle.
const TOKEN = import.meta.env.VITE_GITHUB_TOKEN ?? ''

// ---------------------------------------------------------------------------
// In-memory cache (process lifetime, cleared on page reload)
// ---------------------------------------------------------------------------
const TTL_INDEX = 5 * 60 * 1000    // 5 min
const TTL_ARTICLE = 30 * 60 * 1000 // 30 min

interface CacheEntry { data: unknown; expiresAt: number }
const memCache = new Map<string, CacheEntry>()

export function getCached<T>(key: string): T | null {
  const entry = memCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    memCache.delete(key)
    return null
  }
  return entry.data as T
}

export function setCached(key: string, data: unknown, ttl: number): void {
  memCache.set(key, { data, expiresAt: Date.now() + ttl })
}

/** Expose for testing only */
export function clearMemCache(): void {
  memCache.clear()
  inFlight.clear()
}

// ---------------------------------------------------------------------------
// In-flight dedup — prevents thundering herd on cold cache
// ---------------------------------------------------------------------------
const inFlight = new Map<string, Promise<unknown>>()

// ---------------------------------------------------------------------------
// Cache Storage API (browser cache, stale-while-revalidate)
// Only used for the public CDN path (TOKEN === '').
// ---------------------------------------------------------------------------
const CACHE_NAME = 'logex-v1'

async function fetchWithCache<T>(url: string, ttl: number): Promise<T> {
  if ('caches' in globalThis) {
    try {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(url)
      if (cached) {
        let data: T
        try {
          data = await cached.clone().json() as T
        } catch {
          // Corrupt cache entry — delete and fall through to fresh fetch
          await cache.delete(url)
          throw new Error('corrupt-cache-entry')
        }
        const age = Date.now() - Number(cached.headers.get('x-cached-at') ?? 0)
        if (age < ttl) return data
        // Stale — serve immediately, refresh in background
        fetch(url).then((r) => r.json()).then((fresh) => {
          cache.put(url, new Response(JSON.stringify(fresh), {
            headers: { 'Content-Type': 'application/json', 'x-cached-at': String(Date.now()) },
          })).catch(() => {})
        }).catch(() => {
          // Background refresh failed — delete stale entry so next request gets fresh data
          cache.delete(url).catch(() => {})
        })
        return data
      }
      // Not in cache — fetch and store
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`)
      const data = await res.json() as T
      cache.put(url, new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', 'x-cached-at': String(Date.now()) },
      })).catch(() => {})
      return data
    } catch (e) {
      const msg = (e as Error)?.message ?? ''
      // Re-throw real fetch errors; swallow cache errors and fall through
      if (msg.startsWith('Fetch failed:')) throw e
      if (msg !== 'corrupt-cache-entry') {
        // Unknown cache error — fall through to plain fetch
      }
    }
  }
  // Fallback: no Cache API
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`)
  return res.json()
}

// ---------------------------------------------------------------------------
// Core fetch helpers
// ---------------------------------------------------------------------------
function rawUrl(path: string): string {
  if (TOKEN) {
    // Use API for private repos
    return `https://api.github.com/repos/${REPO}/contents/${path}`
  }
  // Public repo — use jsDelivr CDN (has Chinese CDN nodes, raw.githubusercontent.com is GFW-blocked)
  return `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/${path}`
}

async function fetchFile<T>(path: string, ttl: number): Promise<T> {
  const url = rawUrl(path)

  if (TOKEN) {
    // Private repo via GitHub API — no Cache Storage (auth headers can't be cached safely)
    const cached = getCached<T>(`mem:${path}`)
    if (cached !== null) return cached
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.raw+json',
      Authorization: `Bearer ${TOKEN}`,
    }
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`GitHub fetch failed: ${path} (${res.status})`)
    const data = await res.json() as T
    setCached(`mem:${path}`, data, ttl)
    return data
  }

  // Public CDN: mem cache → in-flight dedup → Cache Storage → network
  const memKey = `pub:${path}`
  const memHit = getCached<T>(memKey)
  if (memHit !== null) return memHit

  // In-flight dedup: if same key already being fetched, wait for that promise
  const existing = inFlight.get(memKey)
  if (existing) return existing as Promise<T>

  const promise = fetchWithCache<T>(url, ttl).then((data) => {
    setCached(memKey, data, ttl)
    inFlight.delete(memKey)
    return data
  }).catch((err) => {
    inFlight.delete(memKey)
    throw err
  })
  inFlight.set(memKey, promise)
  return promise
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------
export class GitHubAdapter implements StorageAdapter {
  async loadIndex(): Promise<ArticleIndex> {
    return fetchFile<ArticleIndex>('index.json', TTL_INDEX)
  }

  async loadArticle(slug: string): Promise<SessionArticle> {
    const index = await this.loadIndex()
    const meta = index.articles.find((a) => a.slug === slug)
    if (!meta) throw new Error(`Article not found: ${slug}`)
    return fetchFile<SessionArticle>(meta.path, TTL_ARTICLE)
  }
}
