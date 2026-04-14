import type { InsightCard } from '../pipeline/types'

const CATEGORY_COLORS: Record<InsightCard['category'], string> = {
  GOTCHA: 'badge--gotcha',
  PATTERN: 'badge--pattern',
  DECISION: 'badge--decision',
  DISCOVERY: 'badge--discovery',
}

interface Props {
  category: InsightCard['category']
}

export function CategoryBadge({ category }: Props) {
  return (
    <span className={`badge ${CATEGORY_COLORS[category]}`}>
      {category}
    </span>
  )
}
