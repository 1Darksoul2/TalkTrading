import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthLayout, { authColors } from '../components/auth/AuthLayout'
import AuthField from '../components/auth/AuthField'
import SubmitButton from '../components/auth/SubmitButton'
import FormError from '../components/auth/FormError'
import { useAuth } from '../context/AuthContext'

// Opened from the emailed reset link (/reset-password?token=…).
export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const { resetPassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const backToLogin = (
    <p className="text-center mt-5 text-sm" style={{ color: authColors.muted }}>
      <Link to="/login" className="font-medium transition-opacity hover:opacity-80" style={{ color: authColors.gold }}>
        ← Back to sign in
      </Link>
    </p>
  )

  async function handleSubmit(evt) {
    evt.preventDefault()
    const e = {}
    if (password.length < 8) e.password = 'Password must be at least 8 characters.'
    if (confirm !== password) e.confirm = 'Passwords do not match.'
    if (Object.keys(e).length) { setErrors(e); return }
    setErrors({})
    setFormError('')
    setSubmitting(true)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Link not valid" footer={backToLogin}>
        <p className="text-sm leading-relaxed" style={{ color: authColors.muted }}>
          This reset link is incomplete. <Link to="/forgot-password" style={{ color: authColors.gold }}>Request a new one</Link>.
        </p>
      </AuthLayout>
    )
  }

  if (done) {
    return (
      <AuthLayout title="Password changed" footer={backToLogin}>
        <p className="text-sm leading-relaxed" style={{ color: authColors.muted }}>
          Your new password is set. Sign in with it to continue.
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Pick something you don't use anywhere else." footer={backToLogin}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <AuthField id="tt-reset-password" label="New password" type="password" autoComplete="new-password" placeholder="At least 8 characters"
          value={password} onChange={v => { setPassword(v); setErrors(p => ({ ...p, password: undefined })) }} error={errors.password} />
        <AuthField id="tt-reset-confirm" label="Confirm password" type="password" autoComplete="new-password" placeholder="Re-enter password"
          value={confirm} onChange={v => { setConfirm(v); setErrors(p => ({ ...p, confirm: undefined })) }} error={errors.confirm} />
        <FormError message={formError} />
        <SubmitButton submitting={submitting} label="Change password" busyLabel="Saving…" />
      </form>
    </AuthLayout>
  )
}
