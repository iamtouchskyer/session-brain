import type { StorageAdapter } from './types'
import { GitHubAdapter } from './GitHubAdapter'
import { SupabaseAdapter } from './SupabaseAdapter'

export type StorageBackend = 'github' | 'supabase'

export function createAdapter(backend?: StorageBackend): StorageAdapter {
  const b = backend ?? (import.meta.env.VITE_STORAGE as StorageBackend) ?? 'github'
  switch (b) {
    case 'supabase': return new SupabaseAdapter()
    case 'github':
    default:         return new GitHubAdapter()
  }
}

export type { StorageAdapter, ArticleIndex, ArticleMeta } from './types'
