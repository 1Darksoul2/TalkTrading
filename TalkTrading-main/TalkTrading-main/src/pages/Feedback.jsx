import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import Card from '../components/ui/Card'
import { SUPPORT_EMAIL } from '../config'
import { useAuth } from '../context/AuthContext'
import { copyText } from '../utils/clipboard'

const KINDS = [
  ['bug', 'Something is broken'],
  ['idea', 'Idea or request'],
  ['confusing', 'Something is confusing'],
  ['report', 'Report a person or content'],
  ['other', 'Something else'],
]

/** Beta feedback: composes an email to the team with the details they need to act on it. */
export default function Feedback() {
  const { user } = useAuth()
  const location = useLocation()
  const [kind, setKind] = useState('bug')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const from = location.state?.from || ''

  const subject = `TalkTrading beta: ${KINDS.find(k => k[0] === kind)[1]}`
  const body = [
    message.trim(),
    '',
    '---',
    `User: ${user?.username || ''}`,
    from && `Page: ${from}`,
    `Browser: ${navigator.userAgent}`,
    `Screen: ${window.innerWidth}x${window.innerHeight}`,
    `Time: ${new Date().toISOString()}`,
  ].filter(Boolean).join('\n')

  const send = async e => {
    e.preventDefault()
    if (!message.trim()) return
    if (SUPPORT_EMAIL) {
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    } else {
      setCopied(await copyText(`${subject}\n\n${body}`))
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-on-surface mb-1">Send feedback</h1>
      <p className="text-sm text-on-surface-muted mb-6">
        You are testing an early version of TalkTrading. Tell us what broke, what confused you, or what you wish it did.
      </p>
      <Card className="p-5">
        <form onSubmit={send} className="flex flex-col gap-4">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-on-surface-muted mb-2">What is it about?</legend>
            <div className="flex flex-wrap gap-2">
              {KINDS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setKind(id)}
                  aria-pressed={kind === id}
                  className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                    kind === id ? 'bg-primary/10 text-primary border-primary/40' : 'border-white/[0.08] text-on-surface-muted hover:text-on-surface'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-muted">Details</span>
            <textarea
              value={message}
              onChange={e => { setMessage(e.target.value.slice(0, 4000)); setCopied(false) }}
              rows={6}
              placeholder={kind === 'bug' ? 'What did you do, what did you expect, and what happened instead?' : 'Tell us more…'}
              className="w-full resize-y rounded-xl bg-surface-container border border-white/[0.06] px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-primary/60"
            />
          </label>
          <p className="text-xs text-on-surface-muted">
            Your username, the page you came from, and your browser version are included so we can reproduce problems.
          </p>
          <div className="flex items-center justify-end gap-3">
            {copied && <span className="text-xs text-bullish">Copied. Paste it to the person who invited you.</span>}
            <button type="submit" disabled={!message.trim()} className="px-5 py-2 rounded-xl bg-primary text-on-primary text-sm font-bold disabled:opacity-40">
              {SUPPORT_EMAIL ? 'Write email' : 'Copy feedback'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
