import { EXPLORE_SERVICE_URL } from './apiConfig'

// Explore Service expects a gateway to set a verified X-User-Id header (a Long). In production the
// gateway checks the login token and sets it; for local development (no gateway) the header below
// is used directly.
function headers(userId) {
  const h = {}
  const token = localStorage.getItem('talktrading_token')
  if (token) h.Authorization = `Bearer ${token}`
  if (userId) h['X-User-Id'] = String(userId)
  return h
}

async function request(path, { userId } = {}) {
  const response = await fetch(`${EXPLORE_SERVICE_URL}${path}`, { headers: headers(userId) })
  if (response.status === 401) window.dispatchEvent(new Event('tt:unauthorized'))   // login expired
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || `Explore Service error: ${response.status}`)
  }
  return await response.json()
}

export const exploreService = {
  async getFeed({ userId, page = 0, size = 20, category, hashtag } = {}) {
    const params = new URLSearchParams({ page: String(page), size: String(size) })
    if (category) params.set('category', category)
    if (hashtag) params.set('hashtag', hashtag)
    const data = await request(`/api/v1/explore?${params.toString()}`, { userId })
    return data.content || []
  },

  async getTrending({ page = 0, size = 20 } = {}) {
    const data = await request(`/api/v1/explore/trending?page=${page}&size=${size}`)
    return data.content || []
  },

  async getPopular({ page = 0, size = 20 } = {}) {
    const data = await request(`/api/v1/explore/popular?page=${page}&size=${size}`)
    return data.content || []
  },

  async getRecent({ page = 0, size = 20 } = {}) {
    const data = await request(`/api/v1/explore/recent?page=${page}&size=${size}`)
    return data.content || []
  },

  async getByHashtag(hashtag, { page = 0, size = 20 } = {}) {
    const data = await request(`/api/v1/explore/hashtags/${encodeURIComponent(hashtag)}?page=${page}&size=${size}`)
    return data.content || []
  },

  async recordInteraction({ postId, interactionType, category }, userId) {
    const response = await fetch(`${EXPLORE_SERVICE_URL}/api/v1/explore/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers(userId) },
      body: JSON.stringify({ postId, interactionType, category }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.message || `Explore Service error: ${response.status}`)
    }
    return await response.json()
  },
}

export default exploreService
