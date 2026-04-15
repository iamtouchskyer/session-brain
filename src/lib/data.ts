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

export async function loadAllArticles(): Promise<(SessionArticle & ArticleMeta)[]> {
  const index = await loadIndex()
  const results = await Promise.allSettled(
    index.articles.map(async (meta) => {
      const article = await loadArticle(meta.slug)
      return { ...meta, ...article }
    })
  )
  return results
    .filter((r): r is PromiseFulfilledResult<SessionArticle & ArticleMeta> => r.status === 'fulfilled')
    .map((r) => r.value)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
