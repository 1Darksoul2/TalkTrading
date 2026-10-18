import { SUPPORT_EMAIL } from '../../config'

/** How to reach the people running this TalkTrading instance. */
export default function ContactLine({ subject = 'TalkTrading' }) {
  if (!SUPPORT_EMAIL) return <span>the person who invited you to the beta</span>
  return <a className="text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`}>{SUPPORT_EMAIL}</a>
}
