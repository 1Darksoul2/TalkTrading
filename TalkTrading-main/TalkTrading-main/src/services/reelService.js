import { REEL_SERVICE_URL } from './apiConfig'
import { getToken } from '../utils/session'

export class ReelError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

// The Reel Service wraps every answer as { success, message, data } and errors as { detail } or { message }.
function messageFrom(body, fallback) {
  const detail = body?.detail ?? body?.message
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) {
    return detail.map(d => String(d.msg || '').replace(/^Value error, /, '')).filter(Boolean).join('. ')
  }
  return fallback
}

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(`${REEL_SERVICE_URL}/api/v1${path}`)
  Object.entries(params || {}).forEach(([k, v]) => v !== undefined && v !== null && url.searchParams.set(k, v))
  const headers = { Authorization: `Bearer ${getToken()}` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let response
  try {
    response = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  } catch {
    throw new ReelError('Could not reach the reel service. Check your connection and try again.', 0)
  }
  const data = await response.json().catch(() => null)
  if (response.status === 401) {
    window.dispatchEvent(new Event('tt:unauthorized'))
    throw new ReelError('Your session expired. Please log in again.', 401)
  }
  if (!response.ok) throw new ReelError(messageFrom(data, `Something went wrong (${response.status}).`), response.status)
  return data?.data
}

export const reelService = {
  // Uploaded files come back as service-relative paths.
  mediaUrl(path) {
    if (!path) return ''
    return path.startsWith('/') ? `${REEL_SERVICE_URL}${path}` : path
  },

  feed: (page = 1, pageSize = 10) => request('/feed', { params: { page, page_size: pageSize, include_ads: false } }),
  get: id => request(`/reels/${id}`),
  create: payload => request('/reels', { method: 'POST', body: payload }),
  remove: id => request(`/reels/${id}`, { method: 'DELETE' }),
  recordView: id => request(`/reels/${id}/view`, { method: 'POST' }),
  toggleLike: id => request(`/reels/${id}/like`, { method: 'POST' }),
  toggleBookmark: id => request(`/reels/${id}/bookmark`, { method: 'POST' }),
  share: (id, platform = 'copy_link') => request(`/reels/${id}/share`, { method: 'POST', body: { platform } }),
  comments: (id, skip = 0, limit = 50) => request(`/reels/${id}/comments`, { params: { skip, limit } }),
  addComment: (id, content, parentId) => request(`/reels/${id}/comments`, { method: 'POST', body: { content, parent_id: parentId } }),
  deleteComment: commentId => request(`/reels/comments/${commentId}`, { method: 'DELETE' }),
  report: (id, reason, description) => request(`/moderation/reels/${id}/report`, { method: 'POST', body: { reason, description: description || null } }),

  /** Upload the video (and a poster frame). Returns { video_url, thumbnail_url, mime_type, file_size_bytes }. */
  async upload(video, poster) {
    const form = new FormData()
    form.append('video', video)
    if (poster) form.append('poster', poster, 'poster.jpg')
    let response
    try {
      response = await fetch(`${REEL_SERVICE_URL}/api/v1/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      })
    } catch {
      throw new ReelError('Upload failed. Check your connection and try again.', 0)
    }
    const data = await response.json().catch(() => null)
    if (response.status === 401) {
      window.dispatchEvent(new Event('tt:unauthorized'))
      throw new ReelError('Your session expired. Please log in again.', 401)
    }
    if (!response.ok) throw new ReelError(messageFrom(data, `Upload failed (${response.status}).`), response.status)
    return data.data
  },
}

export const REEL_REPORT_REASONS = [
  ['spam', 'Spam or scam'], ['misinformation', 'False information or manipulation'], ['harassment', 'Harassment or bullying'],
  ['hate_speech', 'Hate speech'], ['violence', 'Violence'], ['nudity', 'Nudity'], ['copyright', 'Copyright'], ['other', 'Something else'],
]

export default reelService
