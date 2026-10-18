import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import StoryViewer from '../components/stories/StoryViewer'
import { storyService } from '../services/storyService'
import { postService } from '../services/postService'
import { deriveAuthorId } from '../utils/authorId'

/** /stories/:storyId - opens one story (e.g. from a link someone sent you), if you are allowed to see it. */
export default function StoryPage() {
  const { storyId } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const story = await storyService.story(storyId)
        const people = await postService.lookupUsers([deriveAuthorId(story.user_id)]).catch(() => ({}))
        const person = people[deriveAuthorId(story.user_id)] || {}
        if (!cancelled) setGroup({ user: { user_id: story.user_id, username: person.username, avatar_url: person.avatar_url }, stories: [story] })
      } catch {
        if (!cancelled) setMissing(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [storyId])

  if (missing) {
    return (
      <div className="text-center py-20 space-y-3">
        <span className="material-symbols-outlined text-5xl text-on-surface-muted">hide_image</span>
        <h1 className="text-lg font-semibold text-on-surface">This story is no longer available</h1>
        <p className="text-sm text-on-surface-muted">It may have expired, been deleted, or not be shared with you.</p>
        <Link to="/" className="inline-block text-sm font-semibold text-primary hover:underline">Back to home</Link>
      </div>
    )
  }
  if (!group) return <p className="text-center text-sm text-on-surface-muted py-20" aria-busy="true">Opening story…</p>
  return <StoryViewer groups={[group]} onClose={() => navigate(-1)} />
}
