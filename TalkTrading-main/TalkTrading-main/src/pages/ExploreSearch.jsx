import { useState } from 'react'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import mockUsers from '../data/mockUsers'
import mockPosts from '../data/mockPosts'
import mockNews from '../data/mockNews'

const trendingTags = ['#EarningsSeason', '#TechStocks', '$NVDA', '#OptionsTrading', 'Macro', '#Crypto', '#SwingTrade']

export default function ExploreSearch() {
  const [search, setSearch] = useState('')
  const [following, setFollowing] = useState({})
  const [activeTag, setActiveTag] = useState(null)

  const toggleFollow = (userId) => {
    setFollowing(prev => ({ ...prev, [userId]: !prev[userId] }))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-8">
      <Input placeholder="Search traders, posts, or symbols" value={search} onChange={e => setSearch(e.target.value)} />

      {/* Suggested Traders */}
      <section>
        <h2 className="font-semibold text-on-surface mb-4">Suggested for you</h2>
        <div className="flex overflow-x-auto hide-scrollbar gap-4 pb-2">
          {mockUsers.slice(0, 5).map(user => (
            <Card key={user.id} className="p-4 min-w-[200px] flex flex-col items-center shrink-0">
              <div className="w-16 h-16 rounded-full overflow-hidden mb-3">
                <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
              </div>
              <div className="text-center mb-1">
                <h3 className="text-sm font-semibold text-on-surface flex items-center justify-center gap-1">
                  {user.username}
                  {user.isVerified && (
                    <span className="material-symbols-outlined text-primary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  )}
                </h3>
                <p className="font-mono text-xs text-on-surface-muted">{user.ytdReturn} YTD</p>
              </div>
              <button
                onClick={() => toggleFollow(user.id)}
                className={`mt-3 w-full py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ${
                  following[user.id]
                    ? 'bg-surface-container-high text-on-surface border border-white/[0.06]'
                    : 'bg-primary text-on-primary hover:brightness-110'
                }`}
              >
                {following[user.id] ? 'Following' : 'Follow'}
              </button>
            </Card>
          ))}
        </div>
      </section>

      {/* Trending Tags */}
      <section>
        <div className="flex flex-wrap gap-3">
          {trendingTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                activeTag === tag
                  ? 'text-on-surface ring-1 ring-white/10 bg-white/5'
                  : 'text-on-surface-muted hover:text-on-surface'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      {/* Explore Grid (Bento) */}
      <section>
        <h2 className="font-semibold text-on-surface mb-4">Trending Analysis</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-[200px]">
          {/* Featured */}
          <div className="col-span-2 row-span-2 rounded-xl overflow-hidden relative group cursor-pointer bg-surface-card">
            <img src={mockPosts[0].image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-0 left-0 w-full p-6 z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 bg-surface-card/80 rounded font-mono text-xs text-on-surface">${mockPosts[0].ticker}</span>
                <span className="px-2 py-1 bg-surface-card/80 rounded font-mono text-xs text-on-surface">Bullish</span>
              </div>
              <h3 className="font-semibold text-white mb-1">{mockPosts[0].content.substring(0, 60)}...</h3>
              <p className="text-sm text-white/60">by @{mockPosts[0].username} • {mockPosts[0].timestamp}</p>
            </div>
          </div>

          {/* Text Post */}
          <Card hover className="p-4 flex flex-col justify-between cursor-pointer">
            <div className="flex justify-between items-start">
              <div className="font-mono text-xs text-on-surface-muted">${mockPosts[3].ticker}</div>
              <span className="material-symbols-outlined text-[18px] text-on-surface-muted">bookmark</span>
            </div>
            <div>
              <p className="text-sm text-on-surface line-clamp-3 mb-2">{mockPosts[3].content}</p>
              <div className="flex items-center gap-3 text-on-surface-muted/60">
                <span className="flex items-center gap-1 font-mono text-xs">
                  <span className="material-symbols-outlined text-[14px]">favorite</span>{(mockPosts[3].likes / 1000).toFixed(1)}k
                </span>
                <span className="flex items-center gap-1 font-mono text-xs">
                  <span className="material-symbols-outlined text-[14px]">chat_bubble</span>{mockPosts[3].comments}
                </span>
              </div>
            </div>
          </Card>

          {/* Chart Snippet */}
          <div className="rounded-xl overflow-hidden relative group cursor-pointer bg-surface-card">
            <img src={mockPosts[2].image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-40" />
            <div className="absolute inset-0 p-4 flex flex-col justify-between z-10">
              <div className="font-mono text-xs text-on-surface-muted">${mockPosts[2].ticker}</div>
              <div className="font-semibold text-on-surface">{mockPosts[2].tickerChange}</div>
            </div>
          </div>

          {/* News Card */}
          <Card hover className="col-span-2 md:col-span-1 p-4 flex flex-col justify-between cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[14px] text-on-surface-muted">newspaper</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-muted">Macro Update</span>
            </div>
            <p className="text-sm text-on-surface/80">{mockNews[7].title}</p>
          </Card>

          {/* Extra Post */}
          <Card hover className="p-4 flex flex-col justify-between cursor-pointer">
            <div className="flex justify-between items-start">
              <div className="font-mono text-xs text-on-surface-muted">${mockPosts[5].ticker}</div>
              <span className="material-symbols-outlined text-[18px] text-on-surface-muted">bookmark</span>
            </div>
            <div>
              <p className="text-sm text-on-surface line-clamp-3 mb-2">{mockPosts[5].content.substring(0, 80)}...</p>
              <span className="flex items-center gap-1 font-mono text-xs text-on-surface-muted/60">
                <span className="material-symbols-outlined text-[14px]">favorite</span>{mockPosts[5].likes}
              </span>
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}
