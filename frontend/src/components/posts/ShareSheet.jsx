import { useState } from 'react'
import { createPortal } from 'react-dom'
import { postService } from '../../services/postService'
import { copyText } from '../../utils/clipboard'
import SendToSheet from '../share/SendToSheet'
import StoryComposer from '../stories/StoryComposer'

/**
 * Share a post: send it to someone in an encrypted message, add it to your story, copy the link or use the
 * device's share sheet. Every share is counted by the Post Service.
 */
export default function ShareSheet({ post, onClose, onShared }) {
  const [step, setStep] = useState('menu')     // menu | send | story
  const [note, setNote] = useState('')
  const url = `${window.location.origin}/p/${post.id}`

  const count = async () => {
    try { onShared?.((await postService.recordShare(post.id))?.share_count) } catch { /* the share itself still happened */ }
  }
  const copy = async () => {
    if (await copyText(url)) { setNote('Link copied'); count() } else setNote('Could not copy the link')
  }
  const native = async () => {
    try { await navigator.share({ title: `Post by ${post.username}`, text: post.content?.slice(0, 100), url }); count(); onClose() } catch (err) {
      if (err.name !== 'AbortError') setNote('Could not open the share sheet')
    }
  }

  if (step === 'send') {
    return <SendToSheet title="Send post" message={`📈 ${post.username}'s post: ${url}`} onClose={onClose} onSent={() => { count(); onClose() }} />
  }
  if (step === 'story') {
    return <StoryComposer sharedPost={post} onClose={onClose} onPublished={() => { count(); onClose() }} />
  }

  const row = 'w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-on-surface hover:bg-white/5'
  return createPortal(
    <div className="fixed inset-0 z-[85] bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div role="menu" aria-label="Share post" className="w-full sm:max-w-sm bg-surface-card rounded-t-2xl sm:rounded-2xl overflow-hidden pb-2" onClick={e => e.stopPropagation()}>
        <p className="px-4 pt-4 pb-2 text-sm font-bold text-on-surface">Share</p>
        <button role="menuitem" className={row} onClick={() => setStep('send')}><span className="material-symbols-outlined text-[20px]">send</span>Send in a message</button>
        <button role="menuitem" className={row} onClick={() => setStep('story')}><span className="material-symbols-outlined text-[20px]">add_circle</span>Add post to your story</button>
        <button role="menuitem" className={row} onClick={copy}><span className="material-symbols-outlined text-[20px]">link</span>Copy link</button>
        {typeof navigator.share === 'function' && <button role="menuitem" className={row} onClick={native}><span className="material-symbols-outlined text-[20px]">ios_share</span>Share to…</button>}
        {note && <p role="status" className="px-4 py-2 text-xs text-bullish">{note}</p>}
        <button role="menuitem" className={`${row} text-on-surface-muted`} onClick={onClose}><span className="material-symbols-outlined text-[20px]">close</span>Cancel</button>
      </div>
    </div>,
    document.body,
  )
}
