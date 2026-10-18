import { useState } from 'react'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import mockCommunities from '../data/mockCommunities'

export default function Communities() {
  const [search, setSearch] = useState('')
  const [communities, setCommunities] = useState(mockCommunities)

  const toggleJoin = (id) => {
    setCommunities(prev => prev.map(c => c.id === id ? { ...c, isJoined: !c.isJoined } : c))
  }

  const myGroups = communities.filter(c => c.isJoined && (!search || c.name.toLowerCase().includes(search.toLowerCase())))
  const discover = communities.filter(c => !c.isJoined && (!search || c.name.toLowerCase().includes(search.toLowerCase())))

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-8">
      <Input placeholder="Search communities..." value={search} onChange={e => setSearch(e.target.value)} />

      {/* My Groups */}
      {myGroups.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-4">My Groups</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myGroups.map(comm => (
              <Card key={comm.id} hover className="p-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <img src={comm.icon} alt={comm.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-on-surface text-sm">{comm.name}</h4>
                        <p className="font-mono text-xs text-on-surface-muted">{(comm.memberCount / 1000).toFixed(1)}K Members</p>
                      </div>
                    </div>
                    {comm.isPro && <Badge variant="pro">PRO</Badge>}
                  </div>
                  <p className="text-sm text-on-surface-muted/80 line-clamp-2 mb-4">{comm.description}</p>
                </div>
                <div className="flex justify-between items-end">
                  <div className="flex -space-x-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="w-6 h-6 rounded-full bg-surface-container-high border border-background" />
                    ))}
                    <div className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-[10px] text-on-surface border border-background">+3</div>
                  </div>
                  <Button variant="primary" size="sm">Enter</Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Discover */}
      {discover.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-4">Discover</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {discover.map(comm => (
              <Card key={comm.id} hover className="p-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <img src={comm.icon} alt={comm.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-on-surface text-sm">{comm.name}</h4>
                        <p className="font-mono text-xs text-on-surface-muted">{(comm.memberCount / 1000).toFixed(1)}K Members</p>
                      </div>
                    </div>
                    {comm.isPro && <Badge variant="pro">PRO</Badge>}
                  </div>
                  <p className="text-sm text-on-surface-muted/80 line-clamp-2 mb-4">{comm.description}</p>
                </div>
                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" onClick={() => toggleJoin(comm.id)}>Join</Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
