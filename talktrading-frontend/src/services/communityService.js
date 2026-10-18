import { COMMUNITY_SERVICE_URL } from './apiConfig'

// Community Service identifies the caller by an X-User-Id header (a Long, the derived authorId).
// In production the gateway checks the login token and sets X-User-Id itself, replacing whatever
// the browser sent; for local development (no gateway) the header below is used directly.
function headers(userId) {
  const h = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('talktrading_token')
  if (token) h.Authorization = `Bearer ${token}`
  if (userId) h['X-User-Id'] = String(userId)
  return h
}

async function request(path, { method = 'GET', userId, body } = {}) {
  const response = await fetch(`${COMMUNITY_SERVICE_URL}${path}`, {
    method,
    headers: headers(userId),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (response.status === 401) window.dispatchEvent(new Event('tt:unauthorized'))   // login expired
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || err.detail || `Community Service error: ${response.status}`)
  }
  if (response.status === 204) return null
  return await response.json()
}

export const communityService = {
  async healthCheck() {
    try {
      const res = await fetch(`${COMMUNITY_SERVICE_URL}/api/v1/health`)
      return res.ok
    } catch {
      return false
    }
  },

  async listCommunities({ search = '', page = 0, size = 20, userId } = {}) {
    const params = new URLSearchParams({ page: String(page), size: String(size) })
    if (search) params.set('search', search)
    const data = await request(`/api/v1/communities?${params.toString()}`, { userId })
    return data.content || []
  },

  async createCommunity({ name, description = '', icon = '' }, userId) {
    return request('/api/v1/communities', {
      method: 'POST',
      userId,
      body: { name, description, icon },
    })
  },

  async joinCommunity(communityId, userId) {
    return request(`/api/v1/communities/${communityId}/join`, { method: 'POST', userId })
  },

  async leaveCommunity(communityId, userId) {
    return request(`/api/v1/communities/${communityId}/join`, { method: 'DELETE', userId })
  },
}

export default communityService
