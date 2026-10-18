import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { postService } from '../../services/postService'
import { useAuth } from '../../context/AuthContext'

const PAGE = 30
const STATS_BATCH = 6

/**
 * People who follow `profile` (kind="followers") or whom `profile` follows (kind="following").
 * Search filters everything loaded (more pages load automatically while a search is active); each row has a
 * real Follow / Following button whose state comes from the server.
 */
export default function FollowListModal({ profile, kind, onClose, onFollowingChanged }) {
  const { user: me } = useAuth()
  const [people, setPeople] = useState([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [following, setFollowing] = useState({})       // author_id -> boolean, once known
  const [busyIds, setBusyIds] = useState(() => new Set())
  const requested = useRef(new Set())

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    setError('')
    try {
      const batch = await postService.getFollowList(profile.author_id, kind, page + 1, PAGE)
      setPeople(prev => [...prev, ...batch.filter(b => !prev.some(p => p.author_id === b.author_id))])
      setHasMore(batch.length === PAGE)
      setPage(page + 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, profile.author_id, kind, page])

  useEffect(() => { if (page === 0) loadMore() }, [page, loadMore])

  const q = query.trim().toLowerCase()
  const visible = useMemo(() => people.filter(p =>
    !q || p.username.toLowerCase().includes(q) || (p.display_name || '').toLowerCase().includes(q)), [people, q])

  // A search needs every page, so keep loading while one is active.
  useEffect(() => { if (q && hasMore && !loading && !error) loadMore() }, [q, hasMore, loading, error, loadMore])

  // Ask the server whether I follow each person shown (a few at a time).
  useEffect(() => {
    const todo = visible.filter(p => p.author_id !== me?.authorId && !requested.current.has(p.author_id)).slice(0, STATS_BATCH)
    if (!todo.length) return
    todo.forEach(p => requested.current.add(p.author_id))
    Promise.all(todo.map(p => postService.getFollowStats(p.author_id).then(s => [p.author_id, s.is_following]).catch(() => [p.author_id, false])))
      .then(pairs => setFollowing(prev => ({ ...prev, ...Object.fromEntries(pairs) })))
  }, [visible, following, me?.authorId])

  const toggle = async person => {
    const id = person.author_id
    if (busyIds.has(id) || following[id] === undefined) return
    const now = !following[id]
    setBusyIds(prev => new Set(prev).add(id))
    setFollowing(prev => ({ ...prev, [id]: now }))
    try {
      if (now) await postService.followUser(id); else await postService.unfollowUser(id)
      if (profile.is_me) onFollowingChanged?.(now ? 1 : -1)
    } catch (err) {
      setFollowing(prev => ({ ...prev, [id]: !now }))
      setError(err.message)
    } finally {
      setBusyIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  const title = kind === 'followers' ? 'Followers' : 'Following'
  const ui = (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="w-full max-w-md max-h-[80vh] bg-surface-card rounded-2xl border border-white/10 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-base font-bold text-on-surface">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 text-on-surface-muted hover:text-on-surface"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="px-4 py-2">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${title.toLowerCase()}`} aria-label={`Search ${title.toLowerCase()}`}
            className="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/50" />
        </div>
        <div className="overflow-y-auto flex-1 px-2 pb-2">
          {visible.map(p => (
            <div key={p.author_id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5">
              <Link to={`/profile/${p.username}`} onClick={onClose} className="flex items-center gap-3 min-w-0 flex-1">
                <img src={postService.avatarFor(p)} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-on-surface truncate">{p.username}</span>
                  <span className="block text-xs text-on-surface-muted truncate">{p.display_name}</span>
                </span>
              </Link>
              {p.author_id !== me?.authorId && (
                <button onClick={() => toggle(p)} disabled={following[p.author_id] === undefined || busyIds.has(p.author_id)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 ${following[p.author_id] ? 'bg-surface-container-high text-on-surface border border-white/10' : 'bg-primary text-on-primary'}`}>
                  {following[p.author_id] === undefined ? '…' : following[p.author_id] ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          ))}
          {!loading && !error && visible.length === 0 && (
            <p className="text-sm text-on-surface-muted text-center py-10">
              {q ? `No one matches “${query.trim()}”.` : kind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </p>
          )}
          {loading && <p className="text-xs text-on-surface-muted text-center py-3">Loading…</p>}
          {error && <p role="alert" className="text-xs text-error text-center py-3">{error} <button onClick={loadMore} className="font-semibold underline">Retry</button></p>}
          {hasMore && !loading && !q && people.length > 0 && <button onClick={loadMore} className="w-full py-2 text-xs font-semibold text-primary">Load more</button>}
        </div>
      </div>
    </div>
  )
  return createPortal(ui, document.body)
}
