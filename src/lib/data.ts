import type { CardIndex, InsightCard, SessionMeta } from '../pipeline/types'

const BASE = '/data'

export async function loadIndex(): Promise<CardIndex> {
  const res = await fetch(`${BASE}/index.json`)
  if (!res.ok) throw new Error(`Failed to load index: ${res.status}`)
  return res.json()
}

export async function loadCard(slug: string): Promise<InsightCard> {
  const res = await fetch(`${BASE}/cards/${slug}.json`)
  if (!res.ok) throw new Error(`Card not found: ${slug}`)
  return res.json()
}

export async function loadAllCards(): Promise<InsightCard[]> {
  const index = await loadIndex()
  const results = await Promise.allSettled(index.cards.map(loadCard))
  return results
    .filter((r): r is PromiseFulfilledResult<InsightCard> => r.status === 'fulfilled')
    .map((r) => r.value)
}

export async function loadSession(sessionId: string): Promise<SessionMeta> {
  const res = await fetch(`${BASE}/sessions/${sessionId}.json`)
  if (!res.ok) throw new Error(`Session not found: ${sessionId}`)
  return res.json()
}

export async function searchCards(
  query: string,
  cards: InsightCard[],
): Promise<InsightCard[]> {
  const q = query.toLowerCase()
  return cards.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      c.body.toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q)),
  )
}

export function filterByCategory(
  cards: InsightCard[],
  category: string,
): InsightCard[] {
  return cards.filter((c) => c.category === category)
}

export function filterByTag(cards: InsightCard[], tag: string): InsightCard[] {
  return cards.filter((c) => c.tags.includes(tag))
}
