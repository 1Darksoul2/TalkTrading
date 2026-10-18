import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Checked here because the Post Service accepts any password; the server stays the authority for logins.
function signupProblem({ username, email, password }) {
  if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username)) return 'Username: 3-30 letters, numbers, dots or underscores.'
  if (password.length < 8) return 'Password: at least 8 characters.'
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return 'Password: use both letters and numbers.'
  const lower = password.toLowerCase()
  if (lower === username.toLowerCase() || lower === email.toLowerCase() || lower === email.split('@')[0].toLowerCase()) {
    return 'Password must not be your username or email.'
  }
  return ''
}

export default function Login() {
  const { login, register, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/'

  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    try {
      if (mode === 'login') {
        await login({ email: email.trim(), password })
      } else {
        const problem = signupProblem({ username: username.trim(), email: email.trim(), password })
        if (problem) {
          setFormError(problem)
          return
        }
        await register({ username: username.trim(), email: email.trim(), password })
      }
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setFormError(err.message || 'Something went wrong')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-container bg-clip-text text-transparent">
            TalkTrading
          </h1>
          <p className="text-sm text-on-surface-muted mt-1">
            {mode === 'login' ? 'Log in to your account' : 'Create your account'}
          </p>
        </div>

        <div className="bg-surface-card rounded-2xl border border-white/[0.06] p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'signup' && (
              <div>
                <label className="text-xs font-semibold text-on-surface-muted uppercase mb-1.5 block">Username</label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="alex_quant"
                  className="w-full bg-surface-container-low border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted/50 focus:outline-none focus:border-primary/50"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-on-surface-muted uppercase mb-1.5 block">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-surface-container-low border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted/50 focus:outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-on-surface-muted uppercase mb-1.5 block">Password</label>
              <input
                type="password"
                required
                minLength={mode === 'signup' ? 8 : undefined}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface-container-low border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted/50 focus:outline-none focus:border-primary/50"
              />
            </div>

            {mode === 'signup' && <p className="text-[11px] text-on-surface-muted -mt-2">At least 8 characters, with letters and numbers.</p>}

            {formError && (
              <p className="text-xs text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">{formError}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {isLoading ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-on-surface-muted mt-5">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setFormError('') }}
            className="text-primary font-semibold hover:underline"
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  )
}
