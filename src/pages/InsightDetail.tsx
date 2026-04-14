import { useState, useEffect, useMemo } from 'react'
import type { InsightCard as InsightCardType } from '../pipeline/types'
import { loadCard } from '../lib/data'
import { CategoryBadge } from '../components/CategoryBadge'
import { TagChip } from '../components/TagChip'
import { InsightCard } from '../components/InsightCard'
import { navigate } from '../lib/router'

interface Props {
  slug: string
  allCards: InsightCardType[]
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function renderBody(body: string): React.ReactElement[] {
  return body.split('\n').map((line, i) => {
    // Code-ish lines
    if (line.startsWith('```') || line.startsWith('  ') || line.startsWith('\t')) {
      return <pre key={i} className="detail__code">{line.replace(/^```\w*/, '').replace(/```$/, '')}</pre>
    }
    // Bold
    const formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Inline code
    const withCode = formatted.replace(/`([^`]+)`/g, '<code>$1</code>')
    return <p key={i} className="detail__paragraph" dangerouslySetInnerHTML={{ __html: withCode }} />
  })
}

export function InsightDetail({ slug, allCards }: Props) {
  const [card, setCard] = useState<InsightCardType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if card is already in allCards
    const cached = allCards.find((c) => c.slug === slug)
    if (cached) {
      setCard(cached)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    loadCard(slug)
      .then(setCard)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug, allCards])

  const related = useMemo(() => {
    if (!card) return []
    return allCards
      .filter((c) => c.slug !== card.slug && c.tags.some((t) => card.tags.includes(t)))
      .slice(0, 3)
  }, [card, allCards])

  if (loading) {
    return (
      <div className="state-message">
        <div className="state-message__spinner" aria-label="Loading" />
        <p>Loading insight...</p>
      </div>
    )
  }

  if (error || !card) {
    return (
      <div className="state-message state-message--error">
        <p>Insight not found</p>
        <p className="state-message__detail">{error || `No card with slug "${slug}"`}</p>
        <button className="btn btn--secondary" onClick={() => navigate('/')} type="button">
          Back to list
        </button>
      </div>
    )
  }

  return (
    <article className="detail" aria-label={`Insight: ${card.title}`}>
      <nav className="detail__nav" aria-label="Breadcrumb">
        <button
          className="detail__back"
          onClick={() => navigate('/')}
          type="button"
          aria-label="Back to insights list"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to insights
        </button>
      </nav>

      <header className="detail__header">
        <CategoryBadge category={card.category} />
        <h1 className="detail__title">{card.title}</h1>
        <div className="detail__meta">
          <time dateTime={card.extractedAt}>{formatDate(card.extractedAt)}</time>
          <span className="detail__separator" aria-hidden="true">&middot;</span>
          <span className="detail__session">
            Session: <code>{card.sessionId.slice(0, 8)}</code>
          </span>
          <span className="detail__separator" aria-hidden="true">&middot;</span>
          <span className="detail__confidence">
            Confidence: {Math.round(card.confidence * 100)}%
          </span>
        </div>
      </header>

      <div className="detail__body">
        {renderBody(card.body)}
      </div>

      {card.tags.length > 0 && (
        <div className="detail__tags">
          {card.tags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>
      )}

      {related.length > 0 && (
        <section className="detail__related" aria-label="Related insights">
          <h2 className="detail__related-title">Related Insights</h2>
          <div className="insights-grid insights-grid--compact">
            {related.map((c) => (
              <InsightCard key={c.slug} card={c} />
            ))}
          </div>
        </section>
      )}
    </article>
  )
}
