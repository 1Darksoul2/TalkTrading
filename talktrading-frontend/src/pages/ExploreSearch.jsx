import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import TabBar from '../components/ui/TabBar'
import Input from '../components/ui/Input'
import { exploreService } from '../services/exploreService'
import { postService } from '../services/postService'
import { useAuth } from '../context/AuthContext'

const tabs = [
  { id: 'for-you', label: 'For You' },
  { id: 'trending', label: 'Trending' },
  { id: 'popular', label: 'Popular' },
  { id: 'recent', label: 'Recent' },
  { id: 'people', label: 'People' },
]

const RECENT_KEY = 'tt-recent-searches'
const loadRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] } }
const saveRecent = list => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10))) } catch { /* memory only */ } }

function PeopleSearch({ me }) {
  const [q, setQ] = useState('')
  const [recent, setRecent] = useState(loadRecent)   // remembered on this device, newest first
  const [results, setResults] = useState([])
  const [following, setFollowing] = useState({})
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const term = q.trim()
    if (!term || term.startsWith('#')) {
      setResults([])
      setSearched(false)
      return
    }
    const handle = setTimeout(async () => {
      try {
        const found = await postService.searchUsers(term)
        setResults(found)
        setSearched(true)
        const states = await Promise.all(found.map(async u => {
          try { return [u.author_id, (await postService.getFollowStats(u.author_id)).is_following] } catch { return [u.author_id, false] }
        }))
        setFollowing(Object.fromEntries(states))
      } catch {
        setResults([])
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [q])

  const remember = entry => {
    const next = [entry, ...recent.filter(r => r.key !== entry.key)]
    setRecent(next)
    saveRecent(next)
  }
  const forget = key => {
    const next = key ? recent.filter(r => r.key !== key) : []
    setRecent(next)
    saveRecent(next)
  }
  const tag = q.trim().startsWith('#') ? q.trim().slice(1).toLowerCase().replace(/[^a-z0-9_]/g, '') : ''

  const toggle = async (id) => {
    const now = !following[id]
    setFollowing(prev => ({ ...prev, [id]: now }))
    try {
      if (now) await postService.followUser(id)
      else await postService.unfollowUser(id)
    } catch {
      setFollowing(prev => ({ ...prev, [id]: !now }))
    }
  }

  return (
    <div className="space-y-4">
      <Input placeholder="Search people, or #hashtag" icon="person_search" value={q} onChange={e => setQ(e.target.value)} />
      {tag && (
        <Link to={`/tags/${tag}`} onClick={() => remember({ key: `#${tag}`, label: `#${tag}`, to: `/tags/${tag}` })}
          className="flex items-center gap-3 bg-surface-card border border-white/[0.06] rounded-xl p-3 hover:border-primary/40">
          <span className="w-11 h-11 rounded-full bg-surface-container-high flex items-center justify-center text-xl font-bold text-primary">#</span>
          <span className="text-sm font-semibold text-on-surface">See posts tagged #{tag}</span>
        </Link>
      )}
      {!q.trim() && recent.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold text-on-surface">Recent</h3>
            <button onClick={() => forget()} className="text-xs font-semibold text-primary">Clear all</button>
          </div>
          <ul className="flex flex-col gap-1">
            {recent.map(r => (
              <li key={r.key} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
                <Link to={r.to} className="flex items-center gap-3 flex-1 min-w-0">
                  {r.avatar ? <img src={r.avatar} alt="" className="w-10 h-10 rounded-full object-cover" /> : <span className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-primary">#</span>}
                  <span className="text-sm font-semibold text-on-surface truncate">{r.label}</span>
                </Link>
                <button onClick={() => forget(r.key)} aria-label={`Remove ${r.label} from recent searches`} className="text-on-surface-muted hover:text-on-surface"><span className="material-symbols-outlined text-[18px]">close</span></button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!searched && !tag && !(recent.length && !q.trim()) && <p className="text-sm text-on-surface-muted text-center py-12">Type a name to find traders, or #tag for posts.</p>}
      {searched && results.length === 0 && <p className="text-sm text-on-surface-muted text-center py-12">No one found for &ldquo;{q.trim()}&rdquo;.</p>}
      <ul className="flex flex-col gap-2">
        {results.map(u => (
          <li key={u.author_id} className="flex items-center gap-3 bg-surface-card border border-white/[0.06] rounded-xl p-3">
            <Link to={`/profile/${u.username}`} onClick={() => remember({ key: `@${u.username}`, label: u.username, to: `/profile/${u.username}`, avatar: postService.avatarFor(u) })} className="flex items-center gap-3 flex-1 min-w-0">
              <img src={postService.avatarFor(u)} alt="" className="w-11 h-11 rounded-full object-cover" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{u.username}</p>
                <p className="text-xs text-on-surface-muted truncate">{u.bio || u.display_name}</p>
              </div>
            </Link>
            {u.author_id !== me && (
              <button
                onClick={() => toggle(u.author_id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                  following[u.author_id] ? 'bg-surface-container-high text-on-surface border border-white/[0.08]' : 'bg-primary text-on-primary hover:brightness-110'
                }`}
              >
                {following[u.author_id] ? 'Following' : 'Follow'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ExploreSearch() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('for-you')
  const [searchParams] = useSearchParams()
  const [hashtag, setHashtag] = useState(() => searchParams.get('hashtag') || '')   // e.g. from a story's #hashtag sticker
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadFeed = useCallback(async () => {
    if (activeTab === 'people') {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const cleanTag = hashtag.trim().replace(/^#/, '')
      let result
      if (cleanTag) {
        result = await exploreService.getByHashtag(cleanTag)
      } else if (activeTab === 'for-you') {
        result = await exploreService.getFeed({ userId: user?.authorId })
      } else if (activeTab === 'trending') {
        result = await exploreService.getTrending()
      } else if (activeTab === 'popular') {
        result = await exploreService.getPopular()
      } else {
        result = await exploreService.getRecent()
      }
      setPosts(result)
    } catch (err) {
      setError(err.message)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [activeTab, hashtag, user?.authorId])

  useEffect(() => {
    loadFeed()
  }, [loadFeed])

  const react = async (post, interactionType) => {
    try {
      await exploreService.recordInteraction(
        { postId: Number(post.postId), interactionType, category: post.hashtags?.[0] },
        user?.authorId
      )
      if (interactionType === 'DISMISS') {
        setPosts(prev => prev.filter(p => p.postId !== post.postId))
      }
    } catch (err) {
      console.warn('Could not record interaction:', err.message)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6">
      {activeTab !== 'people' && (
        <Input
          placeholder="Search by hashtag (e.g. bitcoin)"
          icon="tag"
          value={hashtag}
          onChange={e => setHashtag(e.target.value)}
        />
      )}

      {!hashtag.trim() && (
        <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      )}

      {activeTab === 'people' && <PeopleSearch me={user?.authorId} />}

      {activeTab !== 'people' && error && (
        <p className="text-xs text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
          Explore Service unavailable: {error}
        </p>
      )}

      {activeTab === 'people' ? null : loading ? (
        <p className="text-sm text-on-surface-muted text-center py-16">Loading discovery feed…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-on-surface-muted text-center py-16">
          {hashtag.trim() ? `No posts found for #${hashtag.trim().replace(/^#/, '')}.` : 'Nothing to discover yet — be the first to post.'}
        </p>
      ) : (
        <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {posts.map((post, i) => {
            const mediaUrl = post.mediaUrl ? postService.resolveMediaUrl(post.mediaUrl) : null
            const featured = i === 0
            return (
              <div
                key={post.postId}
                className={`rounded-xl overflow-hidden relative group bg-surface-card border border-white/[0.06] ${
                  featured ? 'col-span-2 row-span-2 aspect-auto min-h-[280px]' : 'aspect-square'
                }`}
              >
                {mediaUrl ? (
                  <img src={mediaUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-surface-container-low p-4">
                    <p className="text-sm text-on-surface line-clamp-5 text-center">{post.title}</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {(post.hashtags || []).slice(0, 3).map(tag => (
                      <button
                        key={tag}
                        onClick={() => setHashtag(tag)}
                        className="px-2 py-0.5 bg-white/10 hover:bg-primary/30 rounded font-mono text-[10px] text-white"
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-white font-medium line-clamp-2 mb-2">{post.title}</p>
                  <div className="flex items-center justify-between text-white/70">
                    <div className="flex items-center gap-3 text-xs">
                      <button onClick={() => react(post, 'LIKE')} className="flex items-center gap-1 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[14px]">favorite</span>{post.likes}
                      </button>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">chat_bubble</span>{post.comments}</span>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">visibility</span>{post.views}</span>
                    </div>
                    <button onClick={() => react(post, 'DISMISS')} className="hover:text-error transition-colors" title="Not interested">
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
