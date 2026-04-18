import { useState, useMemo } from 'react'
import type { ArticleMeta } from '../lib/storage/types'
import { ArticleCard } from '../components/ArticleCard'
import { SearchBar } from '../components/SearchBar'
import { useT } from '../lib/i18n'

interface Props {
  articles: ArticleMeta[]
  loading: boolean
  error: string | null
}

export function ArticlesList({ articles, loading, error }: Props) {
  const t = useT()
  const [search, setSearch] = useState('')
  const [activeProject, setActiveProject] = useState('ALL')

  const projects = useMemo(() => {
    const set = new Set(articles.map((a) => a.project))
    return ['ALL', ...Array.from(set).sort()]
  }, [articles])

  const filtered = useMemo(() => {
    let result = articles

    if (activeProject !== 'ALL') {
      result = result.filter((a) => a.project === activeProject)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          (a.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
      )
    }

    return result
  }, [articles, activeProject, search])

  if (loading) {
    return (
      <div className="state-message" role="status" aria-live="polite">
        <div className="state-message__spinner" aria-label={t('state.loading')} />
        <p>{t('articlesList.loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="state-message state-message--error" role="alert">
        <p>{t('articlesList.failed')}</p>
        <p className="state-message__detail">{error}</p>
      </div>
    )
  }

  return (
    <section className="articles-list" aria-label="Articles">
      <h1 className="sr-only">{t('articlesList.heading')}</h1>
      <div className="articles-list__controls">
        <div className="articles-list__filters" role="group" aria-label={t('articlesList.filterBy')}>
          {projects.map((proj) => (
            <button
              key={proj}
              className={`filter-btn ${activeProject === proj ? 'filter-btn--active' : ''}`}
              onClick={() => setActiveProject(proj)}
              type="button"
              aria-pressed={activeProject === proj}
            >
              {proj === 'ALL' ? t('articlesList.filterAll') : proj}
            </button>
          ))}
        </div>
        <SearchBar value={search} onChange={setSearch} />
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {filtered.length === 0
          ? t('articlesList.noneFound')
          : t(
              filtered.length === 1
                ? 'articlesList.resultCountSingular'
                : 'articlesList.resultCountPlural',
              { count: String(filtered.length) },
            )}
      </div>

      {filtered.length === 0 ? (
        <div className="state-message">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="state-message__icon" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <p>{t('articlesList.noneFound')}</p>
          <p className="state-message__detail">
            {search ? t('articlesList.tryDifferent') : t('articlesList.emptyDetail')}
          </p>
        </div>
      ) : (
        <div className="articles-feed">
          {filtered.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      )}
    </section>
  )
}
