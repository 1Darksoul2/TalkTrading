import { useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../components/ui/Card'
import mockPosts from '../data/mockPosts'
import mockUsers from '../data/mockUsers'
import mockTickers from '../data/mockTickers'

const topTickers = mockTickers.slice(0, 5)
const storyUsers = mockUsers.slice(0, 4)

export default function HomeFeed() {
  const [posts, setPosts] = useState(mockPosts.map(p => ({ ...p })))

  const toggleLike = (postId) => {
    setPosts(prev => prev.map(p => p.id === postId
      ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
      : p
    ))
  }

  const toggleBookmark = (postId) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, isBookmarked: !p.isBookmarked } : p))
  }

  return (
    <div className="max-w-7xl mx-auto px-0 md:px-8 grid grid-cols-1 md:grid-cols-12 gap-4">
      {/* Center Feed */}
      <div className="md:col-span-8 lg:col-span-9 flex flex-col gap-6">
        {/* Stories */}
        <section className="w-full overflow-x-auto hide-scrollbar pl-4 md:pl-0 pt-2 pb-2">
          <div className="flex gap-4 min-w-max">
            <Link to="/create?type=story" className="flex flex-col items-center gap-1 cursor-pointer">
              <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center border border-dashed border-outline-variant">
                <span className="material-symbols-outlined text-primary">add</span>
              </div>
              <span className="text-xs text-on-surface-muted">Your Story</span>
            </Link>
            {storyUsers.map(user => (
              <div key={user.id} className="flex flex-col items-center gap-1 cursor-pointer">
                <div className="story-ring">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-background">
                    <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
                  </div>
                </div>
                <span className="text-xs text-on-surface">{user.displayName.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Ticker Strip */}
        <section className="sticky top-16 z-30 py-2 mx-4 md:mx-0">
          <div className="overflow-x-auto hide-scrollbar flex items-center gap-4 px-4 py-2.5 bg-surface-card rounded-full border border-white/[0.06]">
            {topTickers.map(t => (
              <Link key={t.symbol} to={`/market/${t.symbol}`} className="flex items-center gap-2 pr-4 border-r border-outline-variant/30 last:border-r-0 last:pr-0 shrink-0 hover:opacity-80 transition-opacity">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${t.changePercent >= 0 ? 'bg-primary/20' : 'bg-surface-container-high'}`}>
                  <span className={`material-symbols-outlined text-[14px] ${t.changePercent >= 0 ? 'text-primary' : 'text-on-surface-muted'}`}>trending_up</span>
                </div>
                <span className="font-bold text-on-surface text-sm">{t.symbol}</span>
                <span className="text-on-surface-muted text-sm font-mono">{t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className={`text-sm font-mono ${t.changePercent >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                  {t.changePercent >= 0 ? '+' : ''}{t.changePercent}%
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Feed Posts */}
        <div className="flex flex-col gap-6 px-4 md:px-0">
          {posts.map(post => (
            <Card key={post.id}>
              {/* Post Header */}
              <div className="p-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <img src={post.userAvatar} alt={post.username} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <span className="font-semibold text-sm text-on-surface flex items-center gap-1">
                      {post.username}
                      {post.isVerified && <span className="material-symbols-outlined text-primary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>}
                    </span>
                    <span className="text-xs text-on-surface-muted">{post.timestamp}</span>
                  </div>
                </div>
                <button className="text-on-surface-muted hover:text-on-surface transition-colors">
                  <span className="material-symbols-outlined">more_horiz</span>
                </button>
              </div>

              {/* Image */}
              <div className="w-full aspect-video bg-surface-container-low relative">
                <img src={post.image} alt="Post" className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded flex items-center gap-1">
                  <span className="font-mono text-xs text-on-surface">{post.ticker}</span>
                  <span className={`font-mono text-xs ${post.tickerChange.startsWith('+') ? 'text-bullish' : 'text-bearish'}`}>{post.tickerChange}</span>
                </div>
              </div>

              {/* Actions & Caption */}
              <div className="p-3 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="flex gap-4">
                    <button onClick={() => toggleLike(post.id)} className="text-on-surface-muted hover:text-primary transition-colors flex items-center gap-1">
                      <span className="material-symbols-outlined" style={post.isLiked ? { fontVariationSettings: "'FILL' 1", color: '#EF4444' } : {}}>favorite</span>
                      <span className="font-mono text-xs">{post.likes.toLocaleString()}</span>
                    </button>
                    <button className="text-on-surface-muted hover:text-primary transition-colors flex items-center gap-1">
                      <span className="material-symbols-outlined">chat_bubble</span>
                      <span className="font-mono text-xs">{post.comments}</span>
                    </button>
                    <button className="text-on-surface-muted hover:text-primary transition-colors">
                      <span className="material-symbols-outlined">send</span>
                    </button>
                  </div>
                  <button onClick={() => toggleBookmark(post.id)} className="text-on-surface-muted hover:text-primary transition-colors">
                    <span className="material-symbols-outlined" style={post.isBookmarked ? { fontVariationSettings: "'FILL' 1" } : {}}>bookmark</span>
                  </button>
                </div>
                <div className="text-sm text-on-surface">
                  <span className="font-bold mr-1">{post.username}</span>
                  {post.content}
                </div>
                <button className="text-on-surface-muted text-sm text-left">View all {post.comments} comments</button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:block md:col-span-4 lg:col-span-3">
        <Card className="p-4 sticky top-24">
          <h3 className="font-semibold text-on-surface border-b border-outline-variant/30 pb-2 mb-3">Trending Tickers</h3>
          <div className="flex flex-col gap-2">
            {mockTickers.slice(0, 8).map(t => (
              <Link key={t.symbol} to={`/market/${t.symbol}`} className="flex justify-between items-center hover:bg-white/5 rounded-lg px-2 py-1 transition-colors">
                <span className="font-mono text-sm text-on-surface">${t.symbol}</span>
                <span className={`font-mono text-sm ${t.changePercent >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                  {t.changePercent >= 0 ? '+' : ''}{t.changePercent}%
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  )
}
