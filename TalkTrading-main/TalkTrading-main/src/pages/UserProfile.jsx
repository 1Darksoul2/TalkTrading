import { useState } from 'react'
import Card from '../components/ui/Card'
import TabBar from '../components/ui/TabBar'
import Button from '../components/ui/Button'
import mockUsers from '../data/mockUsers'
import mockPosts from '../data/mockPosts'

const user = mockUsers[1] // alex_quant
const formatNum = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : n

const tabs = [
  { id: 'posts', label: 'Posts' },
  { id: 'replies', label: 'Replies' },
  { id: 'media', label: 'Media' },
]

export default function UserProfile() {
  const [activeTab, setActiveTab] = useState('posts')
  const userPosts = mockPosts.filter(p => p.userId === user.id || activeTab !== 'posts')

  return (
    <div className="max-w-4xl mx-auto px-4 space-y-6">
      {/* Profile Header */}
      <section className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 rounded-full p-[2px] bg-gradient-to-br from-primary to-primary-container flex-shrink-0">
            <img src={user.avatar} alt={user.displayName} className="w-full h-full rounded-full object-cover border-2 border-background" />
            <div className="absolute bottom-0 right-0 bg-surface-container-high rounded-full p-0.5 border border-primary/30">
              <span className="material-symbols-outlined text-[14px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-on-surface">{user.displayName}</h2>
            <p className="text-sm text-on-surface-muted">Pro Trader & Analyst</p>
          </div>
        </div>
        <div className="flex gap-6 text-center">
          <div className="flex flex-col items-center">
            <span className="font-mono font-bold text-on-surface">{user.stats.posts}</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-muted">Posts</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-mono font-bold text-on-surface">{formatNum(user.stats.followers)}</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-muted">Followers</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-mono font-bold text-on-surface">{user.stats.following}</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-muted">Following</span>
          </div>
          <div className="flex items-center">
            <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-[10px] font-bold text-on-surface border border-outline-variant/30">
              {user.stats.winRate}% WIN RATE
            </span>
          </div>
        </div>
      </section>

      {/* Bio */}
      <section className="text-sm text-on-surface-muted leading-relaxed">
        {user.bio}<br />
        <a href="#" className="font-mono text-on-surface hover:underline">linktr.ee/{user.username}</a>
      </section>

      {/* Actions */}
      <section className="flex gap-4">
        <Button variant="primary" className="flex-1" icon="add_photo_alternate">Upload Post</Button>
        <Button variant="secondary" className="flex-1" icon="edit_document">Write Text Post</Button>
      </section>

      {/* Tabs */}
      <div className="mt-4">
        <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="underline" />
      </div>

      {/* Post Grid */}
      <section className="grid grid-cols-3 gap-1 md:gap-2">
        {mockPosts.map((post, i) => (
          <div key={post.id} className="aspect-square relative group rounded-md overflow-hidden bg-surface-card cursor-pointer">
            {i % 3 === 1 ? (
              /* Text post */
              <div className="p-3 flex flex-col justify-between h-full">
                <p className="text-[10px] md:text-sm text-on-surface-muted line-clamp-4">{post.content}</p>
                <div className="flex justify-between items-center mt-2 text-on-surface-muted/60">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">favorite</span>
                    <span className="font-mono text-[10px]">{post.likes >= 1000 ? (post.likes / 1000).toFixed(1) + 'k' : post.likes}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">chat_bubble</span>
                    <span className="font-mono text-[10px]">{post.comments}</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Image post */
              <>
                <img src={post.image} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                  <span className="font-mono text-xs text-primary">${post.ticker}</span>
                </div>
              </>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
