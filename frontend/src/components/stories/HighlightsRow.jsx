import { useCallback, useEffect, useState } from 'react'
import { storyService } from '../../services/storyService'
import StoryViewer from './StoryViewer'
import HighlightEditor from './HighlightEditor'

/** Highlights under a profile header. Anyone who may see the stories can play them; only the owner can edit. */
export default function HighlightsRow({ owner, isOwn }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(null)      // { groups, title }
  const [opening, setOpening] = useState(null)      // id while its stories load
  const [editing, setEditing] = useState(null)      // null | 'new' | highlight

  const load = useCallback(async () => {
    try {
      setItems(await storyService.highlights(owner.user_id))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [owner.user_id])

  useEffect(() => { setItems(null); load() }, [load])

  const play = async highlight => {
    setOpening(highlight.id)
    try {
      const detail = await storyService.highlight(highlight.id)
      setPlaying({ groups: [{ user: owner, stories: detail.stories }], title: highlight.title })
    } catch (err) {
      setError(err.message)
    } finally {
      setOpening(null)
    }
  }

  const saved = () => { setEditing(null); load() }

  if (items === null && !error) return <div className="h-24" aria-hidden />
  if (!isOwn && (!items || items.length === 0)) return null

  return (
    <section aria-label="Highlights" className="w-full overflow-x-auto hide-scrollbar py-2">
      <div className="flex gap-4 min-w-max">
        {(items || []).map(h => (
          <div key={h.id} className="flex flex-col items-center gap-1 w-[72px]">
            <button onClick={() => play(h)} disabled={opening === h.id} aria-label={`Play highlight ${h.title}`}
              className="p-[2px] rounded-full bg-white/25 hover:scale-105 transition-transform disabled:opacity-60">
              <span className="block w-16 h-16 rounded-full overflow-hidden border-2 border-background bg-surface-container-high">
                {h.cover_url && (h.cover_url.includes('.mp4') || h.cover_url.includes('.mov') || h.cover_url.includes('.webm')
                  ? <video src={`${storyService.mediaUrl(h.cover_url)}#t=0.1`} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                  : <img src={storyService.mediaUrl(h.cover_url)} alt="" className="w-full h-full object-cover" />)}
              </span>
            </button>
            <span className="text-xs text-on-surface truncate max-w-full">{h.title}</span>
            {isOwn && <button onClick={() => setEditing(h)} aria-label={`Edit highlight ${h.title}`} className="text-[10px] font-semibold text-primary hover:underline">Edit</button>}
          </div>
        ))}
        {isOwn && (
          <div className="flex flex-col items-center gap-1 w-[72px]">
            <button onClick={() => setEditing('new')} aria-label="New highlight"
              className="w-[68px] h-[68px] rounded-full border border-dashed border-white/30 hover:border-primary flex items-center justify-center text-on-surface-muted hover:text-primary">
              <span className="material-symbols-outlined text-2xl">add</span>
            </button>
            <span className="text-xs text-on-surface-muted">New</span>
          </div>
        )}
        {error && <span className="self-center text-xs text-on-surface-muted">{error} <button onClick={load} className="font-semibold text-primary">Retry</button></span>}
      </div>

      {playing && <StoryViewer groups={playing.groups} title={playing.title} onClose={() => setPlaying(null)} />}
      {editing && <HighlightEditor highlight={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={saved} />}
    </section>
  )
}
