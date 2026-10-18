import { useState } from 'react'
import { authColors } from './AuthLayout'

// Labelled input for the auth pages. type="password" gets a show/hide toggle.
export default function AuthField({ id, label, type = 'text', value, onChange, error, labelAction, hint, ...rest }) {
  const [focused, setFocused] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const isPassword = type === 'password'

  const borderColor = error ? authColors.error : focused ? 'rgba(242,202,80,0.4)' : authColors.border

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide" style={{ color: authColors.muted }}>
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <input
          id={id}
          type={isPassword && showPass ? 'text' : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors ${isPassword ? 'pr-11' : ''}`}
          style={{ backgroundColor: authColors.input, borderColor, color: authColors.text }}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPass(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
            style={{ color: authColors.muted }}
            aria-label={showPass ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={!showPass} />
          </button>
        )}
      </div>
      {error
        ? <span id={`${id}-error`} className="text-xs" style={{ color: authColors.error }}>{error}</span>
        : hint}
    </div>
  )
}

// Inline SVG so the toggle still renders if Google Fonts (Material Symbols) can't load.
function EyeIcon({ open }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  )
}
