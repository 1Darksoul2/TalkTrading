import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Card from '../ui/Card'
import RichText from '../ui/RichText'
import MediaCarousel from './MediaCarousel'
import PostEditDialog from './PostEditDialog'
import ShareSheet from './ShareSheet'
import { postService } from '../../services/postService'
import { useAuth } from '../../context/AuthContext'

const VISIBILITY_ICON = { followers: ['group', 'Followers only'], private: ['lock', 'Only you'] }

/**
 * One post, Instagram style. Works on its own (likes, saves, shares, edits and deletes call the Post Service)
 * and tells the parent about changes through `onChange` / `onDeleted` so lists stay in sync.
 */
export default function PostCard({ post: initial, onChange, onDeleted, onOpenComments, following, onToggleFollow, showFullCaption = false }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [post, setPost] = useState(initial)
  const [expanded, setExpanded] = useState(showFullCaption)
  const [menu, setMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setPost(initial) }, [initial])

  const own = Boolean(user?.authorId) && post.authorId === user.authorId
  const update = next => { setPost(next); onChange?.(next) }
  const fail = message => { setError(message); setTimeout(() => setError(''), 4000) }

  const like = async (force) => {
    if (busy) return
    const willLike = force ?? !post.isLiked
    if (willLike === post.isLiked) return
    const before = post
    update({ ...post, isLiked: willLike, likes: Math.max(0, post.likes + (willLike ? 1 : -1)) })
    setBusy(true)
    try { await postService.toggleLike(post.id, !willLike) } catch (err) { update(before); fail(err.message) } finally { setBusy(false) }
  }

  const save = async () => {
    const before = post
    update({ ...post, isBookmarked: !post.isBookmarked })
    try { await postService.toggleSave(post.id, before.isBookmarked) } catch (err) { update(before); fail(err.message) }
  }

  const remove = async () => {
    setBusy(true)
    try { await postService.deletePost(post.id); onDeleted?.(post.id) } catch (err) { fail(err.message); setBusy(false) }
  }

  const long = (post.content || '').length > 160 || (post.content || '').split('\n').length > 3
  const [visIcon, visLabel] = VISIBILITY_ICON[post.visibility] || []

  return (
    <Card className="overflow-hidden border border-white/10">
      <div className="p-3 flex justify-between items-center">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link to={`/profile/${post.username}`} className="shrink-0">
            <img src={post.userAvatar} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
          </Link>
          <div className="min-w-0">
            <Link to={`/profile/${post.username}`} className="block font-semibold text-sm text-on-surface hover:underline truncate">{post.username}</Link>
            <span className="flex items-center gap-1 text-xs text-on-surface-muted">
              <Link to={`/p/${post.id}`} className="hover:underline">{post.timestamp}</Link>
              {visIcon && <span className="material-symbols-outlined text-[13px]" title={visLabel} aria-label={visLabel}>{visIcon}</span>}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!own && onToggleFollow && following !== undefined && (
            <button onClick={() => onToggleFollow(post.authorId)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${following ? 'bg-surface-container-high text-on-surface border border-white/[0.08]' : 'bg-primary text-on-primary hover:brightness-110'}`}>
              {following ? 'Following' : 'Follow'}
            </button>
          )}
          <button onClick={() => setMenu(true)} aria-label="Post options" className="text-on-surface-muted hover:text-on-surface p-1">
            <span className="material-symbols-outlined">more_horiz</span>
          </button>
        </div>
      </div>

      {post.mediaItems?.length > 0 && (
        <MediaCarousel items={post.mediaItems} alt={post.content?.slice(0, 80) || `Post by ${post.username}`} onDoubleTap={() => like(true)} />
      )}

      <div className="p-3.5 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <div className="flex gap-4 items-center">
            <button onClick={() => like()} aria-label={post.isLiked ? 'Unlike' : 'Like'} aria-pressed={post.isLiked} className="text-on-surface-muted hover:text-on-surface">
              <span className="material-symbols-outlined" style={post.isLiked ? { fontVariationSettings: "'FILL' 1", color: '#EF4444' } : {}}>favorite</span>
            </button>
            <button onClick={() => (onOpenComments ? onOpenComments(post) : navigate(`/p/${post.id}`))} aria-label="Comment" className="text-on-surface-muted hover:text-on-surface">
              <span className="material-symbols-outlined">chat_bubble</span>
            </button>
            <button onClick={() => setSharing(true)} aria-label="Share" className="text-on-surface-muted hover:text-on-surface">
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
          <button onClick={save} aria-label={post.isBookmarked ? 'Remove from saved' : 'Save'} aria-pressed={post.isBookmarked} className="text-on-surface-muted hover:text-on-surface p-1">
            <span className="material-symbols-outlined" style={post.isBookmarked ? { fontVariationSettings: "'FILL' 1" } : {}}>bookmark</span>
          </button>
        </div>

        <p className="text-sm font-semibold text-on-surface">{post.likes.toLocaleString()} {post.likes === 1 ? 'like' : 'likes'}{post.shares ? <span className="font-normal text-on-surface-muted"> · {post.shares} {post.shares === 1 ? 'share' : 'shares'}</span> : null}</p>

        {post.content && (
          <div className="text-sm text-on-surface leading-relaxed whitespace-pre-line break-words">
            <Link to={`/profile/${post.username}`} className="font-bold mr-1.5 hover:underline">{post.username}</Link>
            <span className={!expanded && long ? 'line-clamp-3' : ''}><RichText>{post.content}</RichText></span>
            {!expanded && long && <button onClick={() => setExpanded(true)} className="text-on-surface-muted text-sm">more</button>}
          </div>
        )}

        {!showFullCaption && (
          <button onClick={() => (onOpenComments ? onOpenComments(post) : navigate(`/p/${post.id}`))} className="text-on-surface-muted hover:text-on-surface text-sm text-left">
            {post.comments > 0 ? `View all ${post.comments} ${post.comments === 1 ? 'comment' : 'comments'}` : 'Add a comment…'}
          </button>
        )}
        {error && <p role="alert" className="text-xs text-error">{error}</p>}
      </div>

      {menu && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-end sm:items-center justify-center" onClick={() => { setMenu(false); setConfirmDelete(false) }}>
          <div role="menu" className="w-full sm:max-w-sm bg-surface-card rounded-t-2xl sm:rounded-2xl overflow-hidden pb-2" onClick={e => e.stopPropagation()}>
            {confirmDelete ? (
              <div className="p-4 flex flex-col gap-3">
                <p className="text-sm font-bold text-on-surface">Delete this post?</p>
                <p className="text-sm text-on-surface-muted">It will be removed for everyone, with its likes and comments.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-lg bg-surface-container-high text-sm font-semibold text-on-surface">Cancel</button>
                  <button disabled={busy} onClick={remove} className="flex-1 py-2.5 rounded-lg bg-error/90 text-black text-sm font-bold disabled:opacity-50">{busy ? 'Deleting…' : 'Delete'}</button>
                </div>
              </div>
            ) : (
              <>
                {own && <button role="menuitem" onClick={() => { setMenu(false); setEditing(true) }} className="w-full px-4 py-3 text-left text-sm text-on-surface hover:bg-white/5">Edit</button>}
                {own && <button role="menuitem" onClick={() => setConfirmDelete(true)} className="w-full px-4 py-3 text-left text-sm font-semibold text-error hover:bg-white/5">Delete</button>}
                <button role="menuitem" onClick={() => { setMenu(false); navigate(`/p/${post.id}`) }} className="w-full px-4 py-3 text-left text-sm text-on-surface hover:bg-white/5">Go to post</button>
                <button role="menuitem" onClick={() => { setMenu(false); setSharing(true) }} className="w-full px-4 py-3 text-left text-sm text-on-surface hover:bg-white/5">Share…</button>
                {!own && following && onToggleFollow && <button role="menuitem" onClick={() => { setMenu(false); onToggleFollow(post.authorId) }} className="w-full px-4 py-3 text-left text-sm text-error hover:bg-white/5">Unfollow</button>}
                <button role="menuitem" onClick={() => setMenu(false)} className="w-full px-4 py-3 text-left text-sm text-on-surface-muted hover:bg-white/5">Cancel</button>
              </>
            )}
          </div>
        </div>
      )}
      {editing && <PostEditDialog post={post} onClose={() => setEditing(false)} onSaved={next => { setEditing(false); update({ ...post, ...next }) }} />}
      {sharing && <ShareSheet post={post} onClose={() => setSharing(false)} onShared={count => update({ ...post, shares: count ?? post.shares })} />}
    </Card>
  )
}
