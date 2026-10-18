import { useState, useEffect, useCallback } from 'react'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { communityService } from '../services/communityService'
import { DEFAULT_GROUP_ICON } from '../utils/defaultAvatar'
import { useAuth } from '../context/AuthContext'

export default function Communities() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadCommunities = useCallback(async () => {
    if (!user?.authorId) return
    setLoading(true)
    setError('')
    try {
      const list = await communityService.listCommunities({ search, userId: user.authorId })
      setCommunities(list)
    } catch (err) {
      setError(err.message)
      setCommunities([])
    } finally {
      setLoading(false)
    }
  }, [search, user?.authorId])

  useEffect(() => {
    loadCommunities()
  }, [loadCommunities])

  const toggleJoin = async (community) => {
    try {
      if (community.isMember) {
        await communityService.leaveCommunity(community.id, user.authorId)
      } else {
        await communityService.joinCommunity(community.id, user.authorId)
      }
      await loadCommunities()
    } catch (err) {
      alert(`Could not update membership: ${err.message}`)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setIsSubmitting(true)
    try {
      await communityService.createCommunity(
        { name: newName.trim(), description: newDescription.trim() },
        user.authorId
      )
      setNewName('')
      setNewDescription('')
      setIsCreateOpen(false)
      await loadCommunities()
    } catch (err) {
      alert(`Could not create community: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const myGroups = communities.filter(c => c.isMember)
  const discover = communities.filter(c => !c.isMember)

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-8">
      <div className="flex gap-3 items-center">
        <Input placeholder="Search communities..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
        <Button variant="primary" icon="add" onClick={() => setIsCreateOpen(true)}>New</Button>
      </div>

      {error && (
        <p className="text-xs text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
          Community Service unavailable: {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-on-surface-muted text-center py-12">Loading communities…</p>
      ) : communities.length === 0 && !error ? (
        <p className="text-sm text-on-surface-muted text-center py-12">No communities yet. Be the first to create one.</p>
      ) : (
        <>
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
                          <img
                            src={comm.icon || DEFAULT_GROUP_ICON}
                            alt={comm.name}
                            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                          />
                          <div>
                            <h4 className="font-semibold text-on-surface text-sm">{comm.name}</h4>
                            <p className="font-mono text-xs text-on-surface-muted">
                              {comm.memberCount} {comm.memberCount === 1 ? 'Member' : 'Members'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-on-surface-muted/80 line-clamp-2 mb-4">{comm.description || 'No description yet.'}</p>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">{comm.currentUserRole}</span>
                      <Button variant="secondary" size="sm" onClick={() => toggleJoin(comm)}>Leave</Button>
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
                          <img
                            src={comm.icon || DEFAULT_GROUP_ICON}
                            alt={comm.name}
                            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                          />
                          <div>
                            <h4 className="font-semibold text-on-surface text-sm">{comm.name}</h4>
                            <p className="font-mono text-xs text-on-surface-muted">
                              {comm.memberCount} {comm.memberCount === 1 ? 'Member' : 'Members'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-on-surface-muted/80 line-clamp-2 mb-4">{comm.description || 'No description yet.'}</p>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="secondary" size="sm" onClick={() => toggleJoin(comm)}>Join</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Create Community Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card max-w-md w-full rounded-2xl p-6 border border-white/10 shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-on-surface">Create Community</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-on-surface-muted hover:text-on-surface p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-on-surface-muted uppercase mb-1.5 block">Name</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Options Kings"
                  className="w-full bg-surface-container-low border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted/50 focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface-muted uppercase mb-1.5 block">Description</label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="What is this community about?"
                  className="w-full bg-surface-container-low border border-white/10 rounded-xl p-3 text-sm text-on-surface placeholder:text-on-surface-muted/50 focus:outline-none focus:border-primary/50 resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-xs text-on-surface-muted hover:text-on-surface">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || newName.trim().length < 3}
                  className="px-6 py-2 bg-primary text-black text-xs font-bold rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-40"
                >
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
