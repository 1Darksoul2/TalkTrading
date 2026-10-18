import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { storyService } from '../../services/storyService'
import { copyText } from '../../utils/clipboard'

const KINDS = [
  ['close-friends', 'star', 'Add to Close Friends', 'Remove from Close Friends', 'Added to Close Friends', 'Removed from Close Friends'],
  ['story-hidden', 'visibility_off', 'Hide my story from them', 'Show my story to them again', 'They can no longer see your stories', 'They can see your stories again'],
  ['story-mutes', 'volume_off', 'Mute their stories', 'Unmute their stories', 'Their stories are muted', 'Their stories are unmuted'],
]

async function isOn(kind, userId) {
  for (let page = 1; page <= 10; page += 1) {
    const batch = await storyService.listPeople(kind, page)
    if (batch.some(i => i.user.user_id === userId)) return true
    if (batch.length < 100) return false
  }
  return false
}

/** The "..." menu on a profile: share / copy link for everyone, story controls for other people's profiles. */
export default function ProfileMenu({ profile, onClose, onToast }) {
  const own = profile.is_me
  const [state, setState] = useState(null)    // { 'close-friends': bool, ... } once loaded
  const [busy, setBusy] = useState(false)
  const url = `${window.location.origin}/profile/${profile.username}`

  useEffect(() => {
    if (own) return
    Promise.all(KINDS.map(([kind]) => isOn(kind, profile.uuid).then(on => [kind, on])))
      .then(pairs => setState(Object.fromEntries(pairs)))
      .catch(err => { onToast(err.message); onClose() })
  }, [own, profile.uuid]) // eslint-disable-line react-hooks/exhaustive-deps -- load once when the menu opens

  const copy = async () => { onToast((await copyText(url)) ? 'Profile link copied' : 'Could not copy the link'); onClose() }
  const share = async () => {
    try {
      await navigator.share({ title: `${profile.display_name || profile.username} on TalkTrading`, url })
      onClose()
    } catch (err) {
      if (err.name !== 'AbortError') onToast('Could not open the share sheet')
    }
  }
  const toggle = async ([kind, , , , added, removed]) => {
    setBusy(true)
    try {
      if (state[kind]) await storyService.removePerson(kind, profile.uuid); else await storyService.addPerson(kind, profile.uuid)
      onToast(state[kind] ? removed : added)
      onClose()
    } catch (err) {
      onToast(err.message)
      setBusy(false)
    }
  }

  const item = 'w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-on-surface hover:bg-white/5 disabled:opacity-50'
  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-sm bg-surface-card rounded-t-2xl sm:rounded-2xl pb-2 overflow-hidden" role="menu" onClick={e => e.stopPropagation()}>
        <button role="menuitem" className={item} onClick={copy}><span className="material-symbols-outlined text-[20px]">link</span>Copy profile link</button>
        {typeof navigator.share === 'function' && <button role="menuitem" className={item} onClick={share}><span className="material-symbols-outlined text-[20px]">ios_share</span>Share profile</button>}
        {own ? (
          <>
            <Link role="menuitem" className={item} to="/stories/archive" onClick={onClose}><span className="material-symbols-outlined text-[20px]">history</span>Story archive</Link>
            <Link role="menuitem" className={item} to="/settings" onClick={onClose}><span className="material-symbols-outlined text-[20px]">settings</span>Settings</Link>
          </>
        ) : (
          <>
            <div className="h-px bg-white/10 my-1" />
            {state === null && <p className="px-4 py-3 text-sm text-on-surface-muted">Loading story controls…</p>}
            {state && KINDS.map(k => (
              <button key={k[0]} role="menuitem" disabled={busy} className={item} onClick={() => toggle(k)}>
                <span className={`material-symbols-outlined text-[20px] ${k[0] === 'close-friends' && state[k[0]] ? 'text-bullish' : ''}`}>{k[1]}</span>{state[k[0]] ? k[3] : k[2]}
              </button>
            ))}
          </>
        )}
        <button role="menuitem" className={`${item} text-on-surface-muted`} onClick={onClose}><span className="material-symbols-outlined text-[20px]">close</span>Cancel</button>
      </div>
    </div>
  )
}
