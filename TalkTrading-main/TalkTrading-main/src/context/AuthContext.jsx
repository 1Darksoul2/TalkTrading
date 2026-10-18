import { createContext, useContext, useState } from 'react'

const AuthContext = createContext()

const STORAGE_KEY = 'tt-auth'

// Mock auth until the backend is ready: the "session" is just the user object,
// kept in localStorage ("Remember me") or sessionStorage (cleared when the tab closes).
function loadUser() {
  if (typeof window === 'undefined') return null
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

function saveUser(user, remember) {
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
  if (user) (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(user))
}

const fakeDelay = () => new Promise(resolve => setTimeout(resolve, 600))

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser)

  const login = async ({ identifier, remember }) => {
    await fakeDelay()
    const isEmail = identifier.includes('@')
    const username = isEmail ? identifier.split('@')[0] : identifier
    const next = {
      username,
      displayName: username,
      email: isEmail ? identifier : `${identifier}@talktrading.app`,
    }
    saveUser(next, remember)
    setUser(next)
    return next
  }

  const signup = async ({ fullName, username, email }) => {
    await fakeDelay()
    const next = { username, displayName: fullName, email }
    saveUser(next, false)
    setUser(next)
    return next
  }

  const requestPasswordReset = async () => {
    await fakeDelay()
  }

  const logout = () => {
    saveUser(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout, requestPasswordReset }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
