import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import RichText from '../ui/RichText'
import { postService } from '../../services/postService'
import { useAuth } from '../../context/AuthContext'
import { timeAgo } from '../../utils/time'

const PAGE = 50
const alive = c => c.status !== 'deleted'

function Comment({ comment, people, me, onReply, onEdited, onDeleted, isReply }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(comment.content)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const person = people[comment.author_id]
  const own = comment.author_id === me
  const edited = comment.updated_at && comment.created_at && comment.updated_at !== comment.created_at

  const save = async e => {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    try { onEdited(await postService.updateComment(comment.id, text)); setEditing(false) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try { await postService.deleteComment(comment.id); onDeleted(comment) } catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <div className={`flex items-start gap-2.5 ${isReply ? 'pl-11' : ''}`}>
      <Link to={`/profile/${person?.username || ''}`} className="shrink-0">
        <img src={postService.avatarFor(person || { username: `user_${comment.author_id}` })} alt="" className={`${isReply ? 'w-7 h-7' : 'w-8 h-8'} rounded-full object-cover`} />
      </Link>
      <div className="flex-1 min-w-0">
        {editing ? (
          <form onSubmit={save} className="flex flex-col gap-1.5">
            <textarea value={text} onChange={e => setText(e.target.value)} maxLength={2000} rows={2} aria-label="Edit comment"
              className="bg-surface-container-low border border-white/10 rounded-lg p-2 text-sm text-on-surface focus:outline-none focus:border-primary/50 resize-none" />
            <div className="flex gap-3 text-xs">
              <button disabled={busy || !text.trim()} className="font-bold text-primary disabled:opacity-40">Save</button>
              <button type="button" onClick={() => { setEditing(false); setText(comment.content) }} className="text-on-surface-muted">Cancel</button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-on-surface break-words">
            <Link to={`/profile/${person?.username || ''}`} className="font-semibold mr-1.5 hover:underline">{person?.username || `user_${comment.author_id}`}</Link>
            <RichText>{comment.content}</RichText>
          </p>
        )}
        {!editing && (
          <div className="flex items-center gap-3 mt-1 text-xs text-on-surface-muted">
            <span>{timeAgo(comment.created_at)}{edited ? ' · edited' : ''}</span>
            <button onClick={() => onReply(comment, person)} className="font-semibold hover:text-on-surface">Reply</button>
            {own && !confirm && <button onClick={() => setEditing(true)} className="font-semibold hover:text-on-surface">Edit</button>}
            {own && !confirm && <button onClick={() => setConfirm(true)} className="font-semibold hover:text-error">Delete</button>}
            {confirm && (
              <span className="flex items-center gap-2">
                <span className="text-on-surface">Delete?</span>
                <button disabled={busy} onClick={remove} className="font-bold text-error">Yes</button>
                <button onClick={() => setConfirm(false)} className="font-semibold">No</button>
              </span>
            )}
          </div>
        )}
        {error && <p role="alert" className="text-xs text-error mt-1">{error}</p>}
      </div>
    </div>
  )
}

/**
 * Threaded comments of a post. Replies attach to the top-level comment (as on Instagram) and start with the
 * @username you replied to. Your own comments can be edited or deleted.
 */
export default function CommentsPanel({ post, onCountChange, autoFocus = false }) {
  const { user } = useAuth()
  const [comments, setComments] = useState(null)
  const [people, setPeople] = useState({})
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)        // { id, username }
  const [open, setOpen] = useState({})                // comment id -> replies visible
  const [sending, setSending] = useState(false)
  const inputRef = useRef(null)

  const lookup = useCallback(list => {
    const ids = list.flatMap(c => [c.author_id, ...(c.replies || []).map(r => r.author_id)])
    postService.lookupUsers(ids).then(found => setPeople(prev => ({ ...prev, ...found }))).catch(() => {})
  }, [])

  const load = useCallback(async (nextPage = 1) => {
    setError('')
    try {
      const batch = (await postService.fetchComments(post.id, nextPage, PAGE)).filter(alive)
      setComments(prev => (nextPage === 1 ? batch : [...(prev || []), ...batch]))
      setHasMore(batch.length === PAGE)
      setPage(nextPage)
      lookup(batch)
    } catch (err) {
      setError(err.message)
      setComments(prev => prev || [])
    }
  }, [post.id, lookup])

  useEffect(() => { load(1) }, [load])
  useEffect(() => { if (autoFocus) inputRef.current?.focus() }, [autoFocus])

  const reply = (comment, person) => {
    const top = comment.parent_comment_id || comment.id
    setReplyTo({ id: top, username: person?.username })
    setText(person?.username ? `@${person.username} ` : '')
    setOpen(prev => ({ ...prev, [top]: true }))
    inputRef.current?.focus()
  }

  const submit = async e => {
    e.preventDefault()
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    setError('')
    try {
      const created = await postService.addComment(post.id, content, replyTo?.id)
      setComments(prev => (replyTo
        ? prev.map(c => (c.id === replyTo.id ? { ...c, replies: [...(c.replies || []), created] } : c))
        : [...prev, { ...created, replies: [] }]))
      setPeople(prev => ({ ...prev, [user.authorId]: prev[user.authorId] || { username: user.username } }))
      setText('')
      setReplyTo(null)
      onCountChange?.(1)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const edited = updated => setComments(prev => prev.map(c => (c.id === updated.id ? { ...c, ...updated }
    : { ...c, replies: (c.replies || []).map(r => (r.id === updated.id ? { ...r, ...updated } : r)) })))
  const deleted = removed => {
    setComments(prev => (removed.parent_comment_id
      ? prev.map(c => (c.id === removed.parent_comment_id ? { ...c, replies: c.replies.filter(r => r.id !== removed.id) } : c))
      : prev.filter(c => c.id !== removed.id)))
    onCountChange?.(-1)
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {comments === null && !error && <p className="text-center text-xs text-on-surface-muted py-6">Loading comments…</p>}
        {error && <p role="alert" className="text-center text-xs text-error py-2">{error} <button onClick={() => load(1)} className="font-semibold underline">Retry</button></p>}
        {comments && comments.length === 0 && !error && <p className="text-center text-sm text-on-surface-muted py-6">No comments yet. Start the conversation.</p>}
        {(comments || []).map(c => {
          const replies = (c.replies || []).filter(alive)
          return (
            <div key={c.id} className="flex flex-col gap-3">
              <Comment comment={c} people={people} me={user?.authorId} onReply={reply} onEdited={edited} onDeleted={deleted} />
              {replies.length > 0 && (
                <button onClick={() => setOpen(prev => ({ ...prev, [c.id]: !prev[c.id] }))} className="pl-11 text-left text-xs font-semibold text-on-surface-muted hover:text-on-surface">
                  {open[c.id] ? 'Hide replies' : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                </button>
              )}
              {open[c.id] && replies.map(r => (
                <Comment key={r.id} comment={r} people={people} me={user?.authorId} onReply={reply} onEdited={edited} onDeleted={deleted} isReply />
              ))}
            </div>
          )
        })}
        {hasMore && <button onClick={() => load(page + 1)} className="text-xs font-semibold text-primary">Load more comments</button>}
      </div>
      <form onSubmit={submit} className="p-3 border-t border-white/10 flex flex-col gap-1.5">
        {replyTo && (
          <p className="text-xs text-on-surface-muted flex items-center gap-2">
            Replying to {replyTo.username ? `@${replyTo.username}` : 'comment'}
            <button type="button" onClick={() => { setReplyTo(null); setText('') }} className="font-semibold text-on-surface">Cancel</button>
          </p>
        )}
        <div className="flex items-center gap-2">
          <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder="Add a comment…" aria-label="Add a comment"
            className="flex-1 bg-surface-container-low border border-white/10 rounded-full px-4 py-2 text-sm text-on-surface placeholder:text-on-surface-muted/60 focus:outline-none focus:border-primary/50" />
          <button disabled={!text.trim() || sending} className="px-3 text-sm font-bold text-primary disabled:opacity-40">{sending ? '…' : 'Post'}</button>
        </div>
      </form>
    </div>
  )
}
