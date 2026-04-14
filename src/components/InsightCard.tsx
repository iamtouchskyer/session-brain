import type { InsightCard as InsightCardType } from '../pipeline/types'
import { CategoryBadge } from './CategoryBadge'
import { TagChip } from './TagChip'
import { navigate } from '../lib/router'

interface Props {
  card: InsightCardType
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function InsightCard({ card }: Props) {
  return (
    <article
      className="insight-card"
      onClick={() => navigate(`/insights/${card.slug}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/insights/${card.slug}`)
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`View insight: ${card.title}`}
    >
      <header className="insight-card__header">
        <CategoryBadge category={card.category} />
        <time className="insight-card__date" dateTime={card.extractedAt}>
          {formatDate(card.extractedAt)}
        </time>
      </header>
      <h3 className="insight-card__title">{card.title}</h3>
      <p className="insight-card__body">{card.body}</p>
      {card.tags.length > 0 && (
        <div className="insight-card__tags">
          {card.tags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>
      )}
    </article>
  )
}
