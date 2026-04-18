import type { SessionArticle, Lang } from '../pipeline/types'
import type { ArticleIndex, ArticleMeta, ArticleIndexEntry, ArticleIndexEntryLegacy } from './storage'
import { createAdapter } from './storage'
import { normalizeIndexEntry } from './storage/types'

const adapter = createAdapter()

export type { ArticleIndex, ArticleMeta }

export async function loadIndex(): Promise<ArticleIndex> {
  return adapter.loadIndex()
}

export async function loadArticle(slug: string, lang: Lang): Promise<SessionArticle> {
  return adapter.loadArticle(slug, lang)
}

/**
 * Flatten an i18n-shape index entry into an ArticleMeta row for the requested
 * language. Falls back to primaryLang if the requested lang has no content.
 */
function flattenEntry(raw: ArticleIndexEntry | ArticleIndexEntryLegacy, lang: Lang): ArticleMeta {
  const entry = normalizeIndexEntry(raw)
  const available = (Object.keys(entry.i18n) as Lang[]).filter((l) => !!entry.i18n[l])
  const resolvedLang: Lang = entry.i18n[lang]
    ? lang
    : (entry.i18n[entry.primaryLang] ? entry.primaryLang : (available[0] ?? entry.primaryLang))
  const meta = entry.i18n[resolvedLang]!  // guaranteed by resolvedLang selection
  return {
    slug: entry.slug,
    title: meta.title,
    summary: meta.summary,
    date: entry.date,
    tags: entry.tags,
    project: entry.project,
    heroImage: entry.heroImage,
    path: meta.path,
    lang: resolvedLang,
    primaryLang: entry.primaryLang,
    availableLangs: available,
    sessionId: entry.sessionId,
    duration: entry.duration,
    stats: entry.stats,
  }
}

/**
 * Returns ArticleMeta[] for the requested language, newest first.
 * Each row is resolved: if the article doesn't exist in `lang`, fall back to
 * primaryLang. `availableLangs` on each row tells the UI which buttons to show.
 */
export async function loadAllArticles(lang: Lang): Promise<ArticleMeta[]> {
  const index = await loadIndex()
  return [...index.articles]
    .map((a) => flattenEntry(a as ArticleIndexEntry | ArticleIndexEntryLegacy, lang))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
