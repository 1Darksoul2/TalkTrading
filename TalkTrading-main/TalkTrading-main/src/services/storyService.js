import { STORY_SERVICE_URL } from './apiConfig'
import { getToken } from '../utils/session'

export class StoryError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

const token = getToken

function authHeaders(json = false) {
  const headers = { Authorization: `Bearer ${token()}` }
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

// FastAPI sends either {detail: "text"} or {detail: [{msg, loc}, ...]} for validation problems.
function messageFrom(body, fallback) {
  const detail = body?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) {
    return detail.map(d => String(d.msg || '').replace(/^Value error, /, '')).filter(Boolean).join('. ')
  }
  return fallback
}

async function fail(status, body) {
  if (status === 401) {
    // The login token is missing, expired or invalid: let AuthContext sign the user out.
    window.dispatchEvent(new Event('tt:unauthorized'))
    throw new StoryError('Your session expired. Please log in again.', 401)
  }
  const defaults = { 403: 'You are not allowed to do that.', 404: 'This is no longer available.', 429: 'Too many requests. Please wait a moment.' }
  throw new StoryError(messageFrom(body, defaults[status] || `Something went wrong (${status}).`), status)
}

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(`${STORY_SERVICE_URL}${path}`)
  Object.entries(params || {}).forEach(([k, v]) => v !== undefined && v !== null && url.searchParams.set(k, v))
  let response
  try {
    response = await fetch(url, {
      method,
      headers: authHeaders(body !== undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new StoryError('Could not reach the story service. Check your connection and try again.', 0)
  }
  if (!response.ok) await fail(response.status, await response.json().catch(() => null))
  return response.status === 204 ? null : response.json()
}

export const storyService = {
  // Relative media paths from the service (signed, expiring) become absolute URLs.
  mediaUrl(path) {
    if (!path) return ''
    return path.startsWith('/') ? `${STORY_SERVICE_URL}${path}` : path
  },

  /** Upload an image/video. `onProgress(0..1)` reports progress; returns {abort, promise}. */
  uploadMedia(file, onProgress) {
    const xhr = new XMLHttpRequest()
    const promise = new Promise((resolve, reject) => {
      xhr.open('POST', `${STORY_SERVICE_URL}/stories/media`)
      xhr.setRequestHeader('Authorization', `Bearer ${token()}`)
      xhr.upload.onprogress = e => e.lengthComputable && onProgress?.(e.loaded / e.total)
      xhr.onload = () => {
        let body = null
        try { body = JSON.parse(xhr.responseText) } catch { /* not JSON */ }
        if (xhr.status >= 200 && xhr.status < 300) return resolve(body)
        fail(xhr.status, body).catch(reject)
      }
      xhr.onerror = () => reject(new StoryError('Upload failed. Check your connection and try again.', 0))
      xhr.onabort = () => reject(new StoryError('Upload cancelled.', 0))
      const form = new FormData()
      form.append('file', file)
      xhr.send(form)
    })
    return { promise, abort: () => xhr.abort() }
  },

  createStory: payload => request('/stories', { method: 'POST', body: payload }),
  tray: () => request('/stories/tray'),
  story: id => request(`/stories/${id}`),
  userStories: userId => request(`/stories/user/${userId}`),
  archive: (page = 1, size = 30) => request('/stories/archive', { params: { page, size } }),
  deleteStory: id => request(`/stories/${id}`, { method: 'DELETE' }),
  recordView: id => request(`/stories/${id}/view`, { method: 'POST' }),

  viewers: (id, page = 1) => request(`/stories/${id}/viewers`, { params: { page } }),
  analytics: id => request(`/stories/${id}/analytics`),
  replies: (id, page = 1) => request(`/stories/${id}/replies`, { params: { page } }),

  reply: (id, text) => request(`/stories/${id}/replies`, { method: 'POST', body: { text } }),
  react: (id, emoji) => request(`/stories/${id}/reaction`, { method: 'PUT', body: { emoji } }),
  unreact: id => request(`/stories/${id}/reaction`, { method: 'DELETE' }),
  vote: (id, option) => request(`/stories/${id}/poll/vote`, { method: 'POST', body: { option } }),
  linkClick: id => request(`/stories/${id}/link-click`, { method: 'POST' }),
  answerQuestion: (id, text) => request(`/stories/${id}/question`, { method: 'POST', body: { text } }),
  questionAnswers: (id, page = 1) => request(`/stories/${id}/question/answers`, { params: { page } }),
  answerSlider: (id, value) => request(`/stories/${id}/slider`, { method: 'POST', body: { value } }),
  answerQuiz: (id, option) => request(`/stories/${id}/quiz`, { method: 'POST', body: { option } }),
  setReminder: (id, on) => request(`/stories/${id}/countdown/reminder`, { method: on ? 'PUT' : 'DELETE' }),
  report: (id, reason, details) => request(`/stories/${id}/report`, { method: 'POST', body: { reason, details } }),

  highlights: userId => request(`/highlights/user/${userId}`),
  highlight: id => request(`/highlights/${id}`),
  createHighlight: body => request('/highlights', { method: 'POST', body }),
  updateHighlight: (id, body) => request(`/highlights/${id}`, { method: 'PATCH', body }),
  deleteHighlight: id => request(`/highlights/${id}`, { method: 'DELETE' }),
  reorderHighlights: ids => request('/highlights/order', { method: 'PUT', body: { ids } }),

  // Close Friends / hide-from / muted stories share one shape.
  listPeople: (kind, page = 1) => request(`/${kind}`, { params: { page, size: 100 } }),
  addPerson: (kind, userId) => request(`/${kind}`, { method: 'POST', body: { user_id: userId } }),
  removePerson: (kind, userId) => request(`/${kind}/${userId}`, { method: 'DELETE' }),

  settings: () => request('/story-settings'),
  updateSettings: changes => request('/story-settings', { method: 'PUT', body: changes }),

  notifications: () => request('/notifications'),
  unreadNotificationCount: () => request('/notifications/unread-count').then(r => r.unread_count),
  markNotificationRead: id => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),

  exportData: () => request('/export'),
  deleteAllData: () => request('/account-data', { method: 'DELETE', body: { confirm: 'DELETE' } }),
}

export const REACTIONS = ['❤️', '😂', '😮', '😢', '👏', '🔥', '📈', '📉', '🚀', '💯']
export const REPORT_REASONS = [
  ['spam', 'Spam'], ['scam', 'Scam or fraud'], ['harassment', 'Harassment or bullying'],
  ['nudity', 'Nudity'], ['violence', 'Violence'], ['false_information', 'False information'], ['other', 'Something else'],
]
