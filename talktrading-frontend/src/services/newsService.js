import { NEWS_SERVICE_URL } from './apiConfig'

export class NewsError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, { method = 'GET', auth = false } = {}) {
  const headers = {}
  if (auth) headers.Authorization = `Bearer ${localStorage.getItem('talktrading_token')}`
  let response
  try {
    response = await fetch(`${NEWS_SERVICE_URL}${path}`, { method, headers })
  } catch {
    throw new NewsError('Could not reach the news service. Check your connection and try again.', 0)
  }
  if (response.status === 401) {
    window.dispatchEvent(new Event('tt:unauthorized'))
    throw new NewsError('Your session expired. Please log in again.', 401)
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new NewsError(typeof body?.detail === 'string' ? body.detail : `Something went wrong (${response.status}).`, response.status)
  }
  return response.status === 204 ? null : response.json()
}

export const newsService = {
  fetchNewsFeed({ category = null, symbol = null, limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams({ limit, offset })
    if (category) params.set('category', category)
    if (symbol) params.set('symbol', symbol)
    return request(`/news?${params}`)
  },

  fetchArticleById(articleId) {
    return request(`/news/${articleId}`)
  },

  // Bookmarks always belong to the logged-in user (taken from the token by the server).
  fetchBookmarks() {
    return request('/news/bookmarks', { auth: true })
  },

  bookmarkArticle(articleId) {
    return request(`/news/${articleId}/bookmark`, { method: 'PUT', auth: true })
  },

  unbookmarkArticle(articleId) {
    return request(`/news/${articleId}/bookmark`, { method: 'DELETE', auth: true })
  },
}
