import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import TabBar from '../components/ui/TabBar'
import Button from '../components/ui/Button'
import HighlightsRow from '../components/stories/HighlightsRow'
import StoryViewer from '../components/stories/StoryViewer'
import FollowListModal from '../components/profile/FollowListModal'
import ProfileMenu from '../components/profile/ProfileMenu'
import PostComposer from '../components/posts/PostComposer'
import { postService } from '../services/postService'
import { storyService } from '../services/storyService'
import { useAuth } from '../context/AuthContext'
import { useE2E } from '../context/E2EContext'

const formatNum = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : n

const ALL_TABS = [
  { id: 'posts', label: 'Posts' },
  { id: 'media', label: 'Media' },
  { id: 'tagged', label: 'Tagged' },
  { id: 'saved', label: 'Saved' },
]

function PostGrid({ items, empty }) {
  if (items.length === 0) {
    return <div className="col-span-3 text-center py-12 text-sm text-on-surface-muted">{empty}</div>
  }
  return items.map((post, i) => {
    const first = post.mediaItems?.[0]
    return (
      <Link key={post.id || i} to={`/p/${post.id}`} aria-label={`Post: ${(post.content || 'photo').slice(0, 60)}`}
        className="aspect-square relative group rounded-md overflow-hidden bg-surface-card border border-white/5 hover:border-primary/40 transition-colors">
        {first ? (
          first.media_type === 'video'
            ? <video src={`${first.resolvedUrl}#t=0.1`} muted preload="metadata" className="w-full h-full object-cover" />
            : <img src={first.resolvedUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <p className="p-3 h-full bg-surface-container-low text-[11px] md:text-sm text-on-surface line-clamp-6 leading-relaxed">{post.content || post.caption}</p>
        )}
        {post.mediaItems?.length > 1 && <span className="absolute top-1.5 right-1.5 material-symbols-outlined text-white text-[18px] drop-shadow">collections</span>}
        {post.mediaItems?.length === 1 && first?.media_type === 'video' && <span className="absolute top-1.5 right-1.5 material-symbols-outlined text-white text-[18px] drop-shadow">smart_display</span>}
        <span className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white text-sm font-bold">
          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>{post.likes}</span>
          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>chat_bubble</span>{post.comments}</span>
        </span>
      </Link>
    )
  })
}

export default function UserProfile() {
  const { user: authUser } = useAuth()
  const { isReady: chatReady, startConversation } = useE2E()
  const navigate = useNavigate()
  const { username: routeUsername } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const isOwn = !routeUsername || routeUsername === authUser?.username

  const [profile, setProfile] = useState(null)
  const [status, setStatus] = useState('loading')      // loading | ready | notfound | error
  const [errorText, setErrorText] = useState('')
  const [activeTab, setActiveTab] = useState('posts')
  const [posts, setPosts] = useState([])
  const [saved, setSaved] = useState(null)             // null until the tab is opened
  const [tagged, setTagged] = useState(null)
  const [tabError, setTabError] = useState('')
  const [stories, setStories] = useState([])
  const [storyViewer, setStoryViewer] = useState(false)
  const [listKind, setListKind] = useState(null)       // 'followers' | 'following' | null
  const [menuOpen, setMenuOpen] = useState(false)
  const [following, setFollowing] = useState(false)    // a follow/unfollow request is in flight
  const [toast, setToast] = useState('')

  // Composer / edit modal state
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editAvatar, setEditAvatar] = useState(null)
  const [editPreview, setEditPreview] = useState('')
  const [editError, setEditError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const say = useCallback(message => { setToast(message); setTimeout(() => setToast(''), 3000) }, [])

  const load = useCallback(async () => {
    if (!authUser?.authorId) return
    setStatus('loading')
    setActiveTab('posts')
    setSaved(null)
    setTagged(null)
    setTabError('')
    try {
      const p = isOwn ? await postService.getMyProfile() : await postService.getProfileByUsername(routeUsername)
      setProfile(p)
      setStatus('ready')
      postService.fetchPosts({ author_id: p.author_id }).then(list => setPosts(list || [])).catch(() => setPosts([]))
      storyService.userStories(p.uuid).then(setStories).catch(() => setStories([]))
    } catch (err) {
      if (err.message === 'not_found') setStatus('notfound')
      else { setErrorText(err.message); setStatus('error') }
    }
  }, [authUser?.authorId, isOwn, routeUsername])

  useEffect(() => { load() }, [load])

  // The Saved and Tagged tabs load the first time they are opened.
  useEffect(() => {
    if (status !== 'ready') return
    setTabError('')
    if (activeTab === 'saved' && isOwn && saved === null) {
      postService.fetchSavedPosts().then(list => setSaved(list || [])).catch(err => { setSaved([]); setTabError(err.message) })
    }
    if (activeTab === 'tagged' && tagged === null) {
      postService.getTaggedPosts(profile.author_id).then(setTagged).catch(err => { setTagged([]); setTabError(err.message) })
    }
  }, [activeTab, status, isOwn, saved, tagged, profile?.author_id])

  const owner = useMemo(() => (profile ? {
    user_id: profile.uuid, username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url,
  } : null), [profile])

  const hasUnseen = stories.some(s => !s.seen)
  const ringClass = stories.length === 0 ? 'from-primary to-primary-container'
    : !hasUnseen && !isOwn ? 'from-white/30 to-white/30'
      : stories.some(s => s.audience === 'close_friends') ? 'from-green-400 to-emerald-600' : 'from-yellow-400 via-pink-500 to-purple-600'

  const toggleFollowProfile = async () => {
    if (!profile || following) return
    const nowFollowing = !profile.is_following
    setFollowing(true)
    setProfile(prev => ({ ...prev, is_following: nowFollowing, followers_count: prev.followers_count + (nowFollowing ? 1 : -1) }))
    try {
      if (nowFollowing) await postService.followUser(profile.author_id)
      else await postService.unfollowUser(profile.author_id)
    } catch (err) {
      setProfile(prev => ({ ...prev, is_following: !nowFollowing, followers_count: prev.followers_count + (nowFollowing ? -1 : 1) }))
      say(err.message)
    } finally {
      setFollowing(false)
    }
  }

  const message = async () => {
    if (!chatReady) return say('Chat is still setting up. Try again in a moment.')
    try {
      const conversation = await startConversation([profile.uuid])
      navigate(`/chats/${conversation.conversation_id}`)
    } catch (err) {
      say(err.message)
    }
  }

  const openEdit = () => {
    setEditName(profile?.display_name || '')
    setEditBio(profile?.bio || '')
    setEditAvatar(null)
    setEditPreview('')
    setEditError('')
    setIsEditOpen(true)
  }

  // /profile?edit=1 (from Settings > Account) opens the edit dialog once the profile is loaded.
  useEffect(() => {
    if (status === 'ready' && isOwn && searchParams.get('edit')) {
      openEdit()
      setSearchParams({}, { replace: true })
    }
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps -- run once per load

  const saveProfile = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    setEditError('')
    try {
      let updated = await postService.updateMyProfile({ display_name: editName, bio: editBio })
      if (editAvatar) updated = await postService.uploadAvatar(editAvatar)
      setProfile(updated)
      setIsEditOpen(false)
      say('Profile updated')
    } catch (err) {
      setEditError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (status === 'notfound') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-3">
        <span className="material-symbols-outlined text-5xl text-on-surface-muted">person_off</span>
        <h2 className="text-lg font-semibold text-on-surface">User not found</h2>
        <p className="text-sm text-on-surface-muted">There is no trader called @{routeUsername}.</p>
        <Link to="/explore" className="inline-block text-sm font-semibold text-primary hover:underline">Find people in Explore</Link>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-3">
        <span className="material-symbols-outlined text-5xl text-on-surface-muted">cloud_off</span>
        <h2 className="text-lg font-semibold text-on-surface">Couldn&apos;t load this profile</h2>
        <p className="text-sm text-on-surface-muted">{errorText}</p>
        <Button variant="secondary" onClick={load}>Try again</Button>
      </div>
    )
  }
  if (status === 'loading' || !profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 space-y-6 animate-pulse" aria-busy="true" aria-label="Loading profile">
        <div className="flex items-center gap-4"><div className="w-20 h-20 rounded-full bg-surface-card" /><div className="space-y-2"><div className="h-4 w-40 rounded bg-surface-card" /><div className="h-3 w-24 rounded bg-surface-card" /></div></div>
        <div className="h-10 rounded-xl bg-surface-card" />
        <div className="grid grid-cols-3 gap-1">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="aspect-square rounded-md bg-surface-card" />)}</div>
      </div>
    )
  }

  const tabs = isOwn ? ALL_TABS : ALL_TABS.filter(t => t.id !== 'saved')
  let items = posts
  let empty = isOwn ? 'You have not posted yet.' : 'No posts yet.'
  if (activeTab === 'media') { items = posts.filter(p => p.image); empty = 'No photos or charts yet.' }
  if (activeTab === 'saved') { items = saved || []; empty = tabError || (saved === null ? 'Loading…' : 'Nothing saved yet.') }
  if (activeTab === 'tagged') { items = tagged || []; empty = tabError || (tagged === null ? 'Loading…' : `No posts mention @${profile.username} yet.`) }

  return (
    <div className="max-w-4xl mx-auto px-4 space-y-5">
      <section className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => stories.length && setStoryViewer(true)}
            disabled={stories.length === 0}
            aria-label={stories.length ? `Watch ${profile.username}'s story` : 'Profile photo'}
            className={`relative w-20 h-20 rounded-full p-[3px] bg-gradient-to-br ${ringClass} flex-shrink-0 ${stories.length ? 'cursor-pointer hover:scale-105 transition-transform' : 'cursor-default'}`}
          >
            <img src={postService.avatarFor(profile)} alt="" className="w-full h-full rounded-full object-cover border-2 border-background" />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-on-surface truncate">{profile.display_name || profile.username}</h2>
            <p className="text-sm text-on-surface-muted flex items-center gap-2">
              @{profile.username}
              {!isOwn && profile.follows_you && <span className="text-[10px] font-semibold uppercase tracking-wider bg-white/10 text-on-surface rounded px-1.5 py-0.5">Follows you</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-center">
          <div className="flex flex-col items-center">
            <span className="font-mono font-bold text-on-surface">{formatNum(profile.posts_count ?? posts.length)}</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-muted">Posts</span>
          </div>
          <button onClick={() => setListKind('followers')} className="flex flex-col items-center hover:opacity-80">
            <span className="font-mono font-bold text-on-surface">{formatNum(profile.followers_count)}</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-muted">Followers</span>
          </button>
          <button onClick={() => setListKind('following')} className="flex flex-col items-center hover:opacity-80">
            <span className="font-mono font-bold text-on-surface">{formatNum(profile.following_count)}</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-muted">Following</span>
          </button>
        </div>
      </section>

      <section className="text-sm text-on-surface-muted leading-relaxed whitespace-pre-line">
        {profile.bio || (isOwn ? 'No bio yet. Add one from Edit Profile.' : '')}
      </section>

      {isOwn ? (
        <section className="flex gap-3 flex-wrap">
          <Button variant="primary" className="flex-1" icon="add_photo_alternate" onClick={() => setIsComposerOpen(true)}>Upload Post</Button>
          <Button variant="secondary" className="flex-1" icon="edit" onClick={openEdit}>Edit Profile</Button>
          <Button variant="secondary" icon="more_horiz" aria-label="More options" onClick={() => setMenuOpen(true)} />
        </section>
      ) : (
        <section className="flex gap-3">
          <Button variant={profile.is_following ? 'secondary' : 'primary'} className="flex-1" icon={profile.is_following ? 'check' : 'person_add'} onClick={toggleFollowProfile} disabled={following}>
            {profile.is_following ? 'Following' : profile.follows_you ? 'Follow back' : 'Follow'}
          </Button>
          <Button variant="secondary" className="flex-1" icon="chat" onClick={message}>Message</Button>
          <Button variant="secondary" icon="more_horiz" aria-label="More options" onClick={() => setMenuOpen(true)} />
        </section>
      )}

      <HighlightsRow owner={owner} isOwn={isOwn} />

      <div>
        <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="underline" />
      </div>

      <section className="grid grid-cols-3 gap-1 md:gap-2" aria-live="polite">
        <PostGrid items={items} empty={empty} />
      </section>

      {toast && <div role="status" className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[95] px-4 py-2 rounded-full bg-black/85 text-white text-xs font-medium">{toast}</div>}

      {storyViewer && owner && (
        <StoryViewer
          groups={[{ user: owner, stories }]}
          startStory={Math.max(0, stories.findIndex(s => !s.seen))}
          onClose={() => { setStoryViewer(false); storyService.userStories(profile.uuid).then(setStories).catch(() => {}) }}
        />
      )}
      {listKind && (
        <FollowListModal
          profile={profile} kind={listKind} onClose={() => setListKind(null)}
          onFollowingChanged={delta => setProfile(prev => ({ ...prev, following_count: Math.max(0, prev.following_count + delta) }))}
        />
      )}
      {menuOpen && <ProfileMenu profile={profile} onClose={() => setMenuOpen(false)} onToast={say} />}

      {isEditOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={saveProfile} className="bg-surface-card max-w-md w-full rounded-2xl p-6 border border-white/10 shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-on-surface">Edit Profile</h3>
              <button type="button" onClick={() => setIsEditOpen(false)} aria-label="Close" className="text-on-surface-muted hover:text-on-surface p-1"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="flex items-center gap-4">
              <img src={editPreview || postService.avatarFor(profile)} alt="" className="w-16 h-16 rounded-full object-cover border border-white/10" />
              <label className="text-xs font-semibold text-primary cursor-pointer hover:underline">
                Change photo
                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setEditAvatar(f); setEditPreview(URL.createObjectURL(f)) } }} />
              </label>
            </div>
            <div>
              <label htmlFor="edit-name" className="text-xs font-semibold text-on-surface-muted uppercase mb-1.5 block">Display name</label>
              <input id="edit-name" type="text" required maxLength={64} value={editName} onChange={e => setEditName(e.target.value)}
                className="w-full bg-surface-container-low border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label htmlFor="edit-bio" className="text-xs font-semibold text-on-surface-muted uppercase mb-1.5 flex justify-between"><span>Bio</span><span>{editBio.length}/160</span></label>
              <textarea id="edit-bio" rows={3} maxLength={160} value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="What do you trade? Share your style in a sentence."
                className="w-full bg-surface-container-low border border-white/10 rounded-xl p-3 text-sm text-on-surface placeholder:text-on-surface-muted/60 focus:outline-none focus:border-primary/50 resize-none" />
            </div>
            {editError && <p role="alert" className="text-xs text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">{editError}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setIsEditOpen(false)} className="px-4 py-2 text-xs text-on-surface-muted hover:text-on-surface">Cancel</button>
              <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary text-black text-xs font-bold rounded-xl hover:bg-primary/90 disabled:opacity-40">{isSaving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      {isComposerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsComposerOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="New post" className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-base font-bold text-white">New post</h3>
              <button onClick={() => setIsComposerOpen(false)} aria-label="Close" className="text-white/80 hover:text-white p-1"><span className="material-symbols-outlined">close</span></button>
            </div>
            <PostComposer onPublished={post => {
              setPosts(prev => [{ ...post, username: profile.username, userAvatar: postService.avatarFor(profile) }, ...prev])
              setProfile(prev => ({ ...prev, posts_count: (prev.posts_count || 0) + 1 }))
              setIsComposerOpen(false)
              say('Posted')
            }} />
          </div>
        </div>
      )}
    </div>
  )
}
