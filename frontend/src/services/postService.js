import { POST_SERVICE_URL } from './apiConfig'
import { parseServerDate } from '../utils/time'
import { DEFAULT_AVATAR } from '../utils/defaultAvatar'

function getAuthToken() {
  return localStorage.getItem('talktrading_token')   // no fallback: logged-out calls must fail, not act as a fake user
}

function getAuthHeaders(includeContentType = true) {
  const token = getAuthToken()
  const headers = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  if (includeContentType) {
    headers['Content-Type'] = 'application/json'
  }
  return headers
}

export const postService = {
  /**
   * Resolve media URLs properly (relative backend uploads -> full host URL)
   */
  resolveMediaUrl(url) {
    if (!url) return ''
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url
    }
    const cleanUrl = url.startsWith('/') ? url : `/${url}`
    return `${POST_SERVICE_URL}${cleanUrl}`
  },

  /**
   * Normalize an API post response into frontend display schema
   */
  formatPost(p) {
    if (!p) return null

    // Extract ticker from caption like $AAPL or #BTC
    const tickerMatch = p.caption ? p.caption.match(/\$([A-Z0-9]+)/i) : null
    const detectedTicker = tickerMatch ? tickerMatch[1].toUpperCase() : ''

    // First media item if available
    const primaryMedia = (p.media_items && p.media_items.length > 0) ? p.media_items[0] : null
    const resolvedImage = primaryMedia ? this.resolveMediaUrl(primaryMedia.url) : null

    // Relative timestamp
    let formattedTime = 'Just now'
    if (p.created_at) {
      try {
        const diffSecs = Math.floor((Date.now() - parseServerDate(p.created_at).getTime()) / 1000)   // server times are UTC
        if (diffSecs < 60) formattedTime = 'Just now'
        else if (diffSecs < 3600) formattedTime = `${Math.floor(diffSecs / 60)}m ago`
        else if (diffSecs < 86400) formattedTime = `${Math.floor(diffSecs / 3600)}h ago`
        else formattedTime = `${Math.floor(diffSecs / 86400)}d ago`
      } catch {
        formattedTime = 'Recently'
      }
    }

    return {
      id: p.id,
      authorId: p.author_id,
      userId: p.author_id,
      username: `trader_${p.author_id}`,            // placeholders until the real account is looked up
      displayName: `Trader #${p.author_id}`,
      userAvatar: DEFAULT_AVATAR,
      isVerified: false,
      content: p.caption || '',
      caption: p.caption || '',
      image: resolvedImage || null,
      hasCustomImage: Boolean(resolvedImage),
      mediaItems: (p.media_items || []).map(m => ({ ...m, resolvedUrl: this.resolveMediaUrl(m.url) })),
      ticker: detectedTicker || '',
      tickerChange: null,
      likes: p.like_count ?? 0,
      comments: p.comment_count ?? 0,
      shares: p.share_count ?? 0,
      saves: p.save_count ?? 0,
      timestamp: formattedTime,
      createdAt: p.created_at,
      isLiked: Boolean(p.engagement?.is_liked_by_me ?? p.engagement?.is_liked),
      isBookmarked: Boolean(p.engagement?.is_saved_by_me ?? p.engagement?.is_saved),
      visibility: p.visibility || 'public',
      status: p.status || 'active',
      isLivePost: true,
    }
  },

  /**
   * Fetch home feed posts
   */
  async fetchFeed({ page = 1, limit = 20, scope = 'all' } = {}) {
    try {
      const response = await fetch(`${POST_SERVICE_URL}/api/v1/feed/?page=${page}&limit=${limit}&scope=${scope}`, {
        headers: getAuthHeaders(true),
      })
      if (response.ok) {
        const data = await response.json()
        const items = Array.isArray(data) ? data : (data?.posts || [])
        return items.map(p => this.formatPost(p))
      }
    } catch {
      // Fall back to listing posts if feed router is empty or encounters an issue
    }
    if (scope === 'following') throw new Error('Could not load your following feed')

    // Fallback to /api/v1/posts/
    const fallbackRes = await fetch(`${POST_SERVICE_URL}/api/v1/posts/?page=${page}&limit=${limit}`, {
      headers: getAuthHeaders(true),
    })
    if (!fallbackRes.ok) {
      throw new Error(`Failed to fetch posts: ${fallbackRes.statusText}`)
    }
    const posts = await fallbackRes.json()
    return (posts || []).map(p => this.formatPost(p))
  },

  /**
   * Fetch post list with optional search and author filters
   */
  async fetchPosts({ author_id, search = '', page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (author_id) params.append('author_id', String(author_id))
    if (search) params.append('search', search)

    const response = await fetch(`${POST_SERVICE_URL}/api/v1/posts/?${params.toString()}`, {
      headers: getAuthHeaders(true),
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.statusText}`)
    }
    const posts = await response.json()
    return (posts || []).map(p => this.formatPost(p))
  },

  /**
   * Fetch single post detail with engagement status
   */
  async getPost(postId) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/posts/${postId}`, {
      headers: getAuthHeaders(true),
    })
    if (!response.ok) {
      const error = new Error(response.status === 404 ? 'This post is not available' : `Failed to load the post (${response.status})`)
      error.status = response.status
      throw error
    }
    const post = await response.json()
    return this.formatPost(post)
  },

  /**
   * Create a new post
   */
  async createPost({ caption, visibility = 'public' }) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/posts/`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ caption, visibility }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail || `Failed to create post: ${response.statusText}`)
    }
    return await response.json()
  },

  /**
   * Upload and attach media file to a post
   */
  async uploadMedia(postId, file, position = 0) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('position', String(position))

    const response = await fetch(`${POST_SERVICE_URL}/api/v1/posts/${postId}/media`, {
      method: 'POST',
      headers: getAuthHeaders(false), // don't set Content-Type for FormData
      body: formData,
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail || `Failed to upload post media: ${response.statusText}`)
    }
    return await response.json()
  },

  /**
   * Convenience wrapper: Create post and optionally attach image file
   */
  /**
   * Create a post with up to 10 photos/videos (a carousel when more than one).
   * All or nothing: if any file fails to upload, the half-made post is deleted and the error is reported,
   * so nobody ends up with a text-only post they did not intend. `onProgress(done, total)` reports progress.
   */
  async createPostWithMedia({ caption, visibility = 'public', ticker = '' }, files = [], onProgress) {
    let finalCaption = caption.trim()
    if (ticker && !finalCaption.includes(`$${ticker.toUpperCase()}`)) {
      finalCaption = `$${ticker.toUpperCase()} ${finalCaption}`
    }
    const list = (Array.isArray(files) ? files : [files]).filter(Boolean)
    const newPost = await this.createPost({ caption: finalCaption, visibility })
    try {
      for (let i = 0; i < list.length; i += 1) {
        onProgress?.(i, list.length)
        await this.uploadMedia(newPost.id, list[i], i)
      }
      onProgress?.(list.length, list.length)
    } catch (err) {
      await this.deletePost(newPost.id).catch(() => {})
      throw new Error(`The post was not published because a file could not be uploaded: ${err.message}`)
    }
    return await this.getPost(newPost.id)
  },

  async updatePost(postId, changes) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/posts/${postId}`, {
      method: 'PUT', headers: getAuthHeaders(true), body: JSON.stringify(changes),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail || 'Could not update the post')
    }
    return this.getPost(postId)
  },

  async deletePost(postId) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/posts/${postId}`, { method: 'DELETE', headers: getAuthHeaders(true) })
    if (!response.ok && response.status !== 404) throw new Error('Could not delete the post')
  },

  async updateComment(commentId, content) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/comments/${commentId}`, {
      method: 'PUT', headers: getAuthHeaders(true), body: JSON.stringify({ content: content.trim() }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail || 'Could not edit the comment')
    }
    return await response.json()
  },

  async deleteComment(commentId) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/comments/${commentId}`, { method: 'DELETE', headers: getAuthHeaders(true) })
    if (!response.ok && response.status !== 404) throw new Error('Could not delete the comment')
  },

  // Public posts filed under a hashtag, newest first: { posts, total }.
  async getHashtagPosts(tag, page = 1, limit = 30) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/hashtags/${encodeURIComponent(tag)}/posts?page=${page}&limit=${limit}`, { headers: getAuthHeaders(true) })
    if (!response.ok) throw new Error('Could not load this hashtag')
    const data = await response.json()
    return { posts: (data.posts || []).map(p => this.formatPost(p)), total: data.total ?? data.total_posts ?? (data.posts || []).length }
  },

  /**
   * Toggle Like
   */
  async toggleLike(postId, currentlyLiked) {
    const method = currentlyLiked ? 'DELETE' : 'POST'
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/posts/${postId}/likes`, {
      method,
      headers: getAuthHeaders(true),
    })
    if (!response.ok && response.status !== 409) {
      throw new Error(`Failed to toggle like: ${response.statusText}`)
    }
    return !currentlyLiked
  },

  /**
   * Toggle Save / Bookmark
   */
  async toggleSave(postId, currentlySaved) {
    const method = currentlySaved ? 'DELETE' : 'POST'
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/posts/${postId}/save`, {
      method,
      headers: getAuthHeaders(true),
    })
    if (!response.ok && response.status !== 409) {
      throw new Error(`Failed to toggle save: ${response.statusText}`)
    }
    return !currentlySaved
  },

  /**
   * Fetch comments tree for a post
   */
  async fetchComments(postId, page = 1, limit = 50) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/posts/${postId}/comments?page=${page}&limit=${limit}`, {
      headers: getAuthHeaders(true),
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch comments: ${response.statusText}`)
    }
    return await response.json()
  },

  /**
   * Add comment or nested reply to a post
   */
  async addComment(postId, content, parentCommentId = null) {
    const body = { content: content.trim() }
    if (parentCommentId) {
      body.parent_comment_id = parentCommentId
    }

    const response = await fetch(`${POST_SERVICE_URL}/api/v1/posts/${postId}/comments`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail || `Failed to add comment: ${response.statusText}`)
    }
    return await response.json()
  },

  /**
   * Record a post share and return the updated share count.
   */
  async recordShare(postId) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/posts/${postId}/shares`, {
      method: 'POST',
      headers: getAuthHeaders(true),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail || `Failed to record share: ${response.statusText}`)
    }
    return await response.json()
  },

  /**
   * Fetch saved posts for the current authenticated user
   */
  async getNotifications() {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/notifications?limit=20`, { headers: getAuthHeaders(true) })
    if (!response.ok) throw new Error('Could not load notifications')
    return await response.json()
  },

  async getUnreadNotificationCount() {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/notifications/unread-count`, { headers: getAuthHeaders(true) })
    if (!response.ok) return 0
    return (await response.json()).unread_count
  },

  async markNotificationRead(id) {
    await fetch(`${POST_SERVICE_URL}/api/v1/notifications/${id}/read`, { method: 'POST', headers: getAuthHeaders(true) })
  },

  async markAllNotificationsRead() {
    await fetch(`${POST_SERVICE_URL}/api/v1/notifications/read-all`, { method: 'POST', headers: getAuthHeaders(true) })
  },

  // People who follow `authorId` (kind "followers") or whom they follow (kind "following"), one page at a time.
  async getFollowList(authorId, kind, page = 1, limit = 30) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/users/${authorId}/${kind}?page=${page}&limit=${limit}`, { headers: getAuthHeaders(true) })
    if (!response.ok) throw new Error(`Could not load ${kind}`)
    return (await response.json()).users || []
  },

  // Posts that @mention this account (shown as the profile's "Tagged" tab); only posts the viewer may see.
  async getTaggedPosts(authorId, page = 1, limit = 30) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/users/${authorId}/mentions?page=${page}&limit=${limit}`, { headers: getAuthHeaders(true) })
    if (!response.ok) throw new Error('Could not load tagged posts')
    return (await response.json()).map(p => this.formatPost(p))
  },

  async getMyProfile() {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/users/me`, { headers: getAuthHeaders(true) })
    if (!response.ok) throw new Error('Could not load your profile')
    return await response.json()
  },

  async getProfileByUsername(username) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/users/by-username/${encodeURIComponent(username)}`, {
      headers: getAuthHeaders(true),
    })
    if (response.status === 404) throw new Error('not_found')
    if (!response.ok) throw new Error('Could not load this profile')
    return await response.json()
  },

  async updateMyProfile({ display_name, bio }) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/users/me`, {
      method: 'PUT',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ display_name, bio }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      const detail = Array.isArray(err.detail) ? err.detail.map(d => d.msg).join('. ') : err.detail
      throw new Error(detail || 'Could not save your profile')
    }
    return await response.json()
  },

  async uploadAvatar(file) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/users/me/avatar`, {
      method: 'POST',
      headers: getAuthHeaders(false),
      body: formData,
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail || 'Could not upload the photo')
    }
    const profile = await response.json()
    window.dispatchEvent(new Event('tt:profile-changed'))   // e.g. the top bar picture
    return profile
  },

  async searchUsers(q) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/users/search?q=${encodeURIComponent(q)}`, {
      headers: getAuthHeaders(true),
    })
    if (!response.ok) throw new Error('Search failed')
    return (await response.json()).users || []
  },

  // { [authorId]: { username, display_name, avatar_url, ... } } for a batch of ids
  async lookupUsers(ids) {
    const wanted = [...new Set(ids.filter(Boolean))]
    if (wanted.length === 0) return {}
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/users/lookup?ids=${wanted.join(',')}`)
    if (!response.ok) return {}
    return (await response.json()).users || {}
  },

  // Replace the "trader_<id>" placeholders on formatted posts with each author's real username and photo.
  async attachAuthors(posts) {
    let people = {}
    try { people = await this.lookupUsers(posts.map(p => p.authorId)) } catch { /* keep the placeholders */ }
    return posts.map(p => {
      const person = people[p.authorId]
      return person ? { ...p, username: person.username, displayName: person.display_name, userAvatar: this.avatarFor(person) } : p
    })
  },

  avatarFor(person) {
    if (!person) return ''
    return person.avatar_url
      ? this.resolveMediaUrl(person.avatar_url)
      : DEFAULT_AVATAR
  },

  async followUser(userId) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/users/${userId}/follow`, {
      method: 'POST',
      headers: getAuthHeaders(true),
    })
    if (!response.ok && response.status !== 409) throw new Error('Could not follow this user')
    return true
  },

  async unfollowUser(userId) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/users/${userId}/follow`, {
      method: 'DELETE',
      headers: getAuthHeaders(true),
    })
    if (!response.ok && response.status !== 404) throw new Error('Could not unfollow this user')
    return true
  },

  async getFollowStats(userId) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/users/${userId}/follow-stats`, {
      headers: getAuthHeaders(true),
    })
    if (!response.ok) throw new Error('Could not load follow stats')
    return await response.json()
  },

  async fetchSavedPosts(page = 1, limit = 50) {
    const response = await fetch(`${POST_SERVICE_URL}/api/v1/users/me/saved-posts?page=${page}&limit=${limit}`, {
      headers: getAuthHeaders(true),
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch saved posts: ${response.statusText}`)
    }
    const saved = await response.json()
    return (saved || []).map(p => this.formatPost(p))
  },
}

export default postService
