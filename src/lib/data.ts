import type { SessionArticle } from '../pipeline/types'
import type { ArticleIndex, ArticleMeta } from './storage'
import { createAdapter } from './storage'

const adapter = createAdapter()

export type { ArticleIndex, ArticleMeta }

export async function loadIndex(): Promise<ArticleIndex> {
  return adapter.loadIndex()
}

export async function loadArticle(slug: string): Promise<SessionArticle> {
  return adapter.loadArticle(slug)
}

/**
 * Returns only index metadata — no per-article fetches.
 * ArticleCard only needs: slug, title, summary, tags, date, duration, project, heroImage, stats.
 * All of these come from index.json directly.
 */
export async function loadAllArticles(): Promise<ArticleMeta[]> {
  const index = await loadIndex()
  return [...index.articles].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}
