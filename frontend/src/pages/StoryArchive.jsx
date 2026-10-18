import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { storyService } from '../services/storyService'
import { useAuth } from '../context/AuthContext'
import { timeAgo, timeLeft } from '../utils/time'
import StoryThumb from '../components/stories/StoryThumb'
import StoryViewer from '../components/stories/StoryViewer'
import HighlightEditor from '../components/stories/HighlightEditor'

const PAGE = 30

/** Your own stories, live and expired. Open one, delete some, or turn some into a Highlight. */
export default function StoryArchive() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stories, setStories] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState([])
  const [viewing, setViewing] = useState(null)         // story index
  const [highlighting, setHighlighting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [archiving, setArchiving] = useState(null)

  const load = useCallback(async nextPage => {
    setLoading(true)
    setError('')
    try {
      const batch = await storyService.archive(nextPage, PAGE)
      setStories(prev => (nextPage === 1 ? batch : [...prev, ...batch.filter(b => !prev.some(p => p.id === b.id))]))
      setHasMore(batch.length === PAGE)
      setPage(nextPage)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(1) }, [load])
  useEffect(() => { storyService.settings().then(s => setArchiving(s.save_to_archive)).catch(() => {}) }, [])

  const toggle = id => setSelected(list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]))
  const stopSelecting = () => { setSelecting(false); setSelected([]); setConfirmDelete(false) }

  const deleteSelected = async () => {
    setBusy(true)
    const failed = []
    for (const id of selected) {
      try { await storyService.deleteStory(id) } catch { failed.push(id) }
    }
    setBusy(false)
    setStories(list => list.filter(s => !selected.includes(s.id) || failed.includes(s.id)))
    if (failed.length) setError(`${failed.length} stories could not be deleted. Try again.`)
    stopSelecting()
  }

  const me = { user_id: user?.id, username: user?.username }

  return (
    <div className="max-w-3xl mx-auto px-4 pb-24">
      <div className="flex items-center gap-2 py-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-1 text-on-surface-muted hover:text-on-surface"><span className="material-symbols-outlined">arrow_back</span></button>
        <h1 className="text-lg font-bold text-on-surface flex-1">Story archive</h1>
        {stories.length > 0 && (selecting
          ? <button onClick={stopSelecting} className="text-sm font-semibold text-primary">Done</button>
          : <button onClick={() => setSelecting(true)} className="text-sm font-semibold text-primary">Select</button>)}
      </div>

      {archiving === false && (
        <p className="text-xs text-on-surface-muted bg-surface-card border border-white/10 rounded-lg px-3 py-2 mb-3">
          Archiving is off, so stories are deleted when they expire (unless they are in a highlight).{' '}
          <Link to="/settings/story-privacy" className="text-primary font-semibold hover:underline">Change this</Link>
        </p>
      )}
      {error && <p role="alert" className="text-sm text-error mb-3">{error} <button onClick={() => load(1)} className="font-semibold underline">Retry</button></p>}

      {!loading && stories.length === 0 && !error && (
        <div className="text-center py-16 text-on-surface-muted">
          <span className="material-symbols-outlined text-5xl">history</span>
          <p className="mt-2 text-sm">No stories yet. Stories you share show up here after they expire.</p>
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
        {stories.map((story, index) => {
          const on = selected.includes(story.id)
          return (
            <button key={story.id} onClick={() => (selecting ? toggle(story.id) : setViewing(index))}
              aria-label={`Story from ${timeAgo(story.created_at)}${story.expired ? ', expired' : ', live'}`} aria-pressed={selecting ? on : undefined}
              className={`relative aspect-[9/16] rounded-lg overflow-hidden bg-surface-container-high ${on ? 'ring-2 ring-primary' : ''}`}>
              <StoryThumb story={story} className="w-full h-full" />
              <span className="absolute bottom-0 inset-x-0 text-[10px] text-white bg-black/55 py-0.5 px-1 flex justify-between">
                <span>{timeAgo(story.created_at)}</span><span>{story.expired ? 'expired' : timeLeft(story.expires_at)}</span>
              </span>
              {story.audience === 'close_friends' && <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-bullish text-white flex items-center justify-center"><span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span></span>}
              {selecting && <span className={`absolute top-1 right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${on ? 'bg-primary border-primary text-on-primary' : 'border-white bg-black/30'}`}>{on && <span className="material-symbols-outlined text-[14px]">check</span>}</span>}
            </button>
          )
        })}
      </div>
      {loading && <p className="text-sm text-on-surface-muted text-center py-4">Loading…</p>}
      {hasMore && !loading && stories.length > 0 && <button onClick={() => load(page + 1)} className="w-full py-3 text-sm font-semibold text-primary">Load more</button>}

      {selecting && selected.length > 0 && (
        <div className="fixed bottom-16 md:bottom-4 inset-x-0 z-40 flex justify-center px-4">
          <div className="flex items-center gap-2 bg-surface-card border border-white/15 rounded-full shadow-2xl px-4 py-2">
            {confirmDelete ? (
              <>
                <span className="text-sm text-on-surface">Delete {selected.length}? This can&apos;t be undone.</span>
                <button onClick={() => setConfirmDelete(false)} className="text-sm px-2 text-on-surface-muted">Keep</button>
                <button disabled={busy} onClick={deleteSelected} className="text-sm font-bold text-error px-2 disabled:opacity-50">{busy ? 'Deleting…' : 'Delete'}</button>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-on-surface">{selected.length} selected</span>
                <button onClick={() => setHighlighting(true)} className="text-sm font-bold text-primary px-2">Add to highlight</button>
                <button onClick={() => setConfirmDelete(true)} className="text-sm font-bold text-error px-2">Delete</button>
              </>
            )}
          </div>
        </div>
      )}

      {viewing !== null && (
        <StoryViewer groups={[{ user: me, stories }]} startStory={viewing} onClose={() => { setViewing(null); load(1) }} />
      )}
      {highlighting && (
        <HighlightEditor preselect={selected} onClose={() => setHighlighting(false)} onSaved={() => { setHighlighting(false); stopSelecting() }} />
      )}
    </div>
  )
}
