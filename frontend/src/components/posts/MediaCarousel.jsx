import { useRef, useState } from 'react'
import { usePreferences } from '../../context/PreferencesContext'

const DOUBLE_TAP_MS = 300
const SWIPE_PX = 40

/**
 * A post's photos and videos. One item shows on its own; several become a swipeable carousel with dots.
 * Double-tap (or double-click) calls `onDoubleTap` - the feed uses it to like the post, like Instagram.
 */
export default function MediaCarousel({ items, alt = '', onDoubleTap, aspect = 'aspect-square' }) {
  const { autoplayVideos } = usePreferences()
  const [index, setIndex] = useState(0)
  const [heart, setHeart] = useState(false)
  const lastTap = useRef(0)
  const startX = useRef(null)

  if (!items?.length) return null
  const count = items.length
  const go = i => setIndex(Math.max(0, Math.min(count - 1, i)))

  const tap = () => {
    const now = Date.now()
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      onDoubleTap?.()
      setHeart(true)
      setTimeout(() => setHeart(false), 700)
      lastTap.current = 0
    } else {
      lastTap.current = now
    }
  }

  return (
    <div
      className={`relative w-full ${aspect} bg-black overflow-hidden select-none`}
      onPointerDown={e => { startX.current = e.clientX }}
      onPointerUp={e => {
        const dx = startX.current === null ? 0 : e.clientX - startX.current
        startX.current = null
        if (Math.abs(dx) > SWIPE_PX && count > 1) go(index + (dx < 0 ? 1 : -1))
        else tap()
      }}
      aria-roledescription={count > 1 ? 'carousel' : undefined}
    >
      <div className="flex h-full transition-transform duration-300" style={{ transform: `translateX(-${index * 100}%)` }}>
        {items.map((m, i) => (
          <div key={m.id ?? i} className="w-full h-full shrink-0" aria-hidden={i !== index}>
            {m.media_type === 'video'
              ? <video src={m.resolvedUrl} className="w-full h-full object-contain" controls playsInline muted autoPlay={autoplayVideos && i === index} loop preload="metadata" />
              : <img src={m.resolvedUrl} alt={count > 1 ? `${alt} (${i + 1} of ${count})` : alt} loading="lazy" draggable={false} className="w-full h-full object-cover" />}
          </div>
        ))}
      </div>

      {heart && (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
          <span className="material-symbols-outlined text-white text-8xl drop-shadow-2xl animate-ping" style={{ fontVariationSettings: "'FILL' 1", animationIterationCount: 1 }}>favorite</span>
        </span>
      )}

      {count > 1 && (
        <>
          {index > 0 && (
            <button onClick={e => { e.stopPropagation(); go(index - 1) }} onPointerUp={e => e.stopPropagation()} aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 text-black flex items-center justify-center shadow">
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
          )}
          {index < count - 1 && (
            <button onClick={e => { e.stopPropagation(); go(index + 1) }} onPointerUp={e => e.stopPropagation()} aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 text-black flex items-center justify-center shadow">
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          )}
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-semibold">{index + 1}/{count}</span>
          <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1" aria-hidden>
            {items.map((_, i) => <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`} />)}
          </div>
        </>
      )}
    </div>
  )
}
