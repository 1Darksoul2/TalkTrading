import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Card from '../components/ui/Card'
import TabBar from '../components/ui/TabBar'
import mockChats from '../data/mockChats'

const chatTabs = [{ id: 'private', label: 'Private' }, { id: 'groups', label: 'Groups' }]

export default function Chats() {
  const { chatId } = useParams()
  const [activeTab, setActiveTab] = useState('private')

  if (chatId) {
    return <ChatView chatId={parseInt(chatId)} />
  }

  return (
    <div className="max-w-2xl mx-auto px-4 flex flex-col gap-4">
      <TabBar tabs={chatTabs} activeTab={activeTab} onChange={setActiveTab} variant="pill" />

      {/* Restriction Notice */}
      <Card className="flex items-center gap-2 p-3">
        <span className="material-symbols-outlined text-on-surface-muted text-sm">lock</span>
        <p className="text-sm text-on-surface-muted">Chatting with traders you follow</p>
      </Card>

      {/* Chat List */}
      <div className="flex flex-col gap-2">
        {mockChats.map(chat => (
          <Link key={chat.id} to={`/chats/${chat.id}`}>
            <Card hover className="p-4 flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <img src={chat.user.avatar} alt={chat.user.name} className="w-12 h-12 rounded-full object-cover" />
                {chat.user.online && (
                  <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-[2px]">
                    <span className="block w-3 h-3 bg-bullish rounded-full" />
                  </div>
                )}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className="font-semibold text-on-surface truncate">{chat.user.name}</h3>
                  <span className="font-mono text-xs text-on-surface-muted flex-shrink-0 ml-2">{chat.timestamp}</span>
                </div>
                <p className="text-sm text-on-surface-muted truncate">{chat.lastMessage}</p>
              </div>
              {chat.unreadCount > 0 && (
                <div className="bg-primary text-on-primary font-mono text-[10px] font-bold px-2 py-1 rounded-full min-w-[24px] text-center flex-shrink-0">
                  {chat.unreadCount}
                </div>
              )}
            </Card>
          </Link>
        ))}
      </div>

      {/* FAB */}
      <button className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary flex items-center justify-center z-40 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/30">
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add_comment</span>
      </button>
    </div>
  )
}

function ChatView({ chatId }) {
  const chat = mockChats.find(c => c.id === chatId)
  const [messages, setMessages] = useState(chat?.messages || [])
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!chat) return <div className="p-8 text-center text-on-surface-muted">Chat not found</div>

  const sendMessage = () => {
    if (!input.trim()) return
    setMessages(prev => [...prev, {
      id: Date.now(), text: input.trim(), sender: 'me',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }])
    setInput('')
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-8rem)] md:h-[calc(100dvh-4rem)]">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <Link to="/chats" className="text-on-surface-muted hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <img src={chat.user.avatar} alt={chat.user.name} className="w-9 h-9 rounded-full object-cover" />
        <div>
          <h3 className="font-semibold text-on-surface text-sm">{chat.user.name}</h3>
          {chat.user.online && <span className="text-[10px] text-bullish">Online</span>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
              msg.sender === 'me'
                ? 'bg-primary/20 text-on-surface rounded-br-md'
                : 'bg-surface-container-high text-on-surface rounded-bl-md'
            }`}>
              <p>{msg.text}</p>
              <p className={`text-[10px] mt-1 ${msg.sender === 'me' ? 'text-on-surface-muted text-right' : 'text-on-surface-muted'}`}>{msg.timestamp}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 border-t border-white/[0.06] flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 bg-surface-card border border-white/[0.06] rounded-full px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted/50 focus:outline-none focus:border-primary/30"
        />
        <button
          onClick={sendMessage}
          className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-[20px]">send</span>
        </button>
      </div>
    </div>
  )
}
