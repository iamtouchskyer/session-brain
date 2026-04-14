import { useState, useEffect } from 'react'

export interface User {
  login: string
  name: string | null
  avatar: string | null
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  return { user, loading, login: () => { window.location.href = '/api/auth/login' }, logout: () => { window.location.href = '/api/auth/logout' } }
}
