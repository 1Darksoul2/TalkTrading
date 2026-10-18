import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { REACTIONS, storyService } from '../../services/storyService'
import { postService } from '../../services/postService'
import { useAuth } from '../../context/AuthContext'
import { useE2E } from '../../context/E2EContext'
import { usePreferences } from '../../context/PreferencesContext'
import { timeAgo } from '../../utils/time'
import StoryOverlays from './StoryOverlays'
import StoryInsights from './StoryInsights'
import StoryMenuSheet from './StoryMenuSheet'

const IMAGE_MS = 5000   // how long a photo stays on screen
const HOLD_MS = 200     // press longer than this = hold-to-pause instead of a tap

/**
 * Full-screen story player.
 *
 * groups: [{ user, muted?, loader?: () => Promise<Story[]>, stories?: Story[] }]
 *   - tray: one group per person, stories are fetched when that person comes up
 *   - highlight / archive: a single group (stories already loaded, or a loader), opened at `startStory`
 * Moves through a person's stories, then on to the next person. Hold to pause, tap the left edge for
 * the previous story and anywhere else for the next one (also arrow keys, space, Escape).
 */
export default function StoryViewer({ groups, startIndex = 0, startStory = 0, title, onClose }) {
  const { user: me } = useAuth()
  const { isReady: chatReady, startConversation, encryptAndSend } = useE2E()
  const { autoplayVideos, reduceMotion } = usePreferences()

  const [groupIdx, setGroupIdx] = useState(startIndex)
  const [storyIdx, setStoryIdx] = useState(0)
  const [loaded, setLoaded] = useState({})            // groupIdx -> { status, stories, error }
  const [progress, setProgress] = useState(0)
  const [mediaReady, setMediaReady] = useState(false)
  const [hold, setHold] = useState(false)
  const [sheet, setSheet] = useState(null)             // null | 'menu' | 'insights'
  const [replyFocus, setReplyFocus] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState('')
  const [videoMuted, setVideoMuted] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)      // video could not autoplay (setting off or browser policy)
  const [mutedOwners, setMutedOwners] = useState(() => new Set(groups.filter(g => g.muted).map(g => g.user.user_id)))
  const [hidden, setHidden] = useState(document.hidden)

  const loadedRef = useRef({})
  const elapsedRef = useRef(0)
  const seenRef = useRef(new Set())
  const startedRef = useRef(-1)
  const holdTimer = useRef(null)
  const heldRef = useRef(false)
  const videoRef = useRef(null)
  const nextRef = useRef(() => {})
  const toastTimer = useRef(null)

  const group = groups[groupIdx]
  const current = loaded[groupIdx]
  const stories = current?.stories || []
  const story = stories[storyIdx]
  const isVideo = story?.media_type === 'video'
  const isOwner = Boolean(story && me && story.user_id === me.id)
  const paused = hold || sheet !== null || replyFocus || hidden || needsTap

  const say = useCallback(message => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3000)
  }, [])

  // ── Loading each person's stories (and the next person's, ahead of time) ──
  const ensure = useCallback(async index => {
    if (index < 0 || index >= groups.length || loadedRef.current[index]) return
    const g = groups[index]
    loadedRef.current[index] = { status: 'loading', stories: [] }
    setLoaded(prev => ({ ...prev, [index]: loadedRef.current[index] }))
    try {
      const list = g.stories ?? await g.loader()
      loadedRef.current[index] = { status: 'ready', stories: list }
    } catch (err) {
      loadedRef.current[index] = { status: 'error', stories: [], error: err.message }
    }
    setLoaded(prev => ({ ...prev, [index]: loadedRef.current[index] }))
  }, [groups])

  useEffect(() => { ensure(groupIdx); ensure(groupIdx + 1) }, [groupIdx, ensure])

  const retry = () => {
    delete loadedRef.current[groupIdx]
    ensure(groupIdx)
  }

  // ── Moving around ─────────────────────────────────────────────────────────
  const close = useCallback(() => onClose?.(), [onClose])

  const goToGroup = useCallback(index => {
    if (index < 0) return
    if (index >= groups.length) return close()
    startedRef.current = -1
    setStoryIdx(0)
    setGroupIdx(index)
  }, [groups.length, close])

  const next = useCallback(() => {
    if (storyIdx < stories.length - 1) setStoryIdx(storyIdx + 1)
    else goToGroup(groupIdx + 1)
  }, [storyIdx, stories.length, groupIdx, goToGroup])
  nextRef.current = next

  const prev = useCallback(() => {
    if (storyIdx > 0) setStoryIdx(storyIdx - 1)
    else if (groupIdx > 0) goToGroup(groupIdx - 1)
    else { elapsedRef.current = 0; setProgress(0); if (videoRef.current) videoRef.current.currentTime = 0 }
  }, [storyIdx, groupIdx, goToGroup])

  // When a person's stories arrive: skip people with nothing left, otherwise start at the first unseen story.
  useEffect(() => {
    if (current?.status !== 'ready' || startedRef.current === groupIdx) return
    startedRef.current = groupIdx
    if (current.stories.length === 0) { goToGroup(groupIdx + 1); return }
    // Pre-loaded lists (archive, highlights) open where asked; live tray stories open at the first unseen one.
    const firstUnseen = group.stories ? Math.min(startStory, current.stories.length - 1) : current.stories.findIndex(s => !s.seen)
    setStoryIdx(firstUnseen === -1 ? 0 : firstUnseen)
  }, [current, groupIdx, group, goToGroup, startStory])

  // Reset the clock whenever the story changes; count the view once.
  useEffect(() => {
    if (!story) return
    elapsedRef.current = 0
    setProgress(0)
    setMediaReady(false)
    setNeedsTap(isVideo && !autoplayVideos)
    if (!isOwner && !seenRef.current.has(story.id)) {
      seenRef.current.add(story.id)
      storyService.recordView(story.id).catch(() => {})
    }
  }, [story?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Photos advance on a timer that stops while paused or still loading.
  useEffect(() => {
    if (!story || isVideo || paused || !mediaReady) return undefined
    let raf
    let last = performance.now()
    const tick = now => {
      elapsedRef.current += now - last
      last = now
      setProgress(Math.min(elapsedRef.current / IMAGE_MS, 1))
      if (elapsedRef.current >= IMAGE_MS) nextRef.current()
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [story?.id, isVideo, paused, mediaReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // Videos follow their own playback.
  useEffect(() => {
    const el = videoRef.current
    if (!el || !isVideo) return
    if (paused || !mediaReady) { el.pause(); return }
    el.play().catch(() => {
      if (!el.muted) { setVideoMuted(true); el.muted = true; el.play().catch(() => setNeedsTap(true)) } else setNeedsTap(true)
    })
  }, [paused, mediaReady, isVideo, story?.id])

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    const onKey = e => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') (sheet ? setSheet(null) : close())
      else if (e.key === ' ') { e.preventDefault(); setHold(h => !h) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, close, sheet])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(holdTimer.current) }, [])

  // ── Touch / mouse: hold to pause, tap to navigate ─────────────────────────
  const pressDown = () => {
    heldRef.current = false
    holdTimer.current = setTimeout(() => { heldRef.current = true; setHold(true) }, HOLD_MS)
  }
  const pressUp = e => {
    clearTimeout(holdTimer.current)
    if (heldRef.current) { heldRef.current = false; setHold(false); return }
    const box = e.currentTarget.getBoundingClientRect()
    if ((e.clientX - box.left) / box.width < 0.3) prev(); else next()
  }
  const pressCancel = () => {
    clearTimeout(holdTimer.current)
    if (heldRef.current) { heldRef.current = false; setHold(false) }
  }

  // ── Changes to the story in view ──────────────────────────────────────────
  const patchStory = (id, patch) => {
    const list = loadedRef.current[groupIdx].stories.map(s => (s.id === id ? { ...s, ...patch } : s))
    loadedRef.current[groupIdx] = { ...loadedRef.current[groupIdx], stories: list }
    setLoaded(prev => ({ ...prev, [groupIdx]: loadedRef.current[groupIdx] }))
  }

  const react = async emoji => {
    const before = story.my_reaction
    const after = before === emoji ? null : emoji
    patchStory(story.id, { my_reaction: after })
    try {
      if (after) await storyService.react(story.id, after); else await storyService.unreact(story.id)
      if (after) say(`Reacted ${after}`)
    } catch (err) {
      patchStory(story.id, { my_reaction: before })
      say(err.message)
    }
  }

  // The reply is saved with the story service (so the owner sees it in Insights and gets a notification) and
  // also delivered as an end-to-end encrypted message through the existing chat client.
  const deliverAsMessage = async text => {
    if (!chatReady) return false
    try {
      const conversation = await startConversation([story.user_id])
      await encryptAndSend(conversation.conversation_id, [story.user_id], `↩️ Replied to your story: ${text}`)
      return true
    } catch {
      return false
    }
  }

  const sendReply = async e => {
    e.preventDefault()
    const text = reply.trim()
    if (!text || sending) return
    setSending(true)
    try {
      await storyService.reply(story.id, text)
    } catch (err) {
      say(err.message)
      setSending(false)
      return
    }
    const delivered = await deliverAsMessage(text)
    setReply('')
    say(delivered ? 'Reply sent' : 'Reply saved (it could not be delivered as a chat message)')
    setSending(false)
  }

  const vote = async option => {
    try {
      patchStory(story.id, { poll: await storyService.vote(story.id, option) })
    } catch (err) {
      say(err.message)
    }
  }

  // Sticker answers return the sticker's new state for this viewer (e.g. the slider average, the quiz result).
  const answerSticker = async (send, message) => {
    try {
      const state = await send()
      patchStory(story.id, { sticker: { ...story.sticker, ...state } })
      if (message) say(message)
    } catch (err) {
      say(err.message)
    }
  }

  const answerQuestion = async text => {
    try {
      await storyService.answerQuestion(story.id, text)
      patchStory(story.id, { sticker: { ...story.sticker, my_answers: (story.sticker?.my_answers || 0) + 1 } })
      say('Answer sent')
    } catch (err) {
      say(err.message)
      throw err
    }
  }

  const afterDelete = id => {
    setSheet(null)
    const remaining = loadedRef.current[groupIdx].stories.filter(s => s.id !== id)
    loadedRef.current[groupIdx] = { ...loadedRef.current[groupIdx], stories: remaining }
    setLoaded(prev => ({ ...prev, [groupIdx]: loadedRef.current[groupIdx] }))
    if (remaining.length === 0) { startedRef.current = -1; goToGroup(groupIdx + 1) } else setStoryIdx(Math.min(storyIdx, remaining.length - 1))
    say('Story deleted')
  }

  const ownerSummary = group?.user
  const muted = mutedOwners.has(group?.user.user_id)
  const showFooterTools = story && !isOwner && !story.expired

  // ── Rendering ─────────────────────────────────────────────────────────────
  const frame = (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Story viewer">
      {groupIdx > 0 && (
        <button onClick={() => goToGroup(groupIdx - 1)} aria-label="Previous person" className="hidden md:flex absolute left-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center">
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
      )}
      {groupIdx < groups.length - 1 && (
        <button onClick={() => goToGroup(groupIdx + 1)} aria-label="Next person" className="hidden md:flex absolute right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center">
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      )}

      <div className="relative h-full w-full md:h-[min(100dvh,860px)] md:w-auto md:aspect-[9/16] max-w-[480px] bg-neutral-900 overflow-hidden md:rounded-2xl select-none">
        {(!current || current.status === 'loading') && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm"><span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>Loading story…</div>
        )}
        {current?.status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white p-6 text-center">
            <p className="text-sm">{current.error}</p>
            <div className="flex gap-2">
              <button onClick={retry} className="px-4 py-2 rounded-lg bg-white/15 text-sm font-semibold">Try again</button>
              <button onClick={close} className="px-4 py-2 rounded-lg bg-white/15 text-sm font-semibold">Close</button>
            </div>
          </div>
        )}

        {story && (
          <>
            {isVideo ? (
              <video
                key={story.id} ref={videoRef} src={storyService.mediaUrl(story.media_url)} playsInline muted={videoMuted}
                preload="auto" className="absolute inset-0 w-full h-full object-contain bg-black"
                onLoadedData={() => setMediaReady(true)}
                onTimeUpdate={e => e.currentTarget.duration && setProgress(e.currentTarget.currentTime / e.currentTarget.duration)}
                onEnded={next}
                onError={() => { setMediaReady(true); say('This video could not be played') }}
              />
            ) : (
              <img
                key={story.id} src={storyService.mediaUrl(story.media_url)} alt={story.caption || 'Story'}
                className="absolute inset-0 w-full h-full object-contain bg-black" draggable={false}
                onLoad={() => setMediaReady(true)}
                onError={() => { setMediaReady(true); say('This image could not be loaded') }}
              />
            )}
            {!mediaReady && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="material-symbols-outlined animate-spin text-white/70">progress_activity</span></div>}

            {/* tap / hold surface (under everything interactive) */}
            <div className="absolute inset-0 z-10" onPointerDown={pressDown} onPointerUp={pressUp} onPointerLeave={pressCancel} onPointerCancel={pressCancel} />

            <div className="absolute inset-0 z-20 pointer-events-none">
              <StoryOverlays overlays={story.overlays} story={story} interactive owner={isOwner} actions={{
                onLinkClick: s => storyService.linkClick(s.id).catch(() => {}),
                onVote: vote,
                onQuestion: answerQuestion,
                onSlider: value => answerSticker(() => storyService.answerSlider(story.id, value)),
                onQuiz: option => answerSticker(() => storyService.answerQuiz(story.id, option)),
                onRemind: on => answerSticker(() => storyService.setReminder(story.id, on), on ? "We'll remind you when it ends" : 'Reminder removed'),
                onFocusChange: setReplyFocus,
              }} />
            </div>

            {needsTap && isVideo && (
              <button onClick={() => { setNeedsTap(false); setHold(false) }} aria-label="Play video"
                className="absolute z-20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/60 text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl">play_arrow</span>
              </button>
            )}

            {story.caption && (
              <p className="absolute z-20 bottom-28 inset-x-0 px-5 text-center text-white text-base font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] pointer-events-none break-words">{story.caption}</p>
            )}
          </>
        )}

        {/* header */}
        <div className="absolute z-30 top-0 inset-x-0 p-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
          <div className="flex gap-1 mb-3">
            {stories.map((s, i) => (
              <div key={s.id} className="h-[3px] flex-1 rounded-full bg-white/30 overflow-hidden">
                <div className="h-full bg-white" style={{ width: `${i < storyIdx ? 100 : i === storyIdx ? progress * 100 : 0}%`, transition: reduceMotion ? 'none' : undefined }} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <Link to={`/profile/${ownerSummary?.username || ''}`} onClick={close} className="flex items-center gap-2 min-w-0">
              <img src={postService.avatarFor(ownerSummary)} alt="" className="w-8 h-8 rounded-full object-cover border border-white/30" />
              <span className="text-sm font-semibold text-white truncate">{ownerSummary?.username || 'User'}</span>
            </Link>
            {story && <span className="text-xs text-white/70">{story.expired ? 'Highlight' : timeAgo(story.created_at)}</span>}
            {story?.audience === 'close_friends' && (
              <span className="flex items-center gap-0.5 text-[11px] font-bold text-white bg-bullish/90 rounded-full px-2 py-0.5"><span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>Close Friends</span>
            )}
            {title && <span className="text-xs text-white/70 truncate">· {title}</span>}
            <div className="flex-1" />
            {isVideo && (
              <button onClick={() => setVideoMuted(m => !m)} aria-label={videoMuted ? 'Unmute' : 'Mute'} className="p-1 text-white">
                <span className="material-symbols-outlined text-[22px]">{videoMuted ? 'volume_off' : 'volume_up'}</span>
              </button>
            )}
            {story && (
              <button onClick={() => setSheet('menu')} aria-label="More options" className="p-1 text-white"><span className="material-symbols-outlined text-[22px]">more_horiz</span></button>
            )}
            <button onClick={close} aria-label="Close story viewer" className="p-1 text-white"><span className="material-symbols-outlined text-[24px]">close</span></button>
          </div>
        </div>

        {/* footer */}
        {story && (
          <div className="absolute z-30 bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
            {isOwner && (
              <button onClick={() => setSheet('insights')} className="flex items-center gap-2 text-white text-sm font-semibold">
                <span className="material-symbols-outlined text-[20px]">visibility</span>{story.view_count ?? 0} {story.view_count === 1 ? 'viewer' : 'viewers'}
                <span className="material-symbols-outlined text-[18px]">expand_less</span>
              </button>
            )}
            {showFooterTools && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-1 overflow-x-auto hide-scrollbar" aria-label="Reactions">
                  {REACTIONS.map(emoji => (
                    <button key={emoji} onClick={() => react(emoji)} aria-label={`React ${emoji}`} aria-pressed={story.my_reaction === emoji}
                      className={`w-9 h-9 shrink-0 rounded-full text-lg flex items-center justify-center ${story.my_reaction === emoji ? 'bg-white/30 ring-2 ring-white' : 'bg-white/10 hover:bg-white/20'}`}>
                      {emoji}
                    </button>
                  ))}
                </div>
                {story.can_reply ? (
                  <form onSubmit={sendReply} className="flex gap-2">
                    <input
                      value={reply} onChange={e => setReply(e.target.value)} maxLength={1000}
                      onFocus={() => setReplyFocus(true)} onBlur={() => setReplyFocus(false)}
                      placeholder={`Reply to ${ownerSummary?.username || 'story'}…`} aria-label="Reply to story"
                      className="flex-1 bg-black/40 border border-white/30 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-white"
                    />
                    <button disabled={!reply.trim() || sending} aria-label="Send reply" className="px-4 rounded-full bg-white text-black text-sm font-bold disabled:opacity-40">
                      {sending ? '…' : 'Send'}
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-white/70 text-center">Replies are turned off for this story</p>
                )}
              </div>
            )}
          </div>
        )}

        {toast && <div role="status" className="absolute z-50 top-20 left-1/2 -translate-x-1/2 max-w-[90%] px-4 py-2 rounded-full bg-black/80 text-white text-xs font-medium text-center">{toast}</div>}

        {sheet === 'insights' && story && <StoryInsights story={story} onClose={() => setSheet(null)} />}
        {sheet === 'menu' && story && (
          <StoryMenuSheet
            story={story} isOwner={isOwner} ownerId={story.user_id} owner={ownerSummary} muted={muted}
            onClose={() => setSheet(null)} onOpenInsights={() => setSheet('insights')} onDeleted={afterDelete}
            onMuteChange={isMuted => setMutedOwners(prevSet => { const s = new Set(prevSet); isMuted ? s.add(story.user_id) : s.delete(story.user_id); return s })}
            onToast={say}
          />
        )}
      </div>
    </div>
  )

  return createPortal(frame, document.body)
}
