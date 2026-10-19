import { Link } from 'react-router-dom'
import AuthLayout, { authColors } from '../components/auth/AuthLayout'
import { SUPPORT_EMAIL } from '../config'

// Password reset by email is not offered by the account service yet; the team resets it by hand.
export default function ForgotPassword() {
  const subject = encodeURIComponent('TalkTrading: I forgot my password')
  const body = encodeURIComponent('Hi, please reset the password for the TalkTrading account that uses this email address. My username is: ')
  return (
    <AuthLayout
      title="Forgot your password?"
      footer={
        <p className="text-center mt-5 text-sm" style={{ color: authColors.muted }}>
          <Link to="/login" className="font-medium underline" style={{ color: authColors.gold }}>
            ← Back to sign in
          </Link>
        </p>
      }
    >
      <div className="flex flex-col gap-4 text-sm leading-relaxed" style={{ color: authColors.muted }}>
        <p>During the beta, passwords are reset by the TalkTrading team.</p>
        {SUPPORT_EMAIL ? (
          <>
            <p>
              Write to <span style={{ color: authColors.text }}>{SUPPORT_EMAIL}</span> from the email address you signed up
              with. The team will set a temporary password and send it to you; change it after signing in.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`}
              className="w-full rounded-xl py-3 text-sm font-semibold text-center"
              style={{ background: `linear-gradient(135deg, ${authColors.gold}, ${authColors.goldDeep})`, color: '#3C2F00' }}
            >
              Email the team
            </a>
          </>
        ) : (
          <p>Ask the person who invited you to the beta; they will set a temporary password for you.</p>
        )}
      </div>
    </AuthLayout>
  )
}
