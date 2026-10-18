import { useEffect, useState } from 'react'
import { REPORT_REASONS, storyService } from '../../services/storyService'
import SendToSheet from '../share/SendToSheet'

function Row({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-white/5 ${danger ? 'text-error' : 'text-on-surface'}`}>
      <span className="material-symbols-outlined text-[20px]">{icon}</span>{label}
    </button>
  )
}

function AddToHighlight({ story, userId, onDone, onError }) {
  const [highlights, setHighlights] = useState(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    storyService.highlights(userId).then(setHighlights).catch(err => { onError(err.message); setHighlights([]) })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps -- load once per user; onError is only for reporting

  const run = async work => {
    setBusy(true)
    try { await work(); onDone('Added to highlight') } catch (err) { onError(err.message) } finally { setBusy(false) }
  }

  const addTo = h => run(async () => {
    const detail = await storyService.highlight(h.id)
    const ids = detail.stories.map(s => s.id)
    if (ids.includes(story.id)) throw new Error('Already in this highlight')
    await storyService.updateHighlight(h.id, { story_ids: [...ids, story.id] })
  })
  const createNew = e => {
    e.preventDefault()
    if (title.trim()) run(() => storyService.createHighlight({ title: title.trim(), story_ids: [story.id] }))
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <h4 className="text-sm font-bold text-on-surface">Add to highlight</h4>
      {highlights === null && <p className="text-sm text-on-surface-muted">Loading…</p>}
      {highlights?.map(h => (
        <button key={h.id} disabled={busy} onClick={() => addTo(h)} className="text-left px-3 py-2 rounded-lg bg-surface-container-high text-sm text-on-surface hover:bg-surface-container-highest disabled:opacity-50">
          {h.title} <span className="text-on-surface-muted">· {h.story_count}</span>
        </button>
      ))}
      <form onSubmit={createNew} className="flex gap-2">
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={30} placeholder="New highlight name"
          className="flex-1 bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/50" />
        <button disabled={busy || !title.trim()} className="px-4 rounded-lg bg-primary text-on-primary text-sm font-bold disabled:opacity-40">Create</button>
      </form>
    </div>
  )
}

function ReportForm({ story, onDone, onError }) {
  const [reason, setReason] = useState('spam')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    try {
      await storyService.report(story.id, reason, details.trim() || undefined)
      onDone('Thanks, we received your report')
    } catch (err) { onError(err.message) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="p-4 flex flex-col gap-3">
      <h4 className="text-sm font-bold text-on-surface">Report story</h4>
      <div className="flex flex-col gap-1">
        {REPORT_REASONS.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm text-on-surface py-1">
            <input type="radio" name="reason" checked={reason === value} onChange={() => setReason(value)} />{label}
          </label>
        ))}
      </div>
      <textarea value={details} onChange={e => setDetails(e.target.value)} maxLength={500} rows={2} placeholder="Add details (optional)"
        className="bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/50 resize-none" />
      <button disabled={busy} className="py-2.5 rounded-lg bg-error/90 text-black text-sm font-bold disabled:opacity-50">{busy ? 'Sending…' : 'Submit report'}</button>
    </form>
  )
}

/** Actions on the story currently shown. Owners can delete, add to a highlight or open insights; viewers can mute or report. */
export default function StoryMenuSheet({ story, isOwner, ownerId, owner, muted, onClose, onOpenInsights, onDeleted, onMuteChange, onToast }) {
  const [step, setStep] = useState('menu')
  const [busy, setBusy] = useState(false)

  const finish = message => { onToast(message); onClose() }

  const del = async () => {
    setBusy(true)
    try { await storyService.deleteStory(story.id); onDeleted(story.id) } catch (err) { onToast(err.message); setBusy(false) }
  }
  const toggleMute = async () => {
    try {
      if (muted) await storyService.removePerson('story-mutes', ownerId)
      else await storyService.addPerson('story-mutes', ownerId)
      onMuteChange(!muted)
      finish(muted ? `Unmuted ${owner?.username || 'user'}'s stories` : `Muted ${owner?.username || 'user'}'s stories`)
    } catch (err) { onToast(err.message) }
  }

  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full bg-surface-card rounded-t-2xl pb-2" onClick={e => e.stopPropagation()}>
        {step === 'menu' && (
          <>
            {story.audience !== 'close_friends' && <Row icon="send" label="Send to…" onClick={() => setStep('send')} />}
            {isOwner ? (
              <>
                <Row icon="insights" label="Insights" onClick={() => { onClose(); onOpenInsights() }} />
                <Row icon="auto_awesome" label="Add to highlight" onClick={() => setStep('highlight')} />
                <Row icon="delete" label="Delete story" danger onClick={() => setStep('delete')} />
              </>
            ) : (
              <>
                <Row icon={muted ? 'volume_up' : 'volume_off'} label={muted ? `Unmute ${owner?.username || 'user'}'s stories` : `Mute ${owner?.username || 'user'}'s stories`} onClick={toggleMute} />
                <Row icon="flag" label="Report" danger onClick={() => setStep('report')} />
              </>
            )}
            <Row icon="close" label="Cancel" onClick={onClose} />
          </>
        )}
        {step === 'delete' && (
          <div className="p-4 flex flex-col gap-3">
            <h4 className="text-sm font-bold text-on-surface">Delete this story?</h4>
            <p className="text-sm text-on-surface-muted">It will be removed for everyone, together with its replies and reactions, and taken out of any highlight.</p>
            <div className="flex gap-2">
              <button onClick={() => setStep('menu')} className="flex-1 py-2.5 rounded-lg bg-surface-container-high text-on-surface text-sm font-semibold">Cancel</button>
              <button disabled={busy} onClick={del} className="flex-1 py-2.5 rounded-lg bg-error/90 text-black text-sm font-bold disabled:opacity-50">{busy ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        )}
        {step === 'send' && (
          <SendToSheet title="Send story" message={`📸 ${owner?.username || 'A'} story: ${window.location.origin}/stories/${story.id}`}
            onClose={onClose} onSent={() => finish('Sent')} />
        )}
        {step === 'highlight' && <AddToHighlight story={story} userId={ownerId} onDone={finish} onError={onToast} />}
        {step === 'report' && <ReportForm story={story} onDone={finish} onError={onToast} />}
      </div>
    </div>
  )
}
