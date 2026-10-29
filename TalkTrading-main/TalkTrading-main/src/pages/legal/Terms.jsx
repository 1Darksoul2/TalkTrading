import LegalLayout, { H, List } from './LegalLayout'
import ContactLine from './ContactLine'
import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <LegalLayout title="Terms of Use">
      <p>
        TalkTrading is a community where traders share ideas, charts and market discussion. It is currently a
        <strong> closed beta</strong>: features change, things can break, and data may occasionally be reset. By creating
        an account you agree to these terms.
      </p>

      <H>Not financial advice</H>
      <p>
        Everything on TalkTrading — posts, reels, stories, chats, community discussion, news and prices — is for
        information and discussion only. It is <strong>not investment, financial, tax or legal advice</strong>, and no one
        on TalkTrading is acting as your adviser. Trading involves risk, including the loss of more than you invest. Make
        your own decisions and, where needed, speak to a licensed professional. Prices and news come from third parties and
        can be delayed or wrong.
      </p>

      <H>Your account</H>
      <List items={[
        'You must be at least 18 years old.',
        'Keep your password private. You are responsible for what happens under your account.',
        'One person, one account. Do not impersonate anyone.',
      ]} />

      <H>Your content</H>
      <p>
        You keep ownership of what you post. You give TalkTrading permission to store it and show it to the people your
        settings allow, for as long as it stays on the service. Only post what you have the right to share. Content must
        follow the <Link className="text-primary underline" to="/guidelines">Community Guidelines</Link>; we may hide
        or remove content and suspend accounts that break them.
      </p>

      <H>The beta</H>
      <List items={[
        'The service is provided "as is", without guarantees of availability or accuracy.',
        'We may change or end features, and may need to reset beta data. We will try to warn you first.',
        'Your feedback helps; we may use it to improve TalkTrading without owing you anything for it.',
      ]} />

      <H>Liability</H>
      <p>
        To the extent the law allows, TalkTrading is not liable for trading losses or for decisions you make based on
        anything you read or watch here.
      </p>

      <H>Contact</H>
      <p>Questions about these terms: <ContactLine subject="TalkTrading terms" />.</p>
    </LegalLayout>
  )
}
