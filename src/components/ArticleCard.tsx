import type { SessionArticle } from '../pipeline/types'
import { ProjectBadge } from './ProjectBadge'
import { navigate } from '../lib/router'
import { GRADIENTS, DEFAULT_GRADIENT } from '../lib/gradients'

interface Props {
  article: SessionArticle
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function ArticleCard({ article }: Props) {
  const gradient = GRADIENTS[article.project] ?? DEFAULT_GRADIENT

  return (
    <article
      className="article-card"
      onClick={() => navigate(`/articles/${article.slug}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/articles/${article.slug}`)
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`Read: ${article.title}`}
    >
      <div className="article-card__hero">
        {article.heroImage ? (
          <img src={`/data/${article.heroImage}`} alt="" className="article-card__hero-img" />
        ) : (
          <div className="article-card__hero-gradient" style={{ background: gradient }} />
        )}
      </div>
      <div className="article-card__content">
        <div className="article-card__meta">
          <time dateTime={article.date}>{formatDate(article.date)}</time>
          <span className="article-card__sep" aria-hidden="true">&middot;</span>
          <span>{article.duration}</span>
          <span className="article-card__sep" aria-hidden="true">&middot;</span>
          <ProjectBadge project={article.project} />
        </div>
        <h2 className="article-card__title">{article.title}</h2>
        <p className="article-card__summary">{article.summary}</p>
        {article.tags.length > 0 && (
          <div className="article-card__tags">
            {article.tags.map((tag) => (
              <span key={tag} className="article-card__tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
