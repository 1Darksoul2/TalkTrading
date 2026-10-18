import { motion } from 'framer-motion'
import logo from '../../assets/logo.png'

/*
 * Shared shell for Login / Sign up / Forgot password.
 * Fixed dark navy background — intentionally NOT using ThemeContext so the auth
 * pages always render on the dark navy regardless of the user's chosen theme.
 */
export const authColors = {
  bg: '#0B1120',
  card: '#131B2E',
  input: '#0E1626',
  text: '#F4F1EA',
  muted: '#9BA8C2',
  gold: '#F2CA50',
  goldDeep: '#D4AF37',
  error: '#EF4444',
  border: 'rgba(255,255,255,0.08)',
}

const cardVariants = {
  hidden:  { opacity: 0, y: 18, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.45, ease: 'easeOut' } },
}

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{ backgroundColor: authColors.bg }}
    >
      {/* Subtle background radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(212,175,55,0.07) 0%, transparent 70%)' }}
      />

      <motion.div variants={cardVariants} initial="hidden" animate="visible" className="w-full max-w-sm z-10">
        {/* Logo / wordmark */}
        <div className="flex flex-col items-center mb-8 gap-2">
          <img src={logo} alt="" className="w-14 h-14 object-contain rounded-xl" />
          <span className="text-3xl font-bold tracking-tight" style={{ color: authColors.gold }}>
            Talk Trading
          </span>
          <span className="text-sm" style={{ color: authColors.muted }}>
            Every chart has a story. Share yours.
          </span>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border p-8"
          style={{
            backgroundColor: authColors.card,
            borderColor: 'rgba(255,255,255,0.06)',
            boxShadow: '0 0 40px rgba(212,175,55,0.08)',
          }}
        >
          <h1 className="text-xl font-semibold" style={{ color: authColors.text }}>{title}</h1>
          {subtitle && <p className="text-sm mt-1" style={{ color: authColors.muted }}>{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>

        {footer}
      </motion.div>
    </div>
  )
}
