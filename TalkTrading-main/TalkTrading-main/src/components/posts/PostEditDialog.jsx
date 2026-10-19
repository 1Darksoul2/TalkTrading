import { useState } from 'react'
import { createPortal } from 'react-dom'
import { postService } from '../../services/postService'

const VISIBILITY = [['public', 'Public'], ['followers', 'Followers only'], ['private', 'Only me']]

/** Edit your post's caption and who can see it. Returns only the changed fields to `onSaved`. */
export default function PostEditDialog({ post, onClose, onSaved }) {
  const [caption, setCaption] = useState(post.content || '')
  const [visibility, setVisibility] = useState(post.visibility || 'public')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async e => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const updated = await postService.updatePost(post.id, { caption, visibility })
      onSaved({ content: updated.content, caption: updated.caption, visibility: updated.visibility })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Edit post">
      <form onSubmit={save} className="w-full max-w-md bg-surface-card rounded-2xl border border-white/10 p-5 flex flex-col gap-3">
        <h2 className="text-base font-bold text-on-surface">Edit post</h2>
        <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={5} maxLength={5000} aria-label="Caption"
          className="bg-surface-container-low border border-white/10 rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:border-primary/50 resize-none" />
        <p className="text-[11px] text-on-surface-muted text-right">{caption.length}/5000</p>
        <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-muted" htmlFor="post-visibility">Who can see this post</label>
        <select id="post-visibility" value={visibility} onChange={e => setVisibility(e.target.value)}
          className="bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface">
          {VISIBILITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {error && <p role="alert" className="text-xs text-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-on-surface-muted">Cancel</button>
          <button disabled={busy} className="px-5 py-2 rounded-lg bg-primary text-on-primary text-sm font-bold disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
