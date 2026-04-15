import type { SessionArticle } from '../../pipeline/types'

export interface ArticleIndex {
  articles: ArticleMeta[]
  lastUpdated: string
}

export interface ArticleMeta {
  slug: string
  title: string
  summary: string
  date: string
  tags: string[]
  project: string
  heroImage?: string
  path: string  // storage path, e.g. "2026/04/15/slug.json"
  // Optional enriched fields (may be present in index.json for richer list display)
  sessionId?: string
  duration?: string
  stats?: SessionArticle['stats']
}

export interface StorageAdapter {
  loadIndex(): Promise<ArticleIndex>
  loadArticle(slug: string): Promise<SessionArticle>
}
