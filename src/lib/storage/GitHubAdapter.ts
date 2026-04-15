import type { SessionArticle } from '../../pipeline/types'
import type { StorageAdapter, ArticleIndex } from './types'

const REPO = import.meta.env.VITE_GITHUB_REPO ?? 'iamtouchskyer/logex-data'
const BRANCH = import.meta.env.VITE_GITHUB_BRANCH ?? 'main'
const TOKEN = import.meta.env.VITE_GITHUB_TOKEN ?? ''

function rawUrl(path: string): string {
  if (TOKEN) {
    // Use API for private repos
    return `https://api.github.com/repos/${REPO}/contents/${path}`
  }
  // Public repo — use raw.githubusercontent.com
  return `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`
}

async function fetchFile<T>(path: string): Promise<T> {
  const url = rawUrl(path)
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (TOKEN) {
    headers['Authorization'] = `Bearer ${TOKEN}`
    headers['Accept'] = 'application/vnd.github.raw+json'
  }
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`GitHub fetch failed: ${path} (${res.status})`)
  return res.json()
}

export class GitHubAdapter implements StorageAdapter {
  async loadIndex(): Promise<ArticleIndex> {
    return fetchFile<ArticleIndex>('index.json')
  }

  async loadArticle(slug: string): Promise<SessionArticle> {
    const index = await this.loadIndex()
    const meta = index.articles.find((a) => a.slug === slug)
    if (!meta) throw new Error(`Article not found: ${slug}`)
    return fetchFile<SessionArticle>(meta.path)
  }
}
