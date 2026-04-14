import { navigate } from '../lib/router'

interface Props {
  tag: string
  active?: boolean
}

export function TagChip({ tag, active }: Props) {
  return (
    <button
      className={`tag-chip ${active ? 'tag-chip--active' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        navigate(`/insights?tag=${encodeURIComponent(tag)}`)
      }}
      type="button"
      aria-label={`Filter by tag: ${tag}`}
    >
      {tag}
    </button>
  )
}
