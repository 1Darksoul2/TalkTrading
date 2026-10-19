import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PostCard from '../components/posts/PostCard'
import CommentsPanel from '../components/posts/CommentsPanel'
import { postService } from '../services/postService'

/** /p/:postId - one post with its comments, like Instagram's post page. Hidden or deleted posts show "not available". */
export default function PostPage() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [state, setState] = useState('loading')   // loading | ready | missing | error
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setState('loading')
    try {
      const [withAuthor] = await postService.attachAuthors([await postService.getPost(postId)])
      setPost(withAuthor)
      setState('ready')
    } catch (err) {
      if (err.status === 404) setState('missing')
      else { setError(err.message); setState('error') }
    }
  }, [postId])

  useEffect(() => { load() }, [load])

  if (state === 'loading') return <p className="text-center text-sm text-on-surface-muted py-20" aria-busy="true">Loading post…</p>
  if (state === 'missing') {
    return (
      <div className="text-center py-20 space-y-3">
        <span className="material-symbols-outlined text-5xl text-on-surface-muted">image_not_supported</span>
        <h1 className="text-lg font-semibold text-on-surface">This post isn&apos;t available</h1>
        <p className="text-sm text-on-surface-muted">It may have been deleted, or you may not have permission to see it.</p>
        <Link to="/" className="inline-block text-sm font-semibold text-primary hover:underline">Back to home</Link>
      </div>
    )
  }
  if (state === 'error') {
    return <p className="text-center text-sm text-error py-20">{error} <button onClick={load} className="font-semibold underline">Try again</button></p>
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pb-24">
      <button onClick={() => navigate(-1)} aria-label="Back" className="my-3 p-1 text-on-surface-muted hover:text-on-surface"><span className="material-symbols-outlined">arrow_back</span></button>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        <div className="lg:col-span-3">
          <PostCard post={post} showFullCaption onChange={setPost} onDeleted={() => navigate('/', { replace: true })}
            onOpenComments={() => document.querySelector('input[aria-label="Add a comment"]')?.focus()} />
        </div>
        <section aria-label="Comments" className="lg:col-span-2 bg-surface-card border border-white/10 rounded-2xl h-[70vh] flex flex-col">
          <h2 className="px-4 pt-3 pb-2 text-sm font-bold text-on-surface border-b border-white/10">Comments · {post.comments}</h2>
          <CommentsPanel post={post} onCountChange={delta => setPost(prev => ({ ...prev, comments: Math.max(0, prev.comments + delta) }))} />
        </section>
      </div>
    </div>
  )
}
