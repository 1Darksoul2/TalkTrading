import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import AuthLayout, { authColors } from '../components/auth/AuthLayout'
import AuthField from '../components/auth/AuthField'
import SubmitButton from '../components/auth/SubmitButton'
import FormError from '../components/auth/FormError'
import { useAuth } from '../context/AuthContext'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_RE = /^[a-z0-9_]{3,20}$/

const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
const strengthColors = ['#EF4444', '#EF4444', '#F59E0B', '#84CC16', '#22C55E']

function passwordStrength(pw) {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

export default function Signup() {
  const navigate = useNavigate()
  const { signup } = useAuth()

  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '', confirm: '' })
  const [agreed, setAgreed] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const set = (key) => (value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
  }
  const strength = passwordStrength(form.password)

  function validate() {
    const e = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required.'
    if (!form.username) e.username = 'Username is required.'
    else if (!USERNAME_RE.test(form.username)) e.username = '3–20 characters: lowercase letters, numbers and _ only.'
    if (!form.email.trim()) e.email = 'Email is required.'
    else if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email address.'
    if (!form.password) e.password = 'Password is required.'
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters.'
    else if (strength < 2) e.password = 'Mix upper and lower case, numbers or symbols.'
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match.'
    if (!agreed) e.agreed = 'Please accept the terms to continue.'
    return e
  }

  async function handleSubmit(evt) {
    evt.preventDefault()
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setErrors({})
    setFormError('')
    setSubmitting(true)
    try {
      await signup({ fullName: form.fullName.trim(), username: form.username, email: form.email.trim(), password: form.password })
      navigate('/', { replace: true })
    } catch (err) {
      setFormError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join traders sharing ideas, charts and market talk."
      footer={
        <p className="text-center mt-5 text-sm" style={{ color: authColors.muted }}>
          Already have an account?{' '}
          <Link to="/login" className="font-medium transition-opacity hover:opacity-80" style={{ color: authColors.gold }}>
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <AuthField id="tt-fullname" label="Full name" autoComplete="name" placeholder="Arjun Mehta"
          value={form.fullName} onChange={set('fullName')} error={errors.fullName} />

        <AuthField id="tt-username" label="Username" autoComplete="username" placeholder="arjun_trades"
          value={form.username} onChange={v => set('username')(v.toLowerCase().replace(/\s/g, ''))} error={errors.username} />

        <AuthField id="tt-email" label="Email" type="email" autoComplete="email" placeholder="you@example.com"
          value={form.email} onChange={set('email')} error={errors.email} />

        <AuthField id="tt-new-password" label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters"
          value={form.password} onChange={set('password')} error={errors.password}
          hint={form.password && (
            <div className="flex items-center gap-2" aria-live="polite">
              <div className="flex gap-1 flex-1">
                {[1, 2, 3, 4].map(i => (
                  <span key={i} className="h-1 flex-1 rounded-full transition-colors"
                    style={{ backgroundColor: i <= strength ? strengthColors[strength] : 'rgba(255,255,255,0.08)' }} />
                ))}
              </div>
              <span className="text-xs" style={{ color: strengthColors[strength] }}>{strengthLabels[strength]}</span>
            </div>
          )} />

        <AuthField id="tt-confirm" label="Confirm password" type="password" autoComplete="new-password" placeholder="Re-enter password"
          value={form.confirm} onChange={set('confirm')} error={errors.confirm} />

        <div className="flex flex-col gap-1.5">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => { setAgreed(e.target.checked); setErrors(prev => ({ ...prev, agreed: undefined })) }}
              className="w-4 h-4 mt-0.5 rounded cursor-pointer shrink-0"
              style={{ accentColor: authColors.gold }}
            />
            <span className="text-xs leading-relaxed" style={{ color: authColors.muted }}>
              I am 18 or older and agree to the{' '}
              <a href="/terms" target="_blank" rel="noreferrer" className="underline" style={{ color: authColors.gold }}>Terms</a> and{' '}
              <a href="/guidelines" target="_blank" rel="noreferrer" className="underline" style={{ color: authColors.gold }}>Community Guidelines</a>,
              have read the{' '}
              <a href="/privacy" target="_blank" rel="noreferrer" className="underline" style={{ color: authColors.gold }}>Privacy Notice</a>,
              and understand that posts on Talk Trading are opinions, not investment advice.
            </span>
          </label>
          {errors.agreed && <span className="text-xs" style={{ color: authColors.error }}>{errors.agreed}</span>}
        </div>

        <FormError message={formError} />
        <SubmitButton submitting={submitting} label="Create account" busyLabel="Creating account…" />
      </form>
    </AuthLayout>
  )
}
