// The login session: kept in localStorage when "Remember me" is ticked, otherwise in
// sessionStorage (gone when the tab closes). Every service reads the token through here.
const TOKEN_KEY = 'talktrading_token'
const USER_KEY = 'talktrading_user'

function store() {
  try {
    return localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage
  } catch {
    return null
  }
}

export function getToken() {
  try {
    return store()?.getItem(TOKEN_KEY) || null
  } catch {
    return null
  }
}

export function getStoredUser() {
  try {
    const raw = store()?.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSession(token, user, remember) {
  clearSession()
  const target = remember ? localStorage : sessionStorage
  target.setItem(TOKEN_KEY, token)
  target.setItem(USER_KEY, JSON.stringify(user))
}

export function saveUser(user) {
  store()?.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  for (const s of [localStorage, sessionStorage]) {
    s.removeItem(TOKEN_KEY)
    s.removeItem(USER_KEY)
  }
}
