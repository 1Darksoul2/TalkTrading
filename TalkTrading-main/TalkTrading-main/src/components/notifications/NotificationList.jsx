import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StoryViewer from '../stories/StoryViewer'
import { postService } from '../../services/postService'
import { storyService } from '../../services/storyService'
import { useAuth } from '../../context/AuthContext'
import { describe } from '../../hooks/useNotifications'
import { timeAgo } from '../../utils/time'

/**
 * Notification rows. Story notifications open the story; likes, comments and mentions open the post;
 * follows open the profile and (with `followBack`) offer a real Follow back button.
 */
export default function NotificationList({ items, markRead, onNavigate, followBack = false }) {
  const { user } = useAuth()
  const [viewer, setViewer] = useState(null)
  const [following, setFollowing] = useState({})     // author_id -> bool, for follow-back buttons

  useEffect(() => {
    if (!followBack) return
    const ids = [...new Set(items.filter(n => n.type === 'follow' && n.actor?.author_id).map(n => n.actor.author_id))]
      .filter(id => !(id in following)).slice(0, 20)
    if (!ids.length) return
    Promise.all(ids.map(id => postService.getFollowStats(id).then(s => [id, s.is_following]).catch(() => [id, true])))
      .then(pairs => setFollowing(prev => ({ ...prev, ...Object.fromEntries(pairs) })))
  }, [items, followBack]) // eslint-disable-line react-hooks/exhaustive-deps -- only when the list changes

  const followUser = async id => {
    setFollowing(prev => ({ ...prev, [id]: true }))
    try { await postService.followUser(id) } catch { setFollowing(prev => ({ ...prev, [id]: false })) }
  }

  const openStory = async item => {
    markRead(item)
    onNavigate?.()
    try {
      if (item.type === 'story_mention' || item.type === 'story_countdown') {
        setViewer({ groups: [{ user: item.actor, loader: () => storyService.userStories(item.actor.user_id) }] })
      } else {
        setViewer({ groups: [{ user: { user_id: user.id, username: user.username }, stories: [await storyService.story(item.story_id)] }] })
      }
    } catch { /* the story has been deleted or has expired */ }
  }

  return (
    <>
      <ul>
        {items.map(n => {
          const row = (
            <>
              <img src={postService.avatarFor(n.actor)} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
              <div className="min-w-0 flex-1 text-sm text-on-surface">
                <p className="break-words"><span className="font-semibold">{n.actor?.username || 'Someone'}</span> {describe(n)} <span className="text-on-surface-muted">{timeAgo(n.created_at)}</span></p>
              </div>
              {!n.is_read && <span className="w-2 h-2 bg-primary rounded-full shrink-0" aria-label="Unread" />}
            </>
          )
          const className = `flex items-center gap-3 px-4 py-3 hover:bg-white/5 w-full text-left ${n.is_read ? '' : 'bg-primary/5'}`
          const showFollowBack = followBack && n.type === 'follow' && n.actor?.author_id && following[n.actor.author_id] === false
          return (
            <li key={`${n.source}-${n.id}`} className="flex items-center">
              {n.source === 'story'
                ? <button onClick={() => openStory(n)} className={className}>{row}</button>
                : <Link to={n.post_id ? `/p/${n.post_id}` : `/profile/${n.actor?.username || ''}`} onClick={() => { markRead(n); onNavigate?.() }} className={className}>{row}</Link>}
              {showFollowBack && (
                <button onClick={() => followUser(n.actor.author_id)} className="mr-4 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold shrink-0">Follow back</button>
              )}
            </li>
          )
        })}
      </ul>
      {viewer && <StoryViewer groups={viewer.groups} onClose={() => setViewer(null)} />}
    </>
  )
}
