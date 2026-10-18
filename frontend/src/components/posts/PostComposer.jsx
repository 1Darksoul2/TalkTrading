import { useEffect, useState } from 'react'
import Card from '../ui/Card'
import { postService } from '../../services/postService'
import { useAuth } from '../../context/AuthContext'

const MAX_FILES = 10
const MAX_BYTES = 50 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
const TICKERS = ['NVDA', 'TSLA', 'SPY', 'BTC', 'AAPL']

/**
 * Create a post: caption, up to 10 photos/videos (a carousel), and who can see it. Publishing is all or nothing,
 * so a failed upload never leaves a half-made post behind.
 */
export default function PostComposer({ onPublished }) {
  const { user } = useAuth()
  const [caption, setCaption] = useState('')
  const [ticker, setTicker] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [files, setFiles] = useState([])          // [{ file, url }]
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [avatar, setAvatar] = useState('')

  useEffect(() => { postService.getMyProfile().then(p => setAvatar(postService.avatarFor(p))).catch(() => {}) }, [user?.id])
  useEffect(() => () => files.forEach(f => URL.revokeObjectURL(f.url)), []) // eslint-disable-line react-hooks/exhaustive-deps -- revoke on unmount only

  const add = picked => {
    const list = [...picked]
    const bad = list.find(f => !TYPES.includes(f.type) || f.size > MAX_BYTES)
    if (bad) return setError(`${bad.name}: use JPEG, PNG, GIF, WebP, MP4, MOV or WebM up to 50 MB.`)
    if (files.length + list.length > MAX_FILES) return setError(`A post can have up to ${MAX_FILES} photos or videos.`)
    setError('')
    setFiles(prev => [...prev, ...list.map(file => ({ file, url: URL.createObjectURL(file) }))])
  }
  const removeAt = i => setFiles(prev => { URL.revokeObjectURL(prev[i].url); return prev.filter((_, j) => j !== i) })
  const move = (i, d) => setFiles(prev => {
    const next = [...prev]
    const j = i + d
    if (j < 0 || j >= next.length) return prev
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })

  const publish = async e => {
    e.preventDefault()
    if (busy || (!caption.trim() && files.length === 0)) return
    setBusy(true)
    setError('')
    try {
      const post = await postService.createPostWithMedia({ caption, visibility, ticker }, files.map(f => f.file),
        (doneCount, total) => setProgress(total ? `Uploading ${Math.min(doneCount + 1, total)} of ${total}…` : 'Publishing…'))
      files.forEach(f => URL.revokeObjectURL(f.url))
      setFiles([])
      setCaption('')
      setTicker('')
      setDone('Posted')
      setTimeout(() => setDone(''), 3000)
      onPublished?.(post)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <Card className="p-4 bg-surface-card/90 border border-white/10">
      <form onSubmit={publish} className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <img src={avatar || postService.avatarFor({ username: user?.username })} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0" />
          <textarea rows={2} value={caption} onChange={e => setCaption(e.target.value)} maxLength={5000} aria-label="Write a caption"
            placeholder="Share a market thesis, chart breakdown or trade idea… (use $NVDA, #options, @people)"
            className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-muted/60 resize-none focus:outline-none" />
        </div>

        {files.length > 0 && (
          <ol className="flex gap-2 overflow-x-auto pb-1" aria-label="Selected photos and videos">
            {files.map((f, i) => (
              <li key={f.url} className="relative shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-black border border-white/10">
                {f.file.type.startsWith('video/') ? <video src={f.url} muted className="w-full h-full object-cover" /> : <img src={f.url} alt="" className="w-full h-full object-cover" />}
                <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/70 text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                <button type="button" onClick={() => removeAt(i)} disabled={busy} aria-label={`Remove item ${i + 1}`} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"><span className="material-symbols-outlined text-[14px]">close</span></button>
                <div className="absolute bottom-1 inset-x-1 flex justify-between">
                  <button type="button" onClick={() => move(i, -1)} disabled={busy || i === 0} aria-label="Move earlier" className="w-5 h-5 rounded-full bg-black/70 text-white disabled:opacity-30 flex items-center justify-center"><span className="material-symbols-outlined text-[14px]">chevron_left</span></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={busy || i === files.length - 1} aria-label="Move later" className="w-5 h-5 rounded-full bg-black/70 text-white disabled:opacity-30 flex items-center justify-center"><span className="material-symbols-outlined text-[14px]">chevron_right</span></button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06] overflow-x-auto hide-scrollbar">
          <span className="text-[11px] font-mono text-on-surface-muted uppercase shrink-0">Add ticker:</span>
          {TICKERS.map(sym => (
            <button key={sym} type="button" aria-pressed={ticker === sym}
              onClick={() => { if (!caption.includes(`$${sym}`)) setCaption(prev => (prev ? `${prev} $${sym}` : `$${sym} `)); setTicker(sym) }}
              className={`px-2.5 py-0.5 rounded-full text-xs font-mono border ${ticker === sym ? 'bg-primary text-black border-primary font-bold' : 'bg-white/5 border-white/10 text-on-surface hover:border-primary/40'}`}>
              ${sym}
            </button>
          ))}
        </div>

        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-primary/15 border border-white/10 text-xs text-on-surface cursor-pointer">
              <span className="material-symbols-outlined text-[16px] text-primary">add_photo_alternate</span>
              <span className="font-medium">Photo / video{files.length ? ` (${files.length}/${MAX_FILES})` : ''}</span>
              <input type="file" accept={TYPES.join(',')} multiple className="sr-only" disabled={busy} onChange={e => { add(e.target.files || []); e.target.value = '' }} />
            </label>
            <select value={visibility} onChange={e => setVisibility(e.target.value)} disabled={busy} aria-label="Who can see this post"
              className="bg-surface-container-high border border-white/10 rounded-lg px-2 py-1.5 text-xs text-on-surface focus:outline-none">
              <option value="public">Public</option>
              <option value="followers">Followers only</option>
              <option value="private">Only me</option>
            </select>
          </div>
          <button type="submit" disabled={busy || (!caption.trim() && files.length === 0)}
            className="px-5 py-2 rounded-xl bg-primary text-black text-xs font-bold hover:bg-primary/90 disabled:opacity-40 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">send</span>{busy ? (progress || 'Publishing…') : 'Share'}
          </button>
        </div>
        {error && <p role="alert" className="text-xs text-error">{error}</p>}
        {done && <p role="status" className="text-xs text-bullish flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">check_circle</span>{done}</p>}
      </form>
    </Card>
  )
}
