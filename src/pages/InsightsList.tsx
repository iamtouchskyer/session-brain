import { useState, useMemo } from 'react'
import type { InsightCard as InsightCardType } from '../pipeline/types'
import { InsightCard } from '../components/InsightCard'
import { SearchBar } from '../components/SearchBar'

const CATEGORIES = ['ALL', 'GOTCHA', 'PATTERN', 'DECISION', 'DISCOVERY'] as const

interface Props {
  cards: InsightCardType[]
  loading: boolean
  error: string | null
}

export function InsightsList({ cards, loading, error }: Props) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('ALL')

  const filtered = useMemo(() => {
    let result = cards

    if (activeCategory !== 'ALL') {
      result = result.filter((c) => c.category === activeCategory)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.body.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)),
      )
    }

    return result
  }, [cards, activeCategory, search])

  if (loading) {
    return (
      <div className="state-message">
        <div className="state-message__spinner" aria-label="Loading" />
        <p>Loading insights...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="state-message state-message--error">
        <p>Failed to load insights</p>
        <p className="state-message__detail">{error}</p>
      </div>
    )
  }

  return (
    <section className="insights-list" aria-label="Insights">
      <div className="insights-list__controls">
        <div className="insights-list__filters" role="group" aria-label="Filter by category">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`filter-btn ${activeCategory === cat ? 'filter-btn--active' : ''} ${cat !== 'ALL' ? `filter-btn--${cat.toLowerCase()}` : ''}`}
              onClick={() => setActiveCategory(cat)}
              type="button"
              aria-pressed={activeCategory === cat}
            >
              {cat}
            </button>
          ))}
        </div>
        <SearchBar value={search} onChange={setSearch} />
      </div>

      {filtered.length === 0 ? (
        <div className="state-message">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="state-message__icon" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <p>No insights found</p>
          <p className="state-message__detail">
            {search ? 'Try a different search term' : 'No cards have been extracted yet'}
          </p>
        </div>
      ) : (
        <div className="insights-grid">
          {filtered.map((card) => (
            <InsightCard key={card.slug} card={card} />
          ))}
        </div>
      )}
    </section>
  )
}
