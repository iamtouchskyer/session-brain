import { useMemo } from 'react'
import type { InsightCard } from '../pipeline/types'
import { CategoryBadge } from '../components/CategoryBadge'
import { navigate } from '../lib/router'

interface Props {
  cards: InsightCard[]
  loading: boolean
  error: string | null
}

function formatDayHeader(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function groupByDay(cards: InsightCard[]): Map<string, InsightCard[]> {
  const sorted = [...cards].sort(
    (a, b) => new Date(b.extractedAt).getTime() - new Date(a.extractedAt).getTime(),
  )
  const groups = new Map<string, InsightCard[]>()
  for (const card of sorted) {
    const day = card.extractedAt.slice(0, 10) // YYYY-MM-DD
    const group = groups.get(day)
    if (group) {
      group.push(card)
    } else {
      groups.set(day, [card])
    }
  }
  return groups
}

export function Timeline({ cards, loading, error }: Props) {
  const grouped = useMemo(() => groupByDay(cards), [cards])

  if (loading) {
    return (
      <div className="state-message">
        <div className="state-message__spinner" aria-label="Loading" />
        <p>Loading timeline...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="state-message state-message--error">
        <p>Failed to load timeline</p>
        <p className="state-message__detail">{error}</p>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="state-message">
        <p>No insights to display</p>
        <p className="state-message__detail">Extract some insights from your sessions first</p>
      </div>
    )
  }

  return (
    <section className="timeline" aria-label="Timeline">
      <h2 className="timeline__heading">Timeline</h2>
      {Array.from(grouped.entries()).map(([day, dayCards]) => (
        <div key={day} className="timeline__group">
          <h3 className="timeline__date">{formatDayHeader(dayCards[0].extractedAt)}</h3>
          <div className="timeline__track">
            {dayCards.map((card) => (
              <article
                key={card.slug}
                className="timeline__entry"
                onClick={() => navigate(`/insights/${card.slug}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/insights/${card.slug}`)
                  }
                }}
                tabIndex={0}
                role="link"
                aria-label={`View: ${card.title}`}
              >
                <div className="timeline__marker" aria-hidden="true" />
                <div className="timeline__content">
                  <div className="timeline__entry-header">
                    <CategoryBadge category={card.category} />
                    <time className="timeline__time" dateTime={card.extractedAt}>
                      {formatTime(card.extractedAt)}
                    </time>
                  </div>
                  <h4 className="timeline__title">{card.title}</h4>
                  <p className="timeline__body">{card.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
