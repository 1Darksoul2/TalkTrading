import Linkify from 'linkify-react'
import 'linkify-plugin-mention'
import 'linkify-plugin-hashtag'
import { Link } from 'react-router-dom'

const options = {
  className: 'text-primary hover:underline',
  target: '_blank',
  rel: 'noopener noreferrer nofollow',
  render: {
    mention: ({ content }) => (
      <Link to={`/profile/${content.slice(1)}`} className="text-primary font-semibold hover:underline">
        {content}
      </Link>
    ),
    hashtag: ({ content }) => (
      <Link to={`/tags/${encodeURIComponent(content.slice(1).toLowerCase())}`} className="text-primary hover:underline">
        {content}
      </Link>
    ),
  },
}

// Caption/comment text where @mentions open profiles, #hashtags open the hashtag page and URLs become links.
export default function RichText({ children }) {
  return <Linkify options={options}>{children}</Linkify>
}
