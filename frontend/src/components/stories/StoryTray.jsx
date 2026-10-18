import { useCallback, useEffect, useMemo, useState } from 'react'
import { storyService } from '../../services/storyService'
import { postService } from '../../services/postService'
import { useAuth } from '../../context/AuthContext'
import StoryViewer from './StoryViewer'
import StoryComposer from './StoryComposer'

function ringClass(item) {
  if (!item.has_unseen && !item.is_me) return 'bg-white/20'
  if (item.close_friends) return 'bg-gradient-to-tr from-green-400 to-emerald-600'
  return 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600'
}

/** Home-page row of stories: yours first, then people you follow, unseen before seen. */
export default function StoryTray() {
  const { user } = useAuth()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [avatar, setAvatar] = useState('')
  const [session, setSession] = useState(null)   // { groups, start }: a frozen copy, so a refresh cannot reorder people mid-view
  const [composing, setComposing] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems(await storyService.tray())
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => { load() }, [load, user?.id])

  // Come back to the tab: pick up new stories and the ring state changes from watching.
  useEffect(() => {
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  useEffect(() => {
    postService.getMyProfile().then(p => setAvatar(postService.avatarFor(p))).catch(() => {})
  }, [user?.id])

  const groups = useMemo(() => (items || []).map(item => ({
    user: item.user,
    muted: item.muted,
    loader: () => storyService.userStories(item.user.user_id),
  })), [items])

  const mine = items?.find(i => i.is_me)
  const others = (items || []).filter(i => !i.is_me)
  const open = item => setSession({ groups, start: (items || []).indexOf(item) })
  const myAvatar = avatar || postService.avatarFor({ username: user?.username })

  return (
    <section aria-label="Stories" className="w-full overflow-x-auto hide-scrollbar pl-4 md:pl-0 pt-2 pb-2">
      <div className="flex gap-4 min-w-max">
        <div className="flex flex-col items-center gap-1 w-[72px]">
          <div className="relative">
            <button
              onClick={() => (mine ? open(mine) : setComposing(true))}
              aria-label={mine ? 'View your story' : 'Add to your story'}
              className={`p-[2px] rounded-full ${mine ? ringClass(mine) : 'bg-transparent'} hover:scale-105 transition-transform`}
            >
              <span className="block w-16 h-16 rounded-full overflow-hidden border-2 border-background">
                <img src={myAvatar} alt="" className="w-full h-full object-cover" />
              </span>
            </button>
            <button onClick={() => setComposing(true)} aria-label="Create a story"
              className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-primary text-on-primary border-2 border-background flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">add</span>
            </button>
          </div>
          <span className="text-xs font-semibold text-primary">Your story</span>
        </div>

        {others.map(item => (
          <button key={item.user.user_id} onClick={() => open(item)}
            aria-label={`${item.has_unseen ? 'Unseen' : 'Seen'} story by ${item.user.username}`}
            className={`flex flex-col items-center gap-1 w-[72px] group ${item.muted ? 'opacity-50' : ''}`}>
            <span className={`p-[2px] rounded-full ${ringClass(item)} group-hover:scale-105 transition-transform`}>
              <span className="block w-16 h-16 rounded-full overflow-hidden border-2 border-background">
                <img src={postService.avatarFor(item.user)} alt="" className="w-full h-full object-cover" />
              </span>
            </span>
            <span className={`text-xs truncate max-w-full ${item.has_unseen ? 'text-on-surface font-semibold' : 'text-on-surface-muted'}`}>{item.user.username}</span>
          </button>
        ))}

        {items === null && !error && <span className="self-center text-xs text-on-surface-muted">Loading stories…</span>}
        {error && (
          <div className="self-center text-xs text-on-surface-muted flex items-center gap-2">
            <span>Couldn&apos;t load stories.</span>
            <button onClick={load} className="font-semibold text-primary hover:underline">Retry</button>
          </div>
        )}
      </div>

      {session && (
        <StoryViewer groups={session.groups} startIndex={session.start} onClose={() => { setSession(null); load() }} />
      )}
      {composing && (
        <StoryComposer onClose={() => setComposing(false)} onPublished={() => { setComposing(false); load() }} />
      )}
    </section>
  )
}
