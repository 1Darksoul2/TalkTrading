import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout, { authColors } from '../components/auth/AuthLayout'
import AuthField from '../components/auth/AuthField'
import SubmitButton from '../components/auth/SubmitButton'
import { useAuth } from '../context/AuthContext'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(evt) {
    evt.preventDefault()
    if (!EMAIL_RE.test(email.trim())) { setError('Enter the email you signed up with.'); return }
    setError('')
    setSubmitting(true)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const backToLogin = (
    <p className="text-center mt-5 text-sm" style={{ color: authColors.muted }}>
      <Link to="/login" className="font-medium transition-opacity hover:opacity-80" style={{ color: authColors.gold }}>
        ← Back to sign in
      </Link>
    </p>
  )

  if (sent) {
    return (
      <AuthLayout title="Check your email" footer={backToLogin}>
        <p className="text-sm leading-relaxed" style={{ color: authColors.muted }}>
          If an account exists for <span style={{ color: authColors.text }}>{email.trim()}</span>, we've sent a link
          to reset your password. It expires in 30 minutes.
        </p>
        <button
          onClick={() => setSent(false)}
          className="mt-6 text-xs transition-opacity hover:opacity-80"
          style={{ color: authColors.gold }}
        >
          Didn't get it? Try again
        </button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={backToLogin}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <AuthField id="tt-reset-email" label="Email" type="email" autoComplete="email" placeholder="you@example.com"
          value={email} onChange={v => { setEmail(v); setError('') }} error={error} />
        <SubmitButton submitting={submitting} label="Send reset link" busyLabel="Sending…" />
      </form>
    </AuthLayout>
  )
}
