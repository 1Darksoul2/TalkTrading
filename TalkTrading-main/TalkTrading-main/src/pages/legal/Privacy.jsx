import LegalLayout, { H, List } from './LegalLayout'
import ContactLine from './ContactLine'
import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Notice">
      <p>This notice explains what TalkTrading stores about you during the beta, why, and what you can do about it.</p>

      <H>What we store</H>
      <List items={[
        'Account: your email address, username, display name, bio, profile photo and a scrambled (hashed) form of your password. We never store the password itself.',
        'What you share: posts, photos and videos, comments, likes, saves, shares, follows, stories (visible for 24 hours, then kept in your private archive if you turn the archive on), highlights, reels and community memberships.',
        'Chats: messages are end-to-end encrypted on your device. The server stores only the encrypted text and the public keys needed to deliver it, and cannot read your messages. Your private keys stay in your browser.',
        'Activity used to make the app work: story views, reactions and replies, notifications, saved news articles, and posts you interact with in Explore (to rank your feed).',
        'Technical data: your IP address and browser details in server logs, kept for security and to fix problems. Login tokens are never written to the logs.',
        'On your device only: your theme, watchlist, recent searches and accessibility preferences are kept in your browser storage.',
      ]} />

      <H>Why</H>
      <p>
        Only to run TalkTrading: show your content to the people you choose, deliver messages and notifications, keep the
        service secure, and fix bugs reported during the beta. We do not sell your data and do not show third-party ads.
      </p>

      <H>Who else is involved</H>
      <List items={[
        'The server that hosts TalkTrading and its database, run by the TalkTrading team.',
        'Market data and news providers (such as TradingView and Finnhub). Prices and news are fetched by our server; the chart on a stock page is loaded from TradingView directly by your browser.',
        'An email provider, only to send password reset emails.',
      ]} />

      <H>How long</H>
      <p>
        Your content stays until you delete it or your account is removed. Expired stories are deleted unless you keep
        them in your archive. Backups are kept for 14 days. Beta data may be reset before a public launch.
      </p>

      <H>Your choices</H>
      <List items={[
        'Edit or delete your posts, comments, stories, highlights and reels at any time.',
        'Download your story data, or delete all of it, in Settings → Your information.',
        'Control who sees your stories in Settings → Story privacy.',
        'Ask for a copy of all your data, or for your whole account to be deleted, by writing to us. We answer within 30 days.',
      ]} />
      <p>
        <Link className="text-primary underline" to="/settings/your-information">Open “Your information”</Link>
      </p>

      <H>Contact</H>
      <p>Privacy questions and requests: <ContactLine subject="TalkTrading privacy request" />.</p>
    </LegalLayout>
  )
}
