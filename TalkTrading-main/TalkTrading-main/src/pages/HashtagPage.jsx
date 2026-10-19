import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { postService } from '../services/postService'

const PAGE = 30

/** /tags/:tag - every public post filed under a hashtag, newest first, as a grid (like Instagram's hashtag page). */
export default function HashtagPage() {
  const { tag } = useParams()
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [total, setTotal] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async nextPage => {
    setLoading(true)
    setError('')
    try {
      const data = await postService.getHashtagPosts(tag, nextPage, PAGE)
      setPosts(prev => (nextPage === 1 ? data.posts : [...prev, ...data.posts]))
      setTotal(data.total)
      setPage(nextPage)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [tag])

  useEffect(() => { setPosts([]); load(1) }, [load])

  return (
    <div className="max-w-4xl mx-auto px-4 pb-24">
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-1 text-on-surface-muted hover:text-on-surface"><span className="material-symbols-outlined">arrow_back</span></button>
        <div className="w-16 h-16 rounded-full bg-surface-card border border-white/10 flex items-center justify-center text-3xl text-primary font-bold">#</div>
        <div>
          <h1 className="text-xl font-bold text-on-surface">#{tag}</h1>
          {total !== null && <p className="text-sm text-on-surface-muted">{total.toLocaleString()} {total === 1 ? 'post' : 'posts'}</p>}
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-error py-4">{error} <button onClick={() => load(1)} className="font-semibold underline">Retry</button></p>}
      {!loading && !error && posts.length === 0 && <p className="text-center text-sm text-on-surface-muted py-16">No public posts use #{tag} yet.</p>}

      <div className="grid grid-cols-3 gap-1 md:gap-2">
        {posts.map(post => (
          <Link key={post.id} to={`/p/${post.id}`} aria-label={`Post: ${post.content?.slice(0, 60) || 'photo'}`}
            className="relative aspect-square rounded-md overflow-hidden bg-surface-card border border-white/5 group">
            {post.image
              ? <img src={post.image} alt="" loading="lazy" className="w-full h-full object-cover" />
              : <p className="p-3 text-xs md:text-sm text-on-surface line-clamp-5">{post.content}</p>}
            {post.mediaItems?.length > 1 && <span className="absolute top-1.5 right-1.5 material-symbols-outlined text-white text-[18px] drop-shadow">collections</span>}
            <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-4 text-white text-sm font-bold">
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>{post.likes}</span>
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>chat_bubble</span>{post.comments}</span>
            </span>
          </Link>
        ))}
      </div>
      {loading && <p className="text-center text-sm text-on-surface-muted py-6">Loading…</p>}
      {!loading && total !== null && posts.length < total && <button onClick={() => load(page + 1)} className="w-full py-3 text-sm font-semibold text-primary">Load more</button>}
    </div>
  )
}
