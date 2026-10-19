import LegalLayout, { H, List } from './LegalLayout'
import ContactLine from './ContactLine'

export default function Guidelines() {
  return (
    <LegalLayout title="Community Guidelines">
      <p>TalkTrading works when people can trust what they read. These rules apply to posts, reels, stories, comments, chats and communities.</p>

      <H>Share honestly</H>
      <List items={[
        'Say when you hold a position in what you are talking about.',
        'Label opinions as opinions. Do not present guesses as facts or promise returns.',
        'Do not fake screenshots, P&L, track records or news.',
      ]} />

      <H>Never allowed</H>
      <List items={[
        'Market manipulation: pump-and-dump schemes, coordinated buying or selling, spreading false rumours to move a price.',
        'Scams: paid "signals" or "guaranteed" strategies sold through DMs, fake giveaways, phishing links, requests for money, passwords or wallet keys.',
        'Impersonating another person, company, broker or regulator.',
        'Harassment, hate, threats, or sharing someone\'s private information.',
        'Spam, repeated self-promotion, or automated accounts.',
        'Sexual content, graphic violence, or anything illegal.',
      ]} />

      <H>Reporting</H>
      <p>
        Use “Report” on a story or reel, or write to <ContactLine subject="TalkTrading report" /> with a link or
        screenshot. During the beta, reports are reviewed by the team by hand.
      </p>

      <H>What happens if rules are broken</H>
      <p>We may remove content, limit features, or suspend or remove accounts, depending on how serious it is.</p>
    </LegalLayout>
  )
}
