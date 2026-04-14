interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchBar({ value, onChange, placeholder = 'Search insights...' }: Props) {
  return (
    <div className="search-bar">
      <svg
        className="search-bar__icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="search"
        className="search-bar__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search insights"
      />
      {value && (
        <button
          className="search-bar__clear"
          onClick={() => onChange('')}
          type="button"
          aria-label="Clear search"
        >
          &times;
        </button>
      )}
    </div>
  )
}
