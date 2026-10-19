import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { authService } from '../services/authService'
import { postService } from '../services/postService'
import { deriveAuthorId } from '../utils/authorId'
import { getToken, getStoredUser, saveSession, clearSession } from '../utils/session'

const AuthContext = createContext()

function decodePayload(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

// Milliseconds until the token expires (Infinity if it carries no expiry, 0 if unreadable).
function msUntilExpiry(token) {
  const payload = decodePayload(token)
  if (!payload) return 0
  return payload.exp ? payload.exp * 1000 - Date.now() : Infinity
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const stored = getToken()
    if (stored && msUntilExpiry(stored) > 0) return stored
    clearSession()   // an expired login is no login
    return null
  })
  const [user, setUser] = useState(() => (token ? getStoredUser() : null))

  const persist = (nextToken, nextUser, remember) => {
    saveSession(nextToken, nextUser, remember)
    setToken(nextToken)
    setUser(nextUser)
  }

  const login = useCallback(async ({ email, password, remember = false }) => {
    const { access_token, user: profile } = await authService.login({ email, password })
    const next = { id: profile.id, username: profile.username, email: profile.email }
    persist(access_token, next, remember)
    return next
  }, [])

  const signup = useCallback(async ({ fullName, username, email, password }) => {
    await authService.register({ username, email, password })
    const { access_token, user: profile } = await authService.login({ email, password })
    const next = { id: profile.id, username: profile.username, email: profile.email }
    persist(access_token, next, false)
    // Registration takes no name, so the full name is saved on the new profile right away.
    if (fullName) {
      try {
        await postService.updateMyProfile({ display_name: fullName })
      } catch (err) {
        console.error('Could not save your name; you can add it in Edit Profile:', err)
      }
    }
    return next
  }, [])

  const logout = useCallback(() => {
    clearSession()
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

  // authorId (the int id the post tables use) is always derived live from user.id.
  const userWithAuthorId = useMemo(() => {
    if (!user) return null
    return { ...user, authorId: deriveAuthorId(user.id) }
  }, [user])

  return (
    <AuthContext.Provider value={{
      token,
      user: userWithAuthorId,
      isAuthenticated: Boolean(token && user),
      expiresAt: token ? Date.now() + msUntilExpiry(token) : null,
      login, signup, logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
