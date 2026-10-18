import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import TickerStrip from '../components/TickerStrip'
import TrendingTickers from '../components/TrendingTickers'
import StoryTray from '../components/stories/StoryTray'
import PostCard from '../components/posts/PostCard'
import PostComposer from '../components/posts/PostComposer'
import CommentsPanel from '../components/posts/CommentsPanel'
import SuggestedPeople from '../components/profile/SuggestedPeople'
import { postService } from '../services/postService'
import { useAuth } from '../context/AuthContext'

const PAGE = 20

export default function HomeFeed() {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [feedState, setFeedState] = useState('loading')   // loading | ready | error
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [scope, setScope] = useState('all')
  const [followMap, setFollowMap] = useState({})
  const [commentsFor, setCommentsFor] = useState(null)
  const [notice, setNotice] = useState('')

  // Which of the visible authors does the current user already follow?
  const loadFollowStates = useCallback(async list => {
    const ids = [...new Set(list.map(p => p.authorId).filter(id => id && id !== user?.authorId))].filter(id => !(id in followMap)).slice(0, 30)
    if (!ids.length) return
    const entries = await Promise.all(ids.map(async id => {
      try { return [id, (await postService.getFollowStats(id)).is_following] } catch { return [id, false] }
    }))
    setFollowMap(prev => ({ ...prev, ...Object.fromEntries(entries) }))
  }, [user?.authorId, followMap])

  const loadPosts = useCallback(async (nextPage = 1) => {
    if (nextPage === 1) setFeedState('loading'); else setLoadingMore(true)
    try {
      const batch = await postService.attachAuthors(await postService.fetchFeed({ scope, page: nextPage, limit: PAGE }) || [])
      setPosts(prev => (nextPage === 1 ? batch : [...prev, ...batch.filter(b => !prev.some(p => p.id === b.id))]))
      setHasMore(batch.length === PAGE)
      setPage(nextPage)
      setFeedState('ready')
      loadFollowStates(batch)
    } catch (err) {
      if (nextPage === 1) { setPosts([]); setFeedState('error') } else setNotice(err.message)
    } finally {
      setLoadingMore(false)
    }
  }, [scope]) // eslint-disable-line react-hooks/exhaustive-deps -- reload only when the feed scope changes

  useEffect(() => { loadPosts(1) }, [loadPosts, user?.id])

  const toggleFollow = async authorId => {
    const nowFollowing = !followMap[authorId]
    setFollowMap(prev => ({ ...prev, [authorId]: nowFollowing }))
    try {
      if (nowFollowing) await postService.followUser(authorId)
      else await postService.unfollowUser(authorId)
    } catch (err) {
      setFollowMap(prev => ({ ...prev, [authorId]: !nowFollowing }))
      setNotice(err.message)
    }
  }

  const replace = next => setPosts(prev => prev.map(p => (p.id === next.id ? next : p)))

  return (
    <div className="max-w-7xl mx-auto px-0 md:px-8 grid grid-cols-1 md:grid-cols-12 gap-4">
      <div className="md:col-span-8 lg:col-span-9 flex flex-col gap-6">
        <StoryTray />
        <TickerStrip />

        <div className="mx-4 md:mx-0">
          <PostComposer onPublished={async post => {
            const [withAuthor] = await postService.attachAuthors([post])
            setPosts(prev => [withAuthor, ...prev])
          }} />
        </div>

        <div className="flex gap-2 px-4 md:px-0" role="tablist" aria-label="Feed">
          {[['all', 'Everyone'], ['following', 'Following']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={scope === id} onClick={() => setScope(id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border transition-colors ${scope === id ? 'bg-primary/10 text-primary border-primary/30' : 'bg-surface-card text-on-surface-muted border-white/[0.06] hover:border-white/20'}`}>
              {label}
            </button>
          ))}
        </div>

        {notice && <p role="alert" className="mx-4 md:mx-0 text-xs text-error">{notice} <button onClick={() => setNotice('')} className="underline">Dismiss</button></p>}

        <div className="flex flex-col gap-6 px-4 md:px-0">
          {feedState === 'loading' && <p className="text-center text-sm text-on-surface-muted py-12" aria-busy="true">Loading your feed…</p>}
          {feedState === 'error' && (
            <div className="text-center text-sm text-on-surface-muted py-12">
              <p>The feed could not be loaded.</p>
              <button onClick={() => loadPosts(1)} className="mt-2 font-semibold text-primary hover:underline">Try again</button>
            </div>
          )}
          {feedState === 'ready' && posts.length === 0 && (
            <div className="text-center text-sm text-on-surface-muted py-12 space-y-2">
              <p>{scope === 'following' ? 'Nothing here yet. Follow traders to fill this feed.' : 'No posts yet. Be the first to share an analysis.'}</p>
              {scope === 'following' && <Link to="/explore" className="font-semibold text-primary hover:underline">Find people to follow</Link>}
            </div>
          )}
          {feedState === 'ready' && posts.map(post => (
            <PostCard key={post.id} post={post} onChange={replace} onDeleted={id => setPosts(prev => prev.filter(p => p.id !== id))}
              onOpenComments={setCommentsFor} following={followMap[post.authorId]} onToggleFollow={toggleFollow} />
          ))}
          {feedState === 'ready' && hasMore && (
            <button onClick={() => loadPosts(page + 1)} disabled={loadingMore} className="py-3 text-sm font-semibold text-primary disabled:opacity-50">
              {loadingMore ? 'Loading…' : 'Load more posts'}
            </button>
          )}
          {feedState === 'ready' && !hasMore && posts.length > 0 && <p className="text-center text-xs text-on-surface-muted py-4">You&apos;re all caught up.</p>}
        </div>
      </div>

      <aside className="hidden md:flex md:col-span-4 lg:col-span-3 flex-col gap-4">
        <SuggestedPeople />
        <TrendingTickers />
        <p className="px-1 text-[11px] leading-relaxed text-on-surface-muted">
          Posts are opinions, not financial advice.{' '}
          <Link to="/terms" className="hover:underline">Terms</Link> · <Link to="/privacy" className="hover:underline">Privacy</Link> ·{' '}
          <Link to="/guidelines" className="hover:underline">Guidelines</Link> · <Link to="/feedback" className="hover:underline">Feedback</Link>
        </p>
      </aside>

      {commentsFor && createPortal(
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4" onClick={() => setCommentsFor(null)}>
          <div role="dialog" aria-modal="true" aria-label="Comments" className="bg-surface-card max-w-lg w-full rounded-2xl border border-white/10 flex flex-col h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center">
              <h2 className="font-bold text-on-surface">Comments</h2>
              <div className="flex items-center gap-3">
                <Link to={`/p/${commentsFor.id}`} className="text-xs font-semibold text-primary">Open post</Link>
                <button onClick={() => setCommentsFor(null)} aria-label="Close comments" className="p-1 text-on-surface-muted"><span className="material-symbols-outlined">close</span></button>
              </div>
            </div>
            <CommentsPanel post={commentsFor} autoFocus
              onCountChange={delta => setPosts(prev => prev.map(p => (p.id === commentsFor.id ? { ...p, comments: Math.max(0, p.comments + delta) } : p)))} />
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
