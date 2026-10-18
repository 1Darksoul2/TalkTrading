import { POST_SERVICE_URL } from './apiConfig'

const UNREACHABLE_MESSAGE =
  'Cannot reach the server. Please make sure the backend is running and try again.'

const SERVER_ERROR_MESSAGE =
  'The account service ran into a problem on its side. Please try again in a moment.'

// FastAPI returns `detail` as a string for HTTPException but as an array of
// objects for validation (422) errors — stringifying that array directly
// produces "[object Object]".
function messageFromDetail(detail, fallback) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map(d => (d?.msg || '').replace(/^Value error, /, ''))
      .filter(Boolean)
      .join('. ') || fallback
  }
  return fallback
}

async function post(path, options, fallbackMessage) {
  let response
  try {
    response = await fetch(`${POST_SERVICE_URL}${path}`, { method: 'POST', ...options })
  } catch {
    throw new Error(UNREACHABLE_MESSAGE)
  }
  if (!response.ok) {
    // A 5xx is the server's fault — never blame the user's credentials for it
    // (the generic login fallback below would otherwise read "Invalid email or
    // password" for a crashed backend).
    if (response.status >= 500) throw new Error(SERVER_ERROR_MESSAGE)
    // The gateway allows a few sign-in attempts a minute per network.
    if (response.status === 429) throw new Error('Too many attempts from this network. Please wait a minute and try again.')
    const err = await response.json().catch(() => ({}))
    throw new Error(messageFromDetail(err.detail, fallbackMessage))
  }
  return await response.json()
}

export const authService = {
  register({ username, email, password, displayName }) {
    return post(
      '/auth/register',
      {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, display_name: displayName }),
      },
      'Registration failed. Please try again.'
    )
  },

  // `identifier` is the email address or the username.
  login({ identifier, password }) {
    const body = new URLSearchParams()
    body.set('username', identifier)
    body.set('password', password)
    return post(
      '/auth/login',
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
      'Incorrect email/username or password.'
    )
  },

  requestPasswordReset(email) {
    return post(
      '/auth/password-reset',
      {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      },
      'Could not send the reset link. Please try again.'
    )
  },

  resetPassword({ token, newPassword }) {
    return post(
      '/auth/password-reset/confirm',
      {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      },
      'Could not change the password. Please try again.'
    )
  },
}

export default authService
