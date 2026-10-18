import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { storyService } from '../../services/storyService'
import { timeAgo } from '../../utils/time'
import StoryThumb from './StoryThumb'

/**
 * Create or edit a Highlight: pick stories from your archive, order them, choose the cover, rename,
 * delete. `highlight` is the existing one (HighlightOut) when editing.
 */
const merge = (prev, batch) => [...prev, ...batch.filter(b => !prev.some(p => p.id === b.id))]

export default function HighlightEditor({ highlight, onClose, onSaved, preselect = [] }) {
  const editing = Boolean(highlight)
  const [title, setTitle] = useState(highlight?.title || '')
  const [archive, setArchive] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(preselect)    // ordered story ids
  const [cover, setCover] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const loadMore = useCallback(async nextPage => {
    setLoading(true)
    try {
      const batch = await storyService.archive(nextPage, 30)
      setArchive(prev => merge(prev, batch))
      setHasMore(batch.length === 30)
      setPage(nextPage)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadMore(1) }, [loadMore])

  useEffect(() => {
    if (!editing) return
    storyService.highlight(highlight.id).then(detail => {
      setArchive(prev => merge(prev, detail.stories))   // its stories may be older than the archive page loaded so far
      setSelected(detail.stories.map(s => s.id))
      setCover(detail.stories.find(s => s.media_url === detail.cover_url)?.id ?? detail.stories[0]?.id ?? null)
    }).catch(err => setError(err.message))
  }, [editing, highlight?.id])

  const byId = Object.fromEntries(archive.map(s => [s.id, s]))
  const toggle = id => setSelected(list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]))
  const move = (index, delta) => setSelected(list => {
    const next = [...list]
    const j = index + delta
    if (j < 0 || j >= next.length) return list
    ;[next[index], next[j]] = [next[j], next[index]]
    return next
  })

  const save = async e => {
    e.preventDefault()
    if (!title.trim() || selected.length === 0) return setError('Give the highlight a name and choose at least one story.')
    setBusy(true)
    setError('')
    const coverId = cover && selected.includes(cover) ? cover : selected[0]
    try {
      if (editing) await storyService.updateHighlight(highlight.id, { title: title.trim(), story_ids: selected, cover_story_id: coverId })
      else await storyService.createHighlight({ title: title.trim(), story_ids: selected, cover_story_id: coverId })
      onSaved()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try { await storyService.deleteHighlight(highlight.id); onSaved() } catch (err) { setError(err.message); setBusy(false) }
  }

  const ui = (
    <div className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true" aria-label={editing ? 'Edit highlight' : 'New highlight'}>
      <div className="min-h-full flex items-center justify-center p-4">
        <form onSubmit={save} className="w-full max-w-lg bg-surface-card rounded-2xl border border-white/10 shadow-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-on-surface">{editing ? 'Edit highlight' : 'New highlight'}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-on-surface-muted hover:text-on-surface"><span className="material-symbols-outlined">close</span></button>
          </div>

          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={30} placeholder="Highlight name" aria-label="Highlight name"
            className="bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/50" />

          {selected.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted mb-1">In this highlight · order and cover</p>
              <ol className="flex gap-2 overflow-x-auto pb-1">
                {selected.map((id, i) => byId[id] && (
                  <li key={id} className="shrink-0 w-20">
                    <div className={`relative h-28 rounded-lg overflow-hidden ${cover === id || (!cover && i === 0) ? 'ring-2 ring-primary' : ''}`}>
                      <StoryThumb story={byId[id]} className="w-full h-full" />
                      <button type="button" onClick={() => setCover(id)} aria-label="Use as cover" className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center">
                        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: cover === id || (!cover && i === 0) ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                      </button>
                    </div>
                    <div className="flex justify-between mt-1">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier" className="text-on-surface-muted disabled:opacity-30"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
                      <button type="button" onClick={() => toggle(id)} aria-label="Remove from highlight" className="text-error"><span className="material-symbols-outlined text-[18px]">remove_circle</span></button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === selected.length - 1} aria-label="Move later" className="text-on-surface-muted disabled:opacity-30"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted mb-1">Your stories</p>
            {archive.length === 0 && !loading && <p className="text-sm text-on-surface-muted py-4 text-center">You have no stories to add yet. Share a story first.</p>}
            <div className="grid grid-cols-4 gap-1.5 max-h-60 overflow-y-auto">
              {archive.map(story => {
                const on = selected.includes(story.id)
                return (
                  <button type="button" key={story.id} onClick={() => toggle(story.id)} aria-pressed={on} aria-label={`${on ? 'Remove' : 'Add'} story from ${timeAgo(story.created_at)}`}
                    className={`relative aspect-[9/16] rounded-md overflow-hidden ${on ? 'ring-2 ring-primary' : ''}`}>
                    <StoryThumb story={story} className="w-full h-full" />
                    {on && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary text-on-primary text-[11px] font-bold flex items-center justify-center">{selected.indexOf(story.id) + 1}</span>}
                    <span className="absolute bottom-0 inset-x-0 text-[10px] text-white bg-black/50 py-0.5">{timeAgo(story.created_at)}</span>
                  </button>
                )
              })}
            </div>
            {loading && <p className="text-xs text-on-surface-muted text-center py-2">Loading…</p>}
            {hasMore && !loading && archive.length > 0 && <button type="button" onClick={() => loadMore(page + 1)} className="w-full text-xs font-semibold text-primary py-2">Load more</button>}
          </div>

          {error && <p role="alert" className="text-xs text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">{error}</p>}

          {confirmDelete ? (
            <div className="flex items-center gap-2 text-sm text-on-surface">
              <span className="flex-1">Delete this highlight? The stories stay in your archive.</span>
              <button type="button" onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg bg-surface-container-high">Keep</button>
              <button type="button" disabled={busy} onClick={remove} className="px-3 py-1.5 rounded-lg bg-error/90 text-black font-bold disabled:opacity-50">Delete</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {editing && <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm font-semibold text-error px-2">Delete</button>}
              <div className="flex-1" />
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-on-surface-muted hover:text-on-surface">Cancel</button>
              <button disabled={busy || !title.trim() || selected.length === 0} className="px-6 py-2 rounded-lg bg-primary text-on-primary text-sm font-bold disabled:opacity-40">{busy ? 'Saving…' : 'Save'}</button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
  return createPortal(ui, document.body)
}
