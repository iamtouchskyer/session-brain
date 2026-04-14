import { useState, useEffect } from 'react'
import type { InsightCard } from './pipeline/types'
import { loadAllCards, loadIndex } from './lib/data'
import { useRoute, navigate } from './lib/router'
import { useTheme } from './lib/theme'
import { ThemeToggle } from './components/ThemeToggle'
import { SearchBar } from './components/SearchBar'
import { InsightsList } from './pages/InsightsList'
import { InsightDetail } from './pages/InsightDetail'
import { Timeline } from './pages/Timeline'

function App() {
  const route = useRoute()
  const { theme, toggle } = useTheme()

  const [cards, setCards] = useState<InsightCard[]>([])
  const [sessionCount, setSessionCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [navSearch, setNavSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([loadAllCards(), loadIndex()])
      .then(([loadedCards, index]) => {
        setCards(loadedCards)
        setSessionCount(index.sessions.length)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // When nav search changes and we're not on list page, go to list
  useEffect(() => {
    if (navSearch && route.path !== '/') {
      navigate('/')
    }
  }, [navSearch])

  const renderPage = () => {
    switch (route.path) {
      case '/insights/:slug':
        return <InsightDetail slug={route.params.slug} allCards={cards} />
      case '/timeline':
        return <Timeline cards={cards} loading={loading} error={error} />
      default:
        return <InsightsList cards={cards} loading={loading} error={error} />
    }
  }

  return (
    <div className="app">
      <header className="nav" role="banner">
        <div className="nav__inner">
          <a
            href="#/"
            className="nav__logo"
            aria-label="Session Brain home"
          >
            <span className="nav__logo-icon" aria-hidden="true">&#x1f9e0;</span>
            <span className="nav__logo-text">Session Brain</span>
          </a>

          <nav className="nav__links" aria-label="Main navigation">
            <a
              href="#/"
              className={`nav__link ${route.path === '/' ? 'nav__link--active' : ''}`}
            >
              Insights
            </a>
            <a
              href="#/timeline"
              className={`nav__link ${route.path === '/timeline' ? 'nav__link--active' : ''}`}
            >
              Timeline
            </a>
          </nav>

          <div className="nav__actions">
            <div className="nav__search">
              <SearchBar value={navSearch} onChange={setNavSearch} placeholder="Search..." />
            </div>
            <ThemeToggle theme={theme} toggle={toggle} />
          </div>
        </div>
      </header>

      <main className="main" id="main-content">
        {renderPage()}
      </main>

      <footer className="footer" role="contentinfo">
        <p className="footer__text">
          {loading
            ? 'Loading...'
            : `${cards.length} insight${cards.length !== 1 ? 's' : ''} extracted from ${sessionCount} session${sessionCount !== 1 ? 's' : ''}`}
        </p>
      </footer>
    </div>
  )
}

export default App
