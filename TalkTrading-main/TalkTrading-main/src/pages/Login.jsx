import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import AuthLayout, { authColors } from '../components/auth/AuthLayout'
import AuthField from '../components/auth/AuthField'
import SubmitButton from '../components/auth/SubmitButton'
import FormError from '../components/auth/FormError'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const redirectTo = location.state?.from?.pathname || '/'

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [remember, setRemember]     = useState(false)
  const [errors, setErrors]         = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState('')

  function validate() {
    const e = {}
    if (!identifier.trim()) e.identifier = 'Email or username is required.'
    if (!password)           e.password   = 'Password is required.'
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
      await login({ identifier: identifier.trim(), password, remember })
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setFormError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Pick up where the market left off."
      footer={
        <p className="text-center mt-5 text-sm" style={{ color: authColors.muted }}>
          New here?{' '}
          <Link to="/signup" className="font-medium transition-opacity hover:opacity-80" style={{ color: authColors.gold }}>
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <AuthField
          id="tt-identifier"
          label="Email or username"
          autoComplete="username"
          placeholder="you@example.com"
          value={identifier}
          onChange={v => { setIdentifier(v); setErrors(prev => ({ ...prev, identifier: undefined })) }}
          error={errors.identifier}
        />

        <div className="flex flex-col gap-2">
          <AuthField
            id="tt-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={v => { setPassword(v); setErrors(prev => ({ ...prev, password: undefined })) }}
            error={errors.password}
          />
          <Link to="/forgot-password" className="self-end text-xs transition-opacity hover:opacity-80" style={{ color: authColors.gold }}>
            Forgot password?
          </Link>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-4 h-4 rounded cursor-pointer"
            style={{ accentColor: authColors.gold }}
          />
          <span className="text-sm" style={{ color: authColors.muted }}>Remember me</span>
        </label>

        <FormError message={formError} />
        <SubmitButton submitting={submitting} label="Sign in" busyLabel="Signing in…" />
      </form>
    </AuthLayout>
  )
}
