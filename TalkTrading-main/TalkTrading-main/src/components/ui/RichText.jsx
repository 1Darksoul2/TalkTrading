import Linkify from 'linkify-react'
import 'linkify-plugin-mention'
import 'linkify-plugin-hashtag'
import { Link } from 'react-router-dom'

const options = {
  className: 'text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary',
  target: '_blank',
  rel: 'noopener noreferrer nofollow',
  render: {
    mention: ({ content }) => (
      <Link to={`/profile/${content.slice(1)}`} className="text-primary font-semibold underline decoration-primary/40 underline-offset-2 hover:decoration-primary">
        {content}
      </Link>
    ),
    hashtag: ({ content }) => (
      <Link to={`/tags/${encodeURIComponent(content.slice(1).toLowerCase())}`} className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary">
        {content}
      </Link>
    ),
  },
}

// Caption/comment text where @mentions open profiles, #hashtags open the hashtag page and URLs become links.
export default function RichText({ children }) {
  return <Linkify options={options}>{children}</Linkify>
}
