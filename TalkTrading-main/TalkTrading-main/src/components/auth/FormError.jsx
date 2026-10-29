import { authColors } from './AuthLayout'

// A problem with the whole form (wrong password, server unreachable), shown above the submit button.
export default function FormError({ message }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="rounded-xl px-3 py-2.5 text-sm"
      style={{ color: authColors.error, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
    >
      {message}
    </div>
  )
}
