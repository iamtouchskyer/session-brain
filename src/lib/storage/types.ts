import type { SessionArticle, Lang } from '../../pipeline/types'

/**
 * index.json on disk.
 *
 * Schema is language-aware: each entry holds language-independent fields at the
 * top level (date, project, tags, sessionId, heroImage, stats, duration) and
 * a per-language `i18n` map with { title, summary, path }. `primaryLang` marks
 * which language is the original (source of truth); the other is translated.
 *
 * A legacy shape (flat `title` / `summary` / `path`, no `i18n`) is still
 * accepted at read time via `ArticleIndexEntryLegacy` — the backfill script
 * migrates old entries to the new shape.
 */
export interface ArticleIndex {
  articles: ArticleIndexEntry[]
  lastUpdated: string
}

export interface ArticleIndexEntry {
  slug: string
  date: string
  project: string
  tags: string[]
  sessionId?: string
  heroImage?: string
  chunkIndices?: number[]
  duration?: string
  stats?: SessionArticle['stats']
  /** Which language was generated first (source of truth). */
  primaryLang: Lang
  /** Per-language metadata + path. Keys are Lang values. */
  i18n: Partial<Record<Lang, LangMeta>>
}

/**
 * Legacy (pre-i18n) entry shape. Emitted by older publish runs.
 * Readers must coerce via `normalizeIndexEntry()`.
 */
export interface ArticleIndexEntryLegacy {
  slug: string
  title: string
  summary: string
  date: string
  tags: string[]
  project: string
  heroImage?: string
  path: string
  sessionId?: string
  chunkIndices?: number[]
  duration?: string
  stats?: SessionArticle['stats']
}

export interface LangMeta {
  title: string
  summary: string
  path: string
}

/**
 * Flattened metadata for UI consumption. One row per (slug, lang) after
 * resolving fallback. Components render this shape; see `data.ts` for
 * the coercion.
 */
export interface ArticleMeta {
  slug: string
  title: string
  summary: string
  date: string
  tags: string[]
  project: string
  heroImage?: string
  path: string  // storage path for the resolved language (or fallback)
  lang: Lang              // which language was actually resolved
  primaryLang: Lang       // original source language
  availableLangs: Lang[]  // languages with content on disk
  sessionId?: string
  duration?: string
  stats?: SessionArticle['stats']
}

export interface StorageAdapter {
  /** Returns the raw on-disk index. Callers apply fallback logic. */
  loadIndex(): Promise<ArticleIndex>
  /** Loads an article's full body in the given language. Throws if not present. */
  loadArticle(slug: string, lang: Lang): Promise<SessionArticle>
}

// ---------------------------------------------------------------------------
// Migration helper: legacy flat entry → new i18n entry.
// Safe to call on either shape; idempotent on already-migrated entries.
// ---------------------------------------------------------------------------
export function normalizeIndexEntry(
  raw: ArticleIndexEntry | ArticleIndexEntryLegacy,
  defaultLang: Lang = 'zh',
): ArticleIndexEntry {
  // Already new shape?
  if ('i18n' in raw && raw.i18n) {
    return raw as ArticleIndexEntry
  }
  const legacy = raw as ArticleIndexEntryLegacy
  return {
    slug: legacy.slug,
    date: legacy.date,
    project: legacy.project,
    tags: legacy.tags,
    sessionId: legacy.sessionId,
    heroImage: legacy.heroImage,
    chunkIndices: legacy.chunkIndices,
    duration: legacy.duration,
    stats: legacy.stats,
    primaryLang: defaultLang,
    i18n: {
      [defaultLang]: {
        title: legacy.title,
        summary: legacy.summary,
        path: legacy.path,
      },
    },
  }
}
