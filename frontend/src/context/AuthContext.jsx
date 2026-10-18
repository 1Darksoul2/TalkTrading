import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { authService } from '../services/authService'
import { deriveAuthorId } from '../utils/authorId'

const AuthContext = createContext()

const TOKEN_KEY = 'talktrading_token'
const USER_KEY = 'talktrading_user'

function decodePayload(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

const decodeUserId = token => decodePayload(token)?.sub || null

// Milliseconds until the token expires (Infinity if it carries no expiry, 0 if unreadable).
function msUntilExpiry(token) {
  const payload = decodePayload(token)
  if (!payload) return 0
  return payload.exp ? payload.exp * 1000 - Date.now() : Infinity
}

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (stored && msUntilExpiry(stored) > 0) return stored
    localStorage.removeItem(TOKEN_KEY)   // an expired login is no login
    localStorage.removeItem(USER_KEY)
    return null
  })
  const [user, setUser] = useState(() => (token ? loadStoredUser() : null))
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const persist = (nextToken, nextUser) => {
    localStorage.setItem(TOKEN_KEY, nextToken)
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    setToken(nextToken)
    setUser(nextUser)
  }

  const register = useCallback(async ({ username, email, password }) => {
    setIsLoading(true)
    setError(null)
    try {
      const created = await authService.register({ username, email, password })
      const { access_token } = await authService.login({ email, password })
      persist(access_token, { id: created.id, username: created.username, email: created.email })
      return created
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async ({ email, password }) => {
    setIsLoading(true)
    setError(null)
    try {
      const { access_token, user: profile } = await authService.login({ email, password })
      // The server returns the real profile; the email-prefix fallback only
      // covers an older backend that doesn't send it yet.
      persist(access_token, {
        id: profile?.id || decodeUserId(access_token),
        username: profile?.username || email.split('@')[0],
        email: profile?.email || email,
      })
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  // Any service answering 401 ("session expired") dispatches this event; sign out so RequireAuth shows the login page.
  useEffect(() => {
    window.addEventListener('tt:unauthorized', logout)
    return () => window.removeEventListener('tt:unauthorized', logout)
  }, [logout])

  // Sign out the moment the login expires, not on the next failed request.
  useEffect(() => {
    if (!token) return
    const left = msUntilExpiry(token)
    if (left === Infinity) return
    const timer = setTimeout(logout, Math.min(Math.max(left, 0), 2 ** 31 - 1))
    return () => clearTimeout(timer)
  }, [token, logout])

  // authorId is always derived live from user.id rather than trusted from
  // storage — a value cached before this field existed (or any future field
  // added the same way) would otherwise be permanently stuck without it.
  const userWithAuthorId = useMemo(() => {
    if (!user) return null
    return { ...user, authorId: deriveAuthorId(user.id) }
  }, [user])

  return (
    <AuthContext.Provider value={{ token, user: userWithAuthorId, isAuthenticated: Boolean(token), expiresAt: token ? Date.now() + msUntilExpiry(token) : null, isLoading, error, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
