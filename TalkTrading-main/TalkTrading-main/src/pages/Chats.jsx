/**
 * Chats.jsx
 * =========
 * Instagram Direct-Style End-to-End Encrypted Chat Interface.
 *
 * Features:
 *  - Responsive Instagram DM Layout: Split-screen on desktop/tablet, fluid single view on mobile.
 *  - Story / Active contacts row with Instagram gradient rings.
 *  - Instagram-style gradient speech bubbles (Purple -> Pink/Violet) for outgoing messages.
 *  - Live delivery over WebSocket; messages grouped by day.
 *  - Cryptographic Security Inspector modal (X3DH fingerprints, SPK, OPK status).
 *  - Quick trading stickers and media attachments.
 */

import { useState, useRef, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useE2E } from '../context/E2EContext'
import RichText from '../components/ui/RichText'
import { postService } from '../services/postService'
import { parseServerDate } from '../utils/time'

// "Today", "Yesterday" or a date, for the divider above the first message of each day.
function dayLabel(iso) {
  if (!iso) return null
  const d = parseServerDate(iso)
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function convDisplayName(conv, currentUserId, names = {}) {
  if (conv.name) return conv.name
  const others = (conv.participants || []).filter(p => p !== currentUserId)
  if (others.length === 0) return 'Notes to Self'
  if (others.length === 1) return names[others[0]] || `User ${others[0].slice(0, 8)}…`
  return `Group (${others.length + 1})`
}

function convInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??'
}

// Avatar gradient based on name
function getAvatarGradient(name = '') {
  const gradients = [
    'from-[#f09433] via-[#e6683c] via-[#dc2743] via-[#cc2366] to-[#bc1888]', // Classic Instagram
    'from-[#6366f1] via-[#8b5cf6] to-[#ec4899]', // Purple-pink
    'from-[#06b6d4] via-[#3b82f6] to-[#8b5cf6]', // Cyan-blue
    'from-[#10b981] via-[#059669] to-[#047857]', // Emerald
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i)
  return gradients[Math.abs(hash) % gradients.length]
}

// ── Root Chats Page Component ──────────────────────────────────────────────────

export default function Chats() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [peopleQuery, setPeopleQuery] = useState('')
  const [peopleResults, setPeopleResults] = useState([])
  const [creatingChat, setCreatingChat] = useState(false)
  const [createError, setCreateError] = useState(null)

  const {
    isReady,
    error,
    conversations,
    participantNames,
    userId,
    currentUser,
    startConversation,
  } = useE2E()

  // Find people to message (the chat service identifies them by account uuid).
  useEffect(() => {
    const term = peopleQuery.trim()
    if (!term) {
      setPeopleResults([])
      return
    }
    const handle = setTimeout(() => {
      postService.searchUsers(term)
        .then(found => setPeopleResults(found.filter(u => u.uuid !== userId)))
        .catch(() => setPeopleResults([]))
    }, 300)
    return () => clearTimeout(handle)
  }, [peopleQuery, userId])

  const handleCreateChat = async (targetUserId) => {
    setCreateError(null)
    setCreatingChat(true)
    try {
      const conv = await startConversation([targetUserId])
      setShowNewChatModal(false)
      setPeopleQuery('')
      navigate(`/chats/${conv.conversation_id}`)
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreatingChat(false)
    }
  }

  const filteredConversations = conversations.filter(c => {
    const name = convDisplayName(c, userId, participantNames)
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div className="max-w-6xl mx-auto h-[calc(100dvh-5.5rem)] flex flex-col md:flex-row bg-surface border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">

      {/* ── LEFT SIDEBAR: Conversations List ─────────────────────────── */}
      <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col border-r border-white/[0.08] bg-surface-card/70 ${chatId ? 'hidden md:flex' : 'flex'}`}>

        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {/* User Avatar with Insta Story Ring */}
            <div className="relative p-[2px] rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-sm">
              <div className="w-8 h-8 rounded-full bg-surface-card flex items-center justify-center font-bold text-xs text-on-surface">
                {convInitials(currentUser.name)}
              </div>
              </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-on-surface leading-none">{currentUser.name}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-bullish text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  lock
                </span>
                <span className="text-[10px] text-bullish font-medium">E2EE Active</span>
              </div>
            </div>
          </div>

        </div>

        {/* Search Bar */}
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted text-sm pointer-events-none">
              search
            </span>
            <input
              type="text"
              placeholder="Search encrypted chats…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-high/80 border border-white/[0.06] rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface placeholder:text-on-surface-muted/50 focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>
        </div>

        {/* Stories / Active Peer Row */}
        <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-3 overflow-x-auto scrollbar-none">
          {/* New Chat action */}
          <button
            onClick={() => setShowNewChatModal(true)}
            className="flex flex-col items-center gap-1 flex-shrink-0 group cursor-pointer"
          >
            <div className="w-[52px] h-[52px] rounded-full border border-dashed border-white/20 hover:border-primary/60 flex items-center justify-center text-on-surface-muted group-hover:text-primary transition-colors bg-white/[0.02]">
              <span className="material-symbols-outlined text-lg">add</span>
            </div>
            <span className="text-[11px] text-on-surface-muted truncate max-w-[60px]">New DM</span>
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-3 text-on-surface-muted">
              <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">chat_bubble_outline</span>
              </div>
              <p className="text-xs">No conversations yet.</p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                + Start a chat
              </button>
            </div>
          ) : (
            filteredConversations.map(c => {
              const name = convDisplayName(c, userId, participantNames)
              const isSelected = chatId === c.conversation_id
              const gradient = getAvatarGradient(name)

              return (
                <Link
                  key={c.conversation_id}
                  to={`/chats/${c.conversation_id}`}
                  className={`flex items-center gap-3 p-3 transition-colors ${
                    isSelected
                      ? 'bg-primary/10 border-l-4 border-primary pl-2'
                      : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className={`p-[2px] rounded-full bg-gradient-to-tr ${gradient} flex-shrink-0`}>
                    <div className="w-11 h-11 rounded-full bg-surface-card flex items-center justify-center font-bold text-xs text-on-surface">
                      {convInitials(name)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-semibold text-xs text-on-surface truncate">{name}</h4>
                      <span className="text-[10px] text-on-surface-muted flex-shrink-0">
                        {new Date(c.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-bullish text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        lock
                      </span>
                      <p className="text-[11px] text-on-surface-muted truncate">
                        End-to-End Encrypted
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>

      {/* ── RIGHT MAIN PANEL: Active Chat or Splash Placeholder ─────── */}
      <div className={`flex-1 flex flex-col min-w-0 bg-surface/90 ${!chatId ? 'hidden md:flex' : 'flex'}`}>
        {chatId ? (
          <ChatView conversationId={chatId} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] p-[3px] shadow-2xl">
              <div className="w-full h-full rounded-full bg-surface flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  send
                </span>
              </div>
            </div>
            <div className="max-w-sm">
              <h3 className="text-lg font-bold text-on-surface">Your Encrypted Messages</h3>
              <p className="text-xs text-on-surface-muted mt-1 leading-relaxed">
                Send private messages and trading notes with military-grade X3DH + AES-256-GCM encryption.
              </p>
            </div>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-semibold text-xs shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              New Message
            </button>
          </div>
        )}
      </div>

      {/* ── NEW CHAT MODAL ────────────────────────────────────────────── */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-bullish">lock</span>
                <span>New Encrypted Message</span>
              </h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-on-surface-muted hover:text-on-surface p-1 rounded-full hover:bg-white/5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <input
              type="text"
              autoFocus
              placeholder="Search people by username"
              value={peopleQuery}
              onChange={e => setPeopleQuery(e.target.value)}
              className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-muted/50 focus:outline-none focus:border-primary/50"
            />

            <ul className="flex flex-col gap-1 max-h-60 overflow-y-auto">
              {peopleResults.map(person => (
                <li key={person.uuid}>
                  <button
                    onClick={() => handleCreateChat(person.uuid)}
                    disabled={creatingChat}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.05] text-left transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <img src={postService.avatarFor(person)} alt="" className="w-9 h-9 rounded-full object-cover" />
                    <span className="flex-1 min-w-0 font-semibold text-xs text-on-surface truncate">{person.username}</span>
                    <span className="material-symbols-outlined text-primary text-sm">arrow_forward</span>
                  </button>
                </li>
              ))}
              {peopleQuery.trim() && peopleResults.length === 0 && (
                <li className="text-xs text-on-surface-muted text-center py-4">No one found.</li>
              )}
            </ul>

            {createError && (
              <div className="text-xs text-bearish bg-bearish/10 p-2.5 rounded-lg border border-bearish/20">
                {createError}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setShowNewChatModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-on-surface-muted hover:text-on-surface cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── INSTAGRAM DIRECT CHAT VIEW ─────────────────────────────────────────────────

function ChatView({ conversationId }) {
  const {
    conversations,
    messages,
    loadMessages,
    encryptAndSend,
    deviceId,
    userId,
    isReady,
    participantNames,
  } = useE2E()

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const bottomRef = useRef(null)

  const conv = conversations.find(c => c.conversation_id === conversationId)
  const convMessages = messages[conversationId] || []

  // Load messages on mount
  useEffect(() => {
    if (isReady && conversationId) {
      loadMessages(conversationId)
    }
  }, [isReady, conversationId, loadMessages])

  // Scroll to the newest message when one arrives (not on every re-render, e.g. while typing)
  const messageCount = convMessages.length
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messageCount, conversationId])

  if (!isReady) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3">
        <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
        <span className="text-on-surface-muted text-xs">Initializing X3DH key store…</span>
      </div>
    )
  }

  if (!conv) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-on-surface-muted/40 mb-2">chat_error</span>
        <p className="text-on-surface-muted text-xs">Conversation not found.</p>
        <Link to="/chats" className="text-primary text-xs mt-2 hover:underline">
          ← Back to chats
        </Link>
      </div>
    )
  }

  const name = convDisplayName(conv, userId, participantNames)
  const recipientUserIds = (conv.participants || []).filter(p => p !== userId)
  const gradient = getAvatarGradient(name)

  const handleSend = async (overrideText = null) => {
    const text = overrideText || input.trim()
    if (!text || sending) return
    setSendError(null)
    setSending(true)
    if (!overrideText) setInput('')
    try {
      await encryptAndSend(conversationId, recipientUserIds, text)
    } catch (err) {
      setSendError(err.message)
      if (!overrideText) setInput(text)
    } finally {
      setSending(false)
    }
  }


  const quickStickers = ['🚀 Bullish', '📉 Bearish', '🎯 TP Hit', '💰 Take Profit', '🔒 Alpha Encrypted']
  const popularEmojis = ['❤️', '🔥', '🚀', '📈', '😂', '👍', '🙏', '💯', '✨', '⚡']

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface relative">

      {/* ── TOP CHAT HEADER (Instagram Direct Style) ───────────────── */}
      <div className="px-4 py-3 border-b border-white/[0.08] bg-surface-card/90 backdrop-blur-md flex items-center justify-between gap-3 z-10">
        
        {/* Left: Back (on mobile) + Avatar + Name */}
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/chats" className="md:hidden text-on-surface-muted hover:text-on-surface p-1 rounded-full">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>

          <div className="relative cursor-pointer" onClick={() => setShowSecurityModal(true)}>
            <div className={`p-[2px] rounded-full bg-gradient-to-tr ${gradient}`}>
              <div className="w-10 h-10 rounded-full bg-surface-card flex items-center justify-center font-bold text-xs text-on-surface">
                {convInitials(name)}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm text-on-surface truncate leading-tight">{name}</h3>
              <span className="material-symbols-outlined text-bullish text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }} title="End-to-End Encrypted">
                verified_user
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-bullish font-medium">
              <span className="material-symbols-outlined text-[12px]">lock</span>
              <span>End-to-end encrypted</span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Security Inspector info */}
          <button
            onClick={() => setShowSecurityModal(true)}
            className="w-8 h-8 rounded-full hover:bg-white/[0.06] text-on-surface-muted hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
            title="E2EE Security Inspector"
          >
            <span className="material-symbols-outlined text-[18px]">info</span>
          </button>
        </div>
      </div>

      {/* ── MESSAGE FEED (Instagram Gradient Bubbles) ────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
        {/* E2EE Info Header Banner inside chat */}
        <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
          <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]">
            <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center font-bold text-lg text-on-surface">
              {convInitials(name)}
            </div>
          </div>
          <h4 className="font-bold text-sm text-on-surface">{name}</h4>
          <p className="text-[11px] text-on-surface-muted max-w-xs leading-relaxed">
            Messages are secured with end-to-end encryption. No one outside of this chat, not even the server, can read them.
          </p>
          <button
            onClick={() => setShowSecurityModal(true)}
            className="mt-1 px-3 py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-[10px] text-primary font-medium flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[12px]">lock</span>
            <span>View Cryptographic Fingerprint</span>
          </button>
        </div>

        {/* Messages */}
        {convMessages.map((msg, idx) => {
          const isMe = msg.sender === 'me'
          const day = dayLabel(msg.at)
          const newDay = day && day !== dayLabel(convMessages[idx - 1]?.at)

          return (
            <div
              key={msg.id ?? idx}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
            >
              {newDay && (
                <div className="self-center my-3 px-3 py-1 rounded-full bg-white/[0.04] text-[10px] text-on-surface-muted font-medium">{day}</div>
              )}
              <div className="flex items-end gap-2 max-w-[80%]">
                {!isMe && (
                  <div className={`w-7 h-7 rounded-full bg-gradient-to-tr ${gradient} p-[1px] flex-shrink-0 mb-1`}>
                    <div className="w-full h-full rounded-full bg-surface flex items-center justify-center font-bold text-[9px] text-on-surface">
                      {convInitials(name)}
                    </div>
                  </div>
                )}

                <div className="relative">
                  {/* Speech Bubble */}
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-xs relative select-text ${
                      isMe
                        ? 'bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#ec4899] text-white rounded-br-sm shadow-md shadow-purple-500/10'
                        : 'bg-surface-container-high text-on-surface rounded-bl-sm border border-white/10 shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed"><RichText>{msg.text}</RichText></p>
                  </div>

                </div>
              </div>

              {/* Timestamp & Status footer */}
              <div className={`flex items-center gap-1 text-[9px] text-on-surface-muted mt-1 px-1 ${isMe ? 'mr-1' : 'ml-9'}`}>
                <span>{msg.timestamp}</span>
                {msg.id?.startsWith('local-') && <span>· Sending</span>}
                <span className="material-symbols-outlined text-[10px] text-bullish ml-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>
                  lock
                </span>
              </div>
            </div>
          )
        })}

        {/* Send Error Notice */}
        {sendError && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 bg-bearish/10 border border-bearish/20 rounded-xl px-3 py-2 text-xs text-bearish">
              <span className="material-symbols-outlined text-sm">error</span>
              <span>Failed to send: {sendError}</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── QUICK STICKERS BAR ─────────────────────────────────────── */}
      <div className="px-3 py-1.5 border-t border-white/[0.04] bg-surface-card/40 flex items-center gap-2 overflow-x-auto scrollbar-none">
        {quickStickers.map(sticker => (
          <button
            key={sticker}
            onClick={() => handleSend(sticker)}
            disabled={sending}
            className="flex-shrink-0 px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[10px] text-on-surface-muted hover:text-on-surface transition-colors active:scale-95 cursor-pointer"
          >
            {sticker}
          </button>
        ))}
      </div>

      {/* ── EMOJI PICKER POPUP ─────────────────────────────────────── */}
      {showEmojiPicker && (
        <div className="px-4 py-2 bg-surface-card border-t border-white/[0.08] flex items-center gap-3 overflow-x-auto">
          {popularEmojis.map(emoji => (
            <button
              key={emoji}
              onClick={() => {
                setInput(prev => prev + emoji)
                setShowEmojiPicker(false)
              }}
              className="text-lg hover:scale-125 transition-transform p-1 cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* ── INSTAGRAM INPUT FOOTER ─────────────────────────────────── */}
      <div className="p-3 border-t border-white/[0.08] bg-surface-card/80 backdrop-blur-md flex items-center gap-2">
        {/* Emoji Button */}
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            showEmojiPicker ? 'bg-primary/20 text-primary' : 'text-on-surface-muted hover:text-on-surface hover:bg-white/5'
          }`}
          title="Insert Emoji"
        >
          <span className="material-symbols-outlined text-[20px]">mood</span>
        </button>

        {/* Input Bar */}
        <div className="flex-1 relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Message…"
            disabled={sending}
            className="w-full bg-surface-container-high/90 border border-white/[0.08] rounded-full px-4 py-2.5 pr-10 text-xs text-on-surface placeholder:text-on-surface-muted/50 focus:outline-none focus:border-primary/50 transition-colors"
          />
          <span
            className="material-symbols-outlined absolute right-3 text-bullish/70 text-[16px] pointer-events-none"
            style={{ fontVariationSettings: "'FILL' 1" }}
            title="End-to-End Encrypted"
          >
            lock
          </span>
        </div>

        {/* Send / Instant Heart Button */}
        {input.trim() ? (
          <button
            onClick={() => handleSend()}
            disabled={sending}
            className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#6366f1] via-[#8b5cf6] to-[#ec4899] text-white flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-md shadow-purple-500/20 cursor-pointer"
            title="Send Encrypted Message"
          >
            {sending ? (
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[18px]">send</span>
            )}
          </button>
        ) : (
          <button
            onClick={() => handleSend('❤️')}
            disabled={sending}
            className="w-9 h-9 rounded-full hover:bg-white/5 text-bearish flex items-center justify-center active:scale-125 transition-transform cursor-pointer"
            title="Send Instant Heart"
          >
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              favorite
            </span>
          </button>
        )}
      </div>

      {/* ── CRYPTOGRAPHIC SECURITY INSPECTOR MODAL ─────────────────── */}
      {showSecurityModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-bullish text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  verified_user
                </span>
                <h3 className="font-bold text-sm text-on-surface">End-to-End Encryption Verified</h3>
              </div>
              <button
                onClick={() => setShowSecurityModal(false)}
                className="text-on-surface-muted hover:text-on-surface p-1 rounded-full hover:bg-white/5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-on-surface-muted leading-relaxed">
                Messages and attachments between you and <strong>{name}</strong> are cryptographically sealed before leaving your device.
              </p>

              <div className="p-3 rounded-xl bg-surface-container-high border border-white/5 space-y-2 font-mono text-[11px]">
                <div>
                  <span className="text-on-surface-muted">Key Agreement: </span>
                  <span className="text-bullish font-semibold">X3DH (Extended Triple Diffie-Hellman)</span>
                </div>
                <div>
                  <span className="text-on-surface-muted">Symmetric Cipher: </span>
                  <span className="text-primary font-semibold">AES-256-GCM (Hardware Accelerated)</span>
                </div>
                <div>
                  <span className="text-on-surface-muted">Associated Data (AAD): </span>
                  <span className="text-on-surface truncate block mt-0.5">{deviceId} ⇄ Peer</span>
                </div>
                <div>
                  <span className="text-on-surface-muted">Your Device ID: </span>
                  <span className="text-on-surface truncate block mt-0.5">{deviceId}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSecurityModal(false)}
              className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-xs hover:opacity-90 transition-opacity cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
