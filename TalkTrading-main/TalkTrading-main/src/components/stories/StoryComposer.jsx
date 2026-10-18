import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { storyService } from '../../services/storyService'
import { OverlayVisual } from './StoryOverlays'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const MAX_IMAGE = 10 * 1024 * 1024
const MAX_VIDEO = 50 * 1024 * 1024
const MAX_VIDEO_SECONDS = 60
const MAX_OVERLAYS = 10
const COLORS = ['#ffffff', '#000000', '#f2ca50', '#22c55e', '#ef4444', '#3b82f6']
const TOOLS = [
  ['text', 'title', 'Text'], ['mention', 'alternate_email', 'Mention'], ['hashtag', 'tag', 'Hashtag'], ['link', 'link', 'Link'],
  ['poll', 'poll', 'Poll'], ['question', 'help', 'Question'], ['slider', 'tune', 'Slider'], ['quiz', 'quiz', 'Quiz'], ['countdown', 'timer', 'Countdown'],
]
const INTERACTIVE = ['poll', 'question', 'slider', 'quiz', 'countdown']
// Instagram-style looks. They are applied to the uploaded photo itself (not just the preview).
const FILTERS = {
  Normal: 'none',
  Clarendon: 'contrast(1.2) saturate(1.35)',
  Gingham: 'brightness(1.05) hue-rotate(-10deg) saturate(0.9)',
  Moon: 'grayscale(1) contrast(1.1) brightness(1.1)',
  Lark: 'contrast(0.9) brightness(1.1) saturate(1.1)',
  Reyes: 'sepia(0.22) brightness(1.1) contrast(0.85) saturate(0.75)',
  Juno: 'saturate(1.4) contrast(1.15)',
}
const BRUSH_COLORS = ['#ffffff', '#000000', '#f2ca50', '#22c55e', '#ef4444', '#3b82f6']

function validateFile(file) {
  const isImage = IMAGE_TYPES.includes(file.type)
  const isVideo = VIDEO_TYPES.includes(file.type)
  if (!isImage && !isVideo) return 'Choose a JPEG, PNG, WebP or GIF image, or an MP4, WebM or MOV video.'
  if (isImage && file.size > MAX_IMAGE) return 'Images can be up to 10 MB.'
  if (isVideo && file.size > MAX_VIDEO) return 'Videos can be up to 50 MB.'
  return ''
}

const inputClass = 'w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-muted/60 focus:outline-none focus:border-primary/50'

function isWebUrl(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}

/** Build the overlay for the tool form, or return { error } when the input is not valid. */
function buildOverlay(tool, f) {
  if (tool === 'text') {
    return f.text?.trim() ? { type: 'text', text: f.text.trim(), color: f.color || '#ffffff', background: f.background ? '#000000' : undefined } : { error: 'Type some text first.' }
  }
  if (tool === 'mention') {
    const username = (f.username || '').trim().replace(/^@/, '')
    return /^[A-Za-z0-9_.]{1,64}$/.test(username) ? { type: 'mention', username } : { error: 'Enter a valid username.' }
  }
  if (tool === 'hashtag') {
    const tag = (f.tag || '').trim().replace(/^#/, '')
    return /^[A-Za-z0-9_]{1,50}$/.test(tag) ? { type: 'hashtag', tag } : { error: 'Hashtags use letters, numbers and underscores.' }
  }
  if (tool === 'link') {
    return isWebUrl((f.url || '').trim()) ? { type: 'link', url: f.url.trim(), label: f.label?.trim() || undefined } : { error: 'Enter a link starting with http:// or https://' }
  }
  if (tool === 'question') {
    return f.prompt?.trim() ? { type: 'question', prompt: f.prompt.trim() } : { error: 'Write what you want people to answer.' }
  }
  if (tool === 'slider') {
    return f.question?.trim() ? { type: 'slider', question: f.question.trim(), emoji: f.emoji || '😍' } : { error: 'A slider needs a question.' }
  }
  if (tool === 'quiz') {
    const options = [f.a, f.b, f.c, f.d].map(o => (o || '').trim()).filter(Boolean)
    if (!f.question?.trim() || options.length < 2) return { error: 'A quiz needs a question and at least two answers.' }
    const correct = Number(f.correct ?? 0)
    if (correct >= options.length) return { error: 'Choose which answer is correct.' }
    return { type: 'quiz', question: f.question.trim(), options, correct }
  }
  if (tool === 'countdown') {
    const ends = f.ends ? new Date(f.ends) : null
    if (!f.title?.trim()) return { error: 'Give the countdown a name.' }
    if (!ends || Number.isNaN(ends.getTime()) || ends <= new Date()) return { error: 'Pick a date and time in the future.' }
    return { type: 'countdown', title: f.title.trim(), ends_at: ends.toISOString() }
  }
  const options = [f.a, f.b].map(o => (o || '').trim())
  if (!f.question?.trim() || options.some(o => !o)) return { error: 'A poll needs a question and two answers.' }
  return { type: 'poll', question: f.question.trim(), options }
}

// A plain branded background for "Add post to your story".
function sharedPostBackground() {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1920
    const ctx = canvas.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 1080, 1920)
    g.addColorStop(0, '#0d1c2d')
    g.addColorStop(1, '#3c2f00')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1080, 1920)
    canvas.toBlob(blob => resolve(new File([blob], 'shared-post.png', { type: 'image/png' })), 'image/png')
  })
}

// Draw the chosen filter and the brush strokes into the photo itself, at full resolution.
async function bake(file, previewUrl, filter, strokes, frame) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = previewUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.filter = FILTERS[filter] || 'none'
  ctx.drawImage(img, 0, 0)
  ctx.filter = 'none'
  // strokes were drawn over an object-contain preview: map frame coordinates to image pixels
  const scale = Math.min(frame.width / img.naturalWidth, frame.height / img.naturalHeight)
  const ox = (frame.width - img.naturalWidth * scale) / 2
  const oy = (frame.height - img.naturalHeight * scale) / 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const stroke of strokes) {
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width / scale
    ctx.beginPath()
    stroke.points.forEach(([x, y], i) => {
      const px = (x * frame.width - ox) / scale
      const py = (y * frame.height - oy) / scale
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    })
    ctx.stroke()
  }
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise(resolve => canvas.toBlob(resolve, type, 0.92))
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + (type === 'image/png' ? '.png' : '.jpg'), { type })
}

export default function StoryComposer({ onClose, onPublished, sharedPost }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [overlays, setOverlays] = useState([])
  const [caption, setCaption] = useState('')
  const [audience, setAudience] = useState('everyone')
  const [closeFriends, setCloseFriends] = useState(null)
  const [tool, setTool] = useState(null)
  const [fields, setFields] = useState({})
  const [stage, setStage] = useState('edit')      // edit | publishing
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [filter, setFilter] = useState('Normal')
  const [drawing, setDrawing] = useState(false)      // draw mode on
  const [brush, setBrush] = useState('#ffffff')
  const [strokes, setStrokes] = useState([])
  const canvasRef = useRef(null)
  const strokeRef = useRef(null)

  const frameRef = useRef(null)
  const dragRef = useRef(null)
  const abortRef = useRef(null)
  const uploadedRef = useRef(null)    // { file, media } so a retry after a failed publish does not upload again
  const isVideo = file && VIDEO_TYPES.includes(file.type)
  const editable = Boolean(file) && !isVideo && file.type !== 'image/gif'   // filters and drawing work on still photos
  const dirty = Boolean(file || overlays.length || caption)

  // "Add post to your story": start from a plain background with the post placed in the middle.
  useEffect(() => {
    if (!sharedPost) return
    sharedPostBackground().then(bg => {
      setFile(bg)
      setPreview(URL.createObjectURL(bg))
      setOverlays([{ type: 'post', post_id: sharedPost.id, x: 0.5, y: 0.45, scale: 1, rotation: 0 }])
    })
  }, [sharedPost])

  // Redraw the brush strokes whenever they change or the frame is resized.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvas.clientWidth * dpr
    canvas.height = canvas.clientHeight * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const stroke of strokes) {
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width
      ctx.beginPath()
      stroke.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * canvas.clientWidth, y * canvas.clientHeight) : ctx.lineTo(x * canvas.clientWidth, y * canvas.clientHeight)))
      ctx.stroke()
    }
  }, [strokes, preview])

  const point = e => {
    const box = canvasRef.current.getBoundingClientRect()
    return [(e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height]
  }
  const drawStart = e => {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* capture is a nicety; drawing/dragging works without it */ }
    strokeRef.current = { color: brush, width: 6, points: [point(e)] }
  }
  const drawMove = e => {
    const stroke = strokeRef.current
    if (!stroke) return
    const [x, y] = point(e)
    const [px, py] = stroke.points[stroke.points.length - 1]
    stroke.points.push([x, y])
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.beginPath()
    ctx.moveTo(px * canvas.clientWidth, py * canvas.clientHeight)
    ctx.lineTo(x * canvas.clientWidth, y * canvas.clientHeight)
    ctx.stroke()
  }
  const drawEnd = () => {
    const stroke = strokeRef.current   // read it now: the state updater below runs later, after the ref is cleared
    strokeRef.current = null
    if (stroke?.points.length > 1) setStrokes(list => [...list, stroke])
  }

  useEffect(() => {
    storyService.listPeople('close-friends').then(list => setCloseFriends(list.length)).catch(() => setCloseFriends(null))
  }, [])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const choose = useCallback(picked => {
    if (!picked) return
    const problem = validateFile(picked)
    if (problem) return setError(problem)
    const url = URL.createObjectURL(picked)
    if (VIDEO_TYPES.includes(picked.type)) {
      const probe = document.createElement('video')
      probe.preload = 'metadata'
      probe.onloadedmetadata = () => {
        if (probe.duration > MAX_VIDEO_SECONDS) { URL.revokeObjectURL(url); setError(`Videos can be up to ${MAX_VIDEO_SECONDS} seconds.`) } else { setError(''); setFile(picked); setPreview(url) }
      }
      probe.onerror = () => { URL.revokeObjectURL(url); setError('That video could not be read.') }
      probe.src = url
    } else {
      setError('')
      setFile(picked)
      setPreview(url)
    }
  }, [])

  const attemptClose = () => {
    if (stage === 'publishing') return
    if (dirty && !window.confirm('Discard this story?')) return
    onClose()
  }

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') attemptClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const addOverlay = () => {
    const built = buildOverlay(tool, fields)
    if (built.error) return setError(built.error)
    if (overlays.length >= MAX_OVERLAYS) return setError(`A story can have up to ${MAX_OVERLAYS} items.`)
    if (INTERACTIVE.includes(built.type) && overlays.some(o => INTERACTIVE.includes(o.type))) {
      return setError('A story can have one poll, question, slider, quiz or countdown.')
    }
    setOverlays(list => [...list, { ...built, x: 0.5, y: Math.min(0.2 + list.length * 0.12, 0.85), scale: 1, rotation: 0 }])
    setTool(null)
    setFields({})
    setError('')
  }

  // Drag stickers around the preview; positions are saved as fractions of the frame.
  const startDrag = (index, e) => {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* capture is a nicety; drawing/dragging works without it */ }
    dragRef.current = index
  }
  const moveDrag = e => {
    if (dragRef.current === null || !frameRef.current) return
    const box = frameRef.current.getBoundingClientRect()
    const x = Math.min(0.95, Math.max(0.05, (e.clientX - box.left) / box.width))
    const y = Math.min(0.95, Math.max(0.05, (e.clientY - box.top) / box.height))
    setOverlays(list => list.map((o, i) => (i === dragRef.current ? { ...o, x, y } : o)))
  }
  const endDrag = () => { dragRef.current = null }

  const publish = async () => {
    setStage('publishing')
    setError('')
    setProgress(0)
    try {
      const look = `${filter}|${strokes.length}`
      let media = uploadedRef.current?.file === file && uploadedRef.current.look === look ? uploadedRef.current.media : null
      if (!media) {
        const needsBake = editable && (filter !== 'Normal' || strokes.length > 0)
        const box = frameRef.current.getBoundingClientRect()
        const toUpload = needsBake ? await bake(file, preview, filter, strokes, box) : file
        const upload = storyService.uploadMedia(toUpload, setProgress)
        abortRef.current = upload.abort
        media = await upload.promise
        uploadedRef.current = { file, look, media }
      }
      setProgress(1)
      const story = await storyService.createStory({ media_id: media.media_id, caption: caption.trim() || undefined, audience, overlays })
      uploadedRef.current = null
      onPublished?.(story)
    } catch (err) {
      setError(err.message)
      setStage('edit')
    }
  }

  const cancelUpload = () => abortRef.current?.()

  const setField = (name, value) => setFields(prev => ({ ...prev, [name]: value }))

  const ui = (
    <div className="fixed inset-0 z-[90] bg-black/90 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true" aria-label="Create story">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface-card rounded-2xl border border-white/10 shadow-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-on-surface">{sharedPost ? 'Add post to your story' : 'New story'}</h2>
            <button onClick={attemptClose} disabled={stage === 'publishing'} aria-label="Close" className="p-1 text-on-surface-muted hover:text-on-surface disabled:opacity-40">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {!file ? (
            <label
              onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); choose(e.dataTransfer.files?.[0]) }}
              className={`aspect-[9/12] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer text-center px-6 ${dragOver ? 'border-primary bg-primary/10' : 'border-white/20 hover:border-primary/60'}`}
            >
              <span className="material-symbols-outlined text-5xl text-primary">add_photo_alternate</span>
              <span className="text-sm font-semibold text-on-surface">Choose a photo or video</span>
              <span className="text-xs text-on-surface-muted">or drag it here · images up to 10 MB, videos up to 50 MB and 60 s</span>
              <input type="file" accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(',')} className="sr-only" aria-label="Choose a photo or video"
                onChange={e => { choose(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          ) : (
            <div ref={frameRef} className="relative h-[55vh] max-h-[560px] aspect-[9/14] mx-auto rounded-xl overflow-hidden bg-black touch-none select-none">
              {isVideo
                ? <video src={preview} className="absolute inset-0 w-full h-full object-contain" autoPlay loop muted playsInline />
                : <img src={preview} alt="Story preview" className="absolute inset-0 w-full h-full object-contain" draggable={false} style={{ filter: FILTERS[filter] }} />}
              <canvas ref={canvasRef} aria-label={drawing ? 'Drawing area' : undefined}
                className={`absolute inset-0 w-full h-full ${drawing ? 'z-10 cursor-crosshair' : 'pointer-events-none'}`}
                onPointerDown={drawing ? drawStart : undefined} onPointerMove={drawing ? drawMove : undefined}
                onPointerUp={drawing ? drawEnd : undefined} onPointerCancel={drawing ? drawEnd : undefined} />
              {overlays.map((o, i) => (
                <div key={i} style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%`, transform: 'translate(-50%, -50%)' }}
                  className="absolute max-w-[85%] cursor-grab active:cursor-grabbing"
                  onPointerDown={e => startDrag(i, e)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
                  <OverlayVisual overlay={o} />
                  <button onClick={() => setOverlays(list => list.filter((_, j) => j !== i))} onPointerDown={e => e.stopPropagation()}
                    aria-label="Remove item" className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/80 text-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
              ))}
              <button onClick={() => { setFile(null); setPreview(''); setOverlays([]); setStrokes([]); setFilter('Normal'); setDrawing(false); uploadedRef.current = null }} disabled={stage === 'publishing'}
                className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/70 text-white text-xs font-semibold disabled:opacity-40">Change</button>
            </div>
          )}

          {file && editable && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-1.5 overflow-x-auto hide-scrollbar" role="radiogroup" aria-label="Filter">
                {Object.keys(FILTERS).map(name => (
                  <button key={name} role="radio" aria-checked={filter === name} onClick={() => setFilter(name)} disabled={stage === 'publishing'}
                    className={`shrink-0 flex flex-col items-center gap-1 text-[11px] ${filter === name ? 'text-primary font-bold' : 'text-on-surface-muted'}`}>
                    <img src={preview} alt="" className={`w-12 h-12 rounded-lg object-cover ${filter === name ? 'ring-2 ring-primary' : ''}`} style={{ filter: FILTERS[name] }} />
                    {name}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setDrawing(d => !d)} aria-pressed={drawing} disabled={stage === 'publishing'}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border ${drawing ? 'border-primary text-primary bg-primary/10' : 'border-white/15 text-on-surface'}`}>
                  <span className="material-symbols-outlined text-[16px]">brush</span>{drawing ? 'Done drawing' : 'Draw'}
                </button>
                {drawing && BRUSH_COLORS.map(c => (
                  <button key={c} onClick={() => setBrush(c)} aria-label={`Brush colour ${c}`} className={`w-6 h-6 rounded-full border-2 ${brush === c ? 'border-primary' : 'border-white/30'}`} style={{ background: c }} />
                ))}
                {strokes.length > 0 && <button onClick={() => setStrokes(list => list.slice(0, -1))} className="text-xs font-semibold text-on-surface-muted hover:text-on-surface">Undo</button>}
                {strokes.length > 0 && <button onClick={() => setStrokes([])} className="text-xs font-semibold text-on-surface-muted hover:text-on-surface">Clear</button>}
              </div>
            </div>
          )}

          {file && (
            <>
              <div className="flex gap-1.5 flex-wrap">
                {TOOLS.map(([id, icon, label]) => (
                  <button key={id} onClick={() => { setTool(tool === id ? null : id); setFields({}); setError('') }} disabled={stage === 'publishing'}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border ${tool === id ? 'border-primary text-primary bg-primary/10' : 'border-white/15 text-on-surface hover:bg-white/5'} disabled:opacity-40`}>
                    <span className="material-symbols-outlined text-[16px]">{icon}</span>{label}
                  </button>
                ))}
              </div>

              {tool && (
                <form onSubmit={e => { e.preventDefault(); addOverlay() }} className="flex flex-col gap-2 rounded-xl bg-surface-container-high p-3">
                  {tool === 'text' && (<>
                    <input autoFocus className={inputClass} maxLength={200} placeholder="Type something" value={fields.text || ''} onChange={e => setField('text', e.target.value)} />
                    <div className="flex items-center gap-2">
                      {COLORS.map(c => (
                        <button type="button" key={c} onClick={() => setField('color', c)} aria-label={`Colour ${c}`}
                          className={`w-6 h-6 rounded-full border-2 ${(fields.color || '#ffffff') === c ? 'border-primary' : 'border-white/30'}`} style={{ background: c }} />
                      ))}
                      <label className="ml-auto flex items-center gap-1 text-xs text-on-surface"><input type="checkbox" checked={Boolean(fields.background)} onChange={e => setField('background', e.target.checked)} />Background</label>
                    </div>
                  </>)}
                  {tool === 'mention' && <input autoFocus className={inputClass} maxLength={64} placeholder="Username to mention" value={fields.username || ''} onChange={e => setField('username', e.target.value)} />}
                  {tool === 'hashtag' && <input autoFocus className={inputClass} maxLength={50} placeholder="Hashtag, e.g. NVDA" value={fields.tag || ''} onChange={e => setField('tag', e.target.value)} />}
                  {tool === 'link' && (<>
                    <input autoFocus className={inputClass} maxLength={500} placeholder="https://…" value={fields.url || ''} onChange={e => setField('url', e.target.value)} />
                    <input className={inputClass} maxLength={40} placeholder="Label (optional)" value={fields.label || ''} onChange={e => setField('label', e.target.value)} />
                  </>)}
                  {tool === 'question' && <input autoFocus className={inputClass} maxLength={100} placeholder="Ask me a question…" value={fields.prompt || ''} onChange={e => setField('prompt', e.target.value)} />}
                  {tool === 'slider' && (<>
                    <input autoFocus className={inputClass} maxLength={100} placeholder="How bullish are you?" value={fields.question || ''} onChange={e => setField('question', e.target.value)} />
                    <div className="flex gap-1.5">
                      {['😍', '🔥', '🚀', '📈', '😂', '😮'].map(em => (
                        <button type="button" key={em} onClick={() => setField('emoji', em)} aria-label={`Emoji ${em}`}
                          className={`w-9 h-9 rounded-lg text-xl ${(fields.emoji || '😍') === em ? 'bg-primary/20 ring-2 ring-primary' : 'bg-white/5'}`}>{em}</button>
                      ))}
                    </div>
                  </>)}
                  {tool === 'quiz' && (<>
                    <input autoFocus className={inputClass} maxLength={100} placeholder="Quiz question" value={fields.question || ''} onChange={e => setField('question', e.target.value)} />
                    {['a', 'b', 'c', 'd'].map((key, i) => (
                      <label key={key} className="flex items-center gap-2">
                        <input type="radio" name="quiz-correct" checked={Number(fields.correct ?? 0) === i} onChange={() => setField('correct', i)} aria-label={`Answer ${i + 1} is correct`} />
                        <input className={inputClass} maxLength={30} placeholder={i < 2 ? `Answer ${i + 1}` : `Answer ${i + 1} (optional)`} value={fields[key] || ''} onChange={e => setField(key, e.target.value)} />
                      </label>
                    ))}
                    <p className="text-[11px] text-on-surface-muted">Tick the correct answer. Viewers see it only after they answer.</p>
                  </>)}
                  {tool === 'countdown' && (<>
                    <input autoFocus className={inputClass} maxLength={40} placeholder="Countdown name, e.g. Earnings call" value={fields.title || ''} onChange={e => setField('title', e.target.value)} />
                    <input type="datetime-local" className={inputClass} value={fields.ends || ''} onChange={e => setField('ends', e.target.value)} aria-label="Ends at" />
                  </>)}
                  {tool === 'poll' && (<>
                    <input autoFocus className={inputClass} maxLength={100} placeholder="Ask a question" value={fields.question || ''} onChange={e => setField('question', e.target.value)} />
                    <input className={inputClass} maxLength={30} placeholder="Answer 1" value={fields.a || ''} onChange={e => setField('a', e.target.value)} />
                    <input className={inputClass} maxLength={30} placeholder="Answer 2" value={fields.b || ''} onChange={e => setField('b', e.target.value)} />
                  </>)}
                  <button className="self-end px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold">Add to story</button>
                </form>
              )}

              <textarea className={`${inputClass} resize-none`} rows={2} maxLength={500} placeholder="Add a caption" value={caption} onChange={e => setCaption(e.target.value)} disabled={stage === 'publishing'} />

              <fieldset className="flex gap-2" disabled={stage === 'publishing'}>
                <legend className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted mb-1">Share with</legend>
                {[['everyone', 'Everyone', 'public'], ['close_friends', closeFriends === null ? 'Close Friends' : `Close Friends (${closeFriends})`, 'star']].map(([value, label, icon]) => (
                  <label key={value} className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${audience === value ? 'border-primary bg-primary/10 text-on-surface' : 'border-white/10 text-on-surface-muted'}`}>
                    <input type="radio" name="audience" className="sr-only" checked={audience === value} onChange={() => setAudience(value)} />
                    <span className={`material-symbols-outlined text-[18px] ${value === 'close_friends' ? 'text-bullish' : ''}`}>{icon}</span>{label}
                  </label>
                ))}
              </fieldset>
              {audience === 'close_friends' && closeFriends === 0 && (
                <p className="text-xs text-on-surface-muted">Nobody is on your Close Friends list yet, so only you would see this. <Link to="/settings/close-friends" onClick={onClose} className="text-primary font-semibold hover:underline">Add people</Link></p>
              )}
            </>
          )}

          {error && <p role="alert" className="text-xs text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">{error}</p>}

          {stage === 'publishing' && (
            <div aria-live="polite">
              <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
              <div className="flex justify-between text-xs text-on-surface-muted mt-1">
                <span>{progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : 'Publishing…'}</span>
                {progress < 1 && <button onClick={cancelUpload} className="text-error font-semibold">Cancel</button>}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={attemptClose} disabled={stage === 'publishing'} className="px-4 py-2 rounded-lg text-sm text-on-surface-muted hover:text-on-surface disabled:opacity-40">Cancel</button>
            <button onClick={publish} disabled={!file || stage === 'publishing'} className="px-6 py-2 rounded-lg bg-primary text-on-primary text-sm font-bold disabled:opacity-40">
              {stage === 'publishing' ? 'Sharing…' : 'Share story'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
  return createPortal(ui, document.body)
}
