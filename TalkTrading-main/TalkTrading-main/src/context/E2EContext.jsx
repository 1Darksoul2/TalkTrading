/**
 * E2EContext.jsx
 * ==============
 * React context that orchestrates the full E2EE lifecycle for the logged-in account:
 *
 *  1. Identity — uses the real login token and user id from AuthContext (the chat service
 *     verifies the same JWT the Post Service issues).
 *  2. Device — each browser gets a random, persistent device id per account; the private
 *     keys stay in this browser, encrypted at rest (see crypto/keyVault.js).
 *  3. Dual-party encryption — messages are encrypted for the recipient(s) AND the sender's
 *     own devices so history can be reloaded.
 *  4. Safe history decryption — replay protection only checks live incoming WS packets.
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { getToken } from '../utils/session'
import { ClientCryptoAdapter } from '../crypto/x3dhCrypto'
import { loadKeyState, saveKeyState } from '../crypto/keyVault'
import {
  registerDevice,
  listConversations,
  createConversation,
  getMessages,
  sendMessage,
  getUserKeyBundle,
  connectWebSocket,
  sendReadReceipt,
} from '../services/e2eService'
import { useAuth } from './AuthContext'
import { postService } from '../services/postService'
import { deriveAuthorId } from '../utils/authorId'
import { parseServerDate } from '../utils/time'

const E2EContext = createContext(null)

// Random device id, created once per account in this browser and then reused.
function getStableDeviceId(userId) {
  const storageKey = `talktrading_device_id_${userId}`
  const existing = localStorage.getItem(storageKey)
  if (existing) return existing
  const newId = `web-${crypto.randomUUID()}`
  localStorage.setItem(storageKey, newId)
  return newId
}

function dedupeMessages(list = []) {
  const seenIds = new Set()
  const result = []
  for (const m of list) {
    if (m.id && !m.id.startsWith('local-')) {
      if (seenIds.has(m.id)) continue
      seenIds.add(m.id)
    }
    result.push(m)
  }
  return result
}

// Key setup must run once per account. React runs effects twice in development, and two
// concurrent runs would generate different keys: one set registered with the server, the
// other saved locally, which makes every message undecryptable. Sharing one promise avoids it.
const adapterSetups = new Map()

function setupAdapter(userId, deviceId, userName, token) {
  if (!adapterSetups.has(userId)) {
    const setup = (async () => {
      let adapter = null
      try {
        const saved = await loadKeyState(userId)
        if (saved) adapter = ClientCryptoAdapter.importState(saved)
      } catch (e) {
        console.warn('[E2E] Failed to restore adapter state, re-generating:', e)
      }
      if (!adapter) adapter = new ClientCryptoAdapter(deviceId)

      // Always sync the current device bundle to the backend
      try {
        const bundle = await adapter.registerDevice(`TalkTrading Web (${userName})`)
        await registerDevice(bundle, token)
      } catch (regError) {
        console.info(`[E2E] Device ${deviceId} register note:`, regError.message)
      }

      await saveKeyState(userId, adapter.exportState())
      return adapter
    })()
    setup.catch(() => adapterSetups.delete(userId))
    adapterSetups.set(userId, setup)
  }
  return adapterSetups.get(userId)
}

export function E2EProvider({ children }) {
  const { user } = useAuth()

  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)
  const [conversations, setConversations] = useState([])
  const [messages, setMessages] = useState({}) // conversationId → [decrypted message]
  const [participantNames, setParticipantNames] = useState({}) // user uuid → username

  const adapterRef = useRef(null)
  const wsRef = useRef(null)
  const keyBundleCache = useRef({}) // userId → bundle
  const reconnectDelay = useRef(1000)

  const userId = user?.id || null
  const token = getToken()
  const deviceId = userId ? getStableDeviceId(userId) : null
  const currentUser = { name: user?.username || '', userId, deviceId, token }
  const activeUserKey = userId // key for this account's saved key material

  // Usernames of everyone in my conversations, so chats show names instead of ids.
  useEffect(() => {
    const uuids = [...new Set(conversations.flatMap(c => c.participants || []))]
    if (uuids.length === 0) return
    postService.lookupUsers(uuids.map(deriveAuthorId)).then(people => {
      setParticipantNames(Object.fromEntries(uuids.map(u => [u, people[deriveAuthorId(u)]?.username]).filter(([, name]) => name)))
    }).catch(() => {})
  }, [conversations])

  // ── Device initialization ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      if (!userId) return
      try {
        setError(null)
        setIsReady(false)
        setConversations([])
        setMessages({})
        keyBundleCache.current = {}

        const adapter = await setupAdapter(userId, deviceId, currentUser.name, token)

        if (cancelled) return
        adapterRef.current = adapter

        // Load conversation list
        try {
          const convs = await listConversations(token)
          if (!cancelled) {
            setConversations(Array.isArray(convs) ? convs : [])
          }
        } catch (convErr) {
          console.warn('[E2E] Conversations fetch warning:', convErr.message)
          if (!cancelled) setConversations([])
        }

        if (!cancelled) {
          setIsReady(true)
          openWebSocket(adapter)
        }
      } catch (err) {
        console.error('[E2E] Initialization failed:', err)
        if (!cancelled) {
          setError(err.message)
          setIsReady(true)
        }
      }
    }

    init()

    return () => {
      cancelled = true
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [userId, token, deviceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── WebSocket management ──────────────────────────────────────────────────
  const openWebSocket = useCallback((adapter) => {
    if (!adapter) return

    try {
      const ws = connectWebSocket(
        token,
        adapter.deviceId,
        async (event) => {
          if (event.type === 'message') {
            await handleIncomingWsMessage(event, adapter)
          }
        },
        () => {
          const delay = Math.min(reconnectDelay.current, 30000)
          reconnectDelay.current = delay * 2
          setTimeout(() => {
            if (adapterRef.current) {
              reconnectDelay.current = 1000
              openWebSocket(adapterRef.current)
            }
          }, delay)
        }
      )
      wsRef.current = ws
    } catch (wsErr) {
      console.warn('[E2E] WebSocket connection skipped:', wsErr.message)
    }
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleIncomingWsMessage(event, adapter) {
    try {
      // Check replay protection for live incoming WebSocket events
      const decrypted = await adapter.decryptEnvelope(
        event.encrypted_payload,
        event.sender_device_id,
        event.sender_identity_key || '',
        true // checkReplay = true
      )
      const convId = event.conversation_id
      const content = decrypted.content ?? decrypted

      setMessages(prev => {
        // Remove optimistic local message if this WS event confirms it
        const currentList = (prev[convId] || []).filter(
          m => !(m.id?.startsWith('local-') && m.text === content && m.senderId === event.sender_id)
        )
        const newMsg = {
          id: event.message_id,
          text: content,
          sender: event.sender_id === userId ? 'me' : 'them',
          senderId: event.sender_id,
          at: event.created_at,
          timestamp: parseServerDate(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          encrypted: true,
        }
        return {
          ...prev,
          [convId]: dedupeMessages([...currentList, newMsg]),
        }
      })

      // Persist established session state
      saveKeyState(activeUserKey, adapter.exportState())

      if (event.envelope_id && wsRef.current) {
        sendReadReceipt(wsRef.current, event.envelope_id)
      }
    } catch (e) {
      console.warn('[E2E] Failed to decrypt incoming WS message:', e.message)
    }
  }

  // ── Load messages for a conversation ─────────────────────────────────────
  const loadMessages = useCallback(async (conversationId) => {
    const adapter = adapterRef.current
    if (!adapter) return

    try {
      const envelopes = await getMessages(conversationId, token, adapter.deviceId)
      const decryptedMessages = []

      for (const env of envelopes) {
        try {
          // checkReplay = false for historical DB envelopes
          const decrypted = await adapter.decryptEnvelope(
            env.encrypted_payload,
            env.sender_device_id,
            '',
            false // checkReplay = false
          )
          decryptedMessages.push({
            id: env.message_id,
            envelopeId: env.envelope_id,
            text: typeof decrypted === 'string' ? decrypted : (decrypted.content ?? JSON.stringify(decrypted)),
            sender: env.sender_id === userId ? 'me' : 'them',
            senderId: env.sender_id,
            at: env.created_at,
            timestamp: parseServerDate(env.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: env.status,
            encrypted: true,
          })
        } catch (decErr) {
          console.warn('[E2E] Could not decrypt envelope', env.envelope_id, ':', decErr.message)
        }
      }

      setMessages(prev => ({
        ...prev,
        [conversationId]: dedupeMessages(decryptedMessages),
      }))

      // Persist any newly negotiated session keys (encrypted)
      saveKeyState(activeUserKey, adapter.exportState())
    } catch (err) {
      console.error('[E2E] loadMessages failed:', err.message)
    }
  }, [token, userId, activeUserKey])

  // ── Send an encrypted message ─────────────────────────────────────────────
  const encryptAndSend = useCallback(async (conversationId, recipientUserIds, plaintext) => {
    const adapter = adapterRef.current
    if (!adapter) throw new Error('E2E adapter not initialized')

    const payload = {
      conversation_id: conversationId,
      sender_id: userId,
      content: plaintext,
      timestamp: Math.floor(Date.now() / 1000),
    }

    // Encrypt for both the recipient(s) AND the sender's own device
    // This ensures both parties retain full conversation history!
    const targetUserIds = Array.from(new Set([
      ...(recipientUserIds && recipientUserIds.length > 0 ? recipientUserIds : []),
      userId
    ]))

    const allDeviceBundles = []
    for (const rId of targetUserIds) {
      let bundle = keyBundleCache.current[rId]
      if (!bundle) {
        try {
          bundle = await getUserKeyBundle(rId, token)
          keyBundleCache.current[rId] = bundle
        } catch (keyErr) {
          console.warn(`[E2E] Could not fetch bundle for user ${rId}:`, keyErr.message)
        }
      }
      if (bundle?.devices) {
        allDeviceBundles.push(...bundle.devices)
      }
    }

    if (allDeviceBundles.length === 0) {
      throw new Error('No registered devices found for recipient(s). Recipient must open app or register first.')
    }

    // Encrypt for all target devices (recipients + self)
    const envelopes = await adapter.encryptForDevices(allDeviceBundles, payload)

    // Deliver to backend
    await sendMessage(conversationId, envelopes, token, adapter.deviceId)

    // Optimistic local state update
    const myMsg = {
      id: `local-${Date.now()}`,
      text: plaintext,
      sender: 'me',
      senderId: userId,
      at: new Date().toISOString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      encrypted: true,
    }
    setMessages(prev => ({
      ...prev,
      [conversationId]: dedupeMessages([...(prev[conversationId] || []), myMsg]),
    }))

    // Persist updated adapter session state (encrypted)
    saveKeyState(activeUserKey, adapter.exportState())
  }, [token, userId, activeUserKey])

  // ── Create a new conversation ─────────────────────────────────────
  const startConversation = useCallback(async (participantUserIds, name) => {
    const conv = await createConversation({ participant_ids: participantUserIds, name }, token)
    setConversations(prev => {
      const filtered = prev.filter(c => c.conversation_id !== conv.conversation_id)
      return [conv, ...filtered]
    })
    return conv
  }, [token])

  // ── Refresh conversation list ─────────────────────────────────────────────
  const refreshConversations = useCallback(async () => {
    try {
      const convs = await listConversations(token)
      setConversations(Array.isArray(convs) ? convs : [])
    } catch (e) {
      console.warn('[E2E] refreshConversations failed:', e.message)
    }
  }, [token])

  return (
    <E2EContext.Provider value={{
      isReady,
      error,
      deviceId,
      userId,
      currentUser,
      conversations,
      participantNames,
      messages,
      loadMessages,
      encryptAndSend,
      startConversation,
      refreshConversations,
      ws: wsRef.current,
    }}>
      {children}
    </E2EContext.Provider>
  )
}

export function useE2E() {
  const ctx = useContext(E2EContext)
  if (!ctx) throw new Error('useE2E must be used inside <E2EProvider>')
  return ctx
}
