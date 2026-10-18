import { useCallback, useEffect, useState } from 'react'
import { postService } from '../services/postService'
import { storyService } from '../services/storyService'
import { parseServerDate } from '../utils/time'

const REFRESH_MS = 30000

// Post Service and Story Service each keep their own notifications; this merges them into one feed.
export const MESSAGES = {
  follow: () => 'started following you',
  like: () => 'liked your post',
  comment: () => 'commented on your post',
  mention: () => 'mentioned you in a post',
  story_reply: n => `replied to your story${n.text ? `: “${n.text}”` : ''}`,
  story_reaction: n => `reacted ${n.text || ''} to your story`,
  story_mention: () => 'mentioned you in their story',
  story_poll_vote: n => `voted “${n.text || ''}” on your poll`,
  story_question: n => `answered your question${n.text ? `: “${n.text}”` : ''}`,
  story_countdown: n => `'s countdown “${n.text || ''}” has ended`,
}

export const describe = n => (MESSAGES[n.type] || (() => 'sent you an update'))(n)

/** Unread count (refreshed every 30 s) plus on-demand loading of the merged list. */
export function useNotifications() {
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [partial, setPartial] = useState(false)     // one of the two services could not be reached

  const refreshCount = useCallback(async () => {
    const [post, story] = await Promise.allSettled([postService.getUnreadNotificationCount(), storyService.unreadNotificationCount()])
    setUnread((post.status === 'fulfilled' ? post.value : 0) + (story.status === 'fulfilled' ? story.value : 0))
  }, [])

  useEffect(() => {
    refreshCount()
    const timer = setInterval(refreshCount, REFRESH_MS)
    return () => clearInterval(timer)
  }, [refreshCount])

  const load = useCallback(async () => {
    setLoading(true)
    const [post, story] = await Promise.allSettled([postService.getNotifications(), storyService.notifications()])
    const merged = [
      ...(post.status === 'fulfilled' ? post.value.notifications.map(n => ({ ...n, source: 'post' })) : []),
      ...(story.status === 'fulfilled' ? story.value.notifications.map(n => ({ ...n, source: 'story' })) : []),
    ].sort((a, b) => parseServerDate(b.created_at) - parseServerDate(a.created_at))
    setItems(merged)
    setPartial(post.status === 'rejected' || story.status === 'rejected')
    setUnread((post.status === 'fulfilled' ? post.value.unread_count : 0) + (story.status === 'fulfilled' ? story.value.unread_count : 0))
    setLoading(false)
  }, [])

  const markRead = useCallback(async item => {
    if (item.is_read) return
    try {
      if (item.source === 'story') await storyService.markNotificationRead(item.id)
      else await postService.markNotificationRead(item.id)
      setItems(prev => prev.map(n => (n.source === item.source && n.id === item.id ? { ...n, is_read: true } : n)))
      refreshCount()
    } catch { /* the badge corrects itself on the next refresh */ }
  }, [refreshCount])

  const markAll = useCallback(async () => {
    await Promise.allSettled([postService.markAllNotificationsRead(), storyService.markAllNotificationsRead()])
    setItems(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnread(0)
  }, [])

  return { unread, items, loading, partial, load, markRead, markAll }
}
