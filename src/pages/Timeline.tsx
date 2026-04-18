import { useMemo } from 'react'
import type { ArticleMeta } from '../lib/storage/types'
import { ProjectBadge } from '../components/ProjectBadge'
import { navigate, useLang } from '../lib/router'
import { useT } from '../lib/i18n'

interface Props {
  articles: ArticleMeta[]
  loading: boolean
  error: string | null
}

function formatDayHeader(iso: string, lang: string): string {
  const d = new Date(iso)
  const locale = lang === 'zh' ? 'zh-CN' : 'en-US'
  return d.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function groupByDay(articles: ArticleMeta[]): Map<string, ArticleMeta[]> {
  const sorted = [...articles].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
  const groups = new Map<string, ArticleMeta[]>()
  for (const article of sorted) {
    const day = article.date.slice(0, 10)
    const group = groups.get(day)
    if (group) {
      group.push(article)
    } else {
      groups.set(day, [article])
    }
  }
  return groups
}

export function Timeline({ articles, loading, error }: Props) {
  const t = useT()
  const lang = useLang()
  const grouped = useMemo(() => groupByDay(articles), [articles])

  if (loading) {
    return (
      <div className="state-message" role="status" aria-live="polite">
        <div className="state-message__spinner" aria-label={t('state.loading')} />
        <p>{t('timeline.loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="state-message state-message--error" role="alert">
        <p>{t('timeline.failed')}</p>
        <p className="state-message__detail">{error}</p>
        <button className="btn btn--secondary" onClick={() => navigate('/')} type="button">
          {t('timeline.back')}
        </button>
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="state-message">
        <p>{t('timeline.empty')}</p>
        <p className="state-message__detail">{t('timeline.emptyDetail')}</p>
      </div>
    )
  }

  return (
    <section className="timeline" aria-label="Timeline">
      <h2 className="timeline__heading">{t('timeline.heading')}</h2>
      {Array.from(grouped.entries()).map(([day, dayArticles]) => (
        <div key={day} className="timeline__group">
          <h3 className="timeline__date">{formatDayHeader(dayArticles[0].date, lang)}</h3>
          <div className="timeline__track">
            {dayArticles.map((article) => (
              <div
                key={article.slug}
                className="timeline__entry"
                onClick={() => navigate(`/articles/${article.slug}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/articles/${article.slug}`)
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={t('timeline.read', { title: article.title })}
              >
                <div className="timeline__marker" aria-hidden="true" />
                <div className="timeline__content">
                  <div className="timeline__entry-header">
                    <ProjectBadge project={article.project} />
                    <span className="timeline__duration">{article.duration}</span>
                  </div>
                  <h4 className="timeline__title">{article.title}</h4>
                  <p className="timeline__body">{article.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
