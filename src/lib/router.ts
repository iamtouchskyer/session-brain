import { useState, useEffect, useCallback } from 'react'

interface Route {
  path: string
  params: Record<string, string>
}

function parseHash(): Route {
  const hash = window.location.hash.slice(1) || '/'

  // Match #/insights/:slug
  const detailMatch = hash.match(/^\/insights\/([^/]+)$/)
  if (detailMatch) {
    return { path: '/insights/:slug', params: { slug: detailMatch[1] } }
  }

  // Match #/insights
  if (hash === '/insights') {
    return { path: '/', params: {} }
  }

  // Match #/timeline
  if (hash === '/timeline') {
    return { path: '/timeline', params: {} }
  }

  // Default
  return { path: '/', params: {} }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash)

  useEffect(() => {
    const handler = () => setRoute(parseHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  return route
}

export function navigate(path: string): void {
  window.location.hash = path
}

export function useNavigate(): (path: string) => void {
  return useCallback((path: string) => navigate(path), [])
}
