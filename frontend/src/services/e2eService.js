/**
 * e2eService.js
 * =============
 * HTTP + WebSocket client for the E2EE Microservice (E2E-main FastAPI backend).
 *
 * All endpoints are prefixed with /e2ee as configured in app/main.py:
 *   app.include_router(api_router, prefix="/e2ee")
 *
 * Auth: Every request includes the logged-in user's JWT (issued by the Post
 * Service at login) in the Authorization header.
 *
 * PROBLEM ENCOUNTERED:
 *  The E2EE service's WebSocket endpoint (/e2ee/ws) requires `?token=...&device_id=...`
 *  query parameters — not HTTP headers — because browsers cannot set custom headers
 *  on WebSocket connections. This is handled in connectWebSocket() below.
 *
 * PROBLEM ENCOUNTERED:
 *  The X-Device-Id header is required by GET/POST /conversations/:id/messages.
 *  Without it the backend returns HTTP 400. We always include it from the adapter's
 *  device_id.
 */

import { E2EE_SERVICE_URL } from './apiConfig'

const BASE = (E2EE_SERVICE_URL || 'http://127.0.0.1:8003').replace(/\/+$/, '')

// ─── Shared fetch wrapper ──────────────────────────────────────────────────────

async function apiFetch(method, path, token, body = null, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  }
  const config = { method, headers }
  if (body !== null) config.body = JSON.stringify(body)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const resp = await fetch(`${BASE}${path}`, { ...config, signal: controller.signal })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: resp.statusText }))
      throw new Error(err.detail || `HTTP ${resp.status}`)
    }
    if (resp.status === 204) return null
    return await resp.json()
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Device endpoints ──────────────────────────────────────────────────────────

/**
 * Register a new device with its public key bundle.
 * POST /e2ee/devices
 * @param {object} bundle — output of ClientCryptoAdapter.registerDevice()
 * @param {string} token
 */
export async function registerDevice(bundle, token) {
  return apiFetch('POST', '/e2ee/devices', token, bundle)
}

/**
 * List all active devices for the authenticated user.
 * GET /e2ee/devices
 */
export async function listDevices(token) {
  return apiFetch('GET', '/e2ee/devices', token)
}

/**
 * Revoke a specific device.
 * DELETE /e2ee/devices/:deviceId
 */
export async function revokeDevice(deviceId, token) {
  return apiFetch('DELETE', `/e2ee/devices/${encodeURIComponent(deviceId)}`, token)
}

// ─── Key endpoints ─────────────────────────────────────────────────────────────

/**
 * Fetch the public key bundles for all active devices of a user.
 * GET /e2ee/keys/:userId
 * Consumes one OPK per device (server-side).
 * @returns {object} UserKeyBundleResponse { user_id, devices: [DeviceKeyBundleResponse] }
 */
export async function getUserKeyBundle(userId, token) {
  return apiFetch('GET', `/e2ee/keys/${userId}`, token)
}

/**
 * Replenish one-time prekeys for a device.
 * POST /e2ee/prekeys
 */
export async function replenishPrekeys(payload, token) {
  return apiFetch('POST', '/e2ee/prekeys', token, payload)
}

/**
 * Rotate the signed prekey for a device.
 * POST /e2ee/devices/:deviceId/rotate
 */
export async function rotateSignedPrekey(deviceId, rotationPayload, token) {
  return apiFetch('POST', `/e2ee/devices/${encodeURIComponent(deviceId)}/rotate`, token, rotationPayload)
}

// ─── Conversation endpoints ────────────────────────────────────────────────────

/**
 * Create a new 1-to-1 or group conversation.
 * POST /e2ee/conversations
 * @param {{ participant_ids: string[], name?: string }} payload
 */
export async function createConversation(payload, token) {
  return apiFetch('POST', '/e2ee/conversations', token, payload)
}

/**
 * List all conversations the authenticated user belongs to.
 * GET /e2ee/conversations
 */
export async function listConversations(token) {
  return apiFetch('GET', '/e2ee/conversations', token)
}

// ─── Message endpoints ─────────────────────────────────────────────────────────

/**
 * Send an E2EE message (encrypted envelopes per recipient device).
 * POST /e2ee/conversations/:conversationId/messages
 *
 * @param {string} conversationId - UUID string
 * @param {{ [deviceId: string]: string }} envelopes - device_id → base64 encrypted event
 * @param {string} token
 * @param {string} senderDeviceId - sent as X-Device-Id header (required by backend)
 */
export async function sendMessage(conversationId, envelopes, token, senderDeviceId) {
  return apiFetch(
    'POST',
    `/e2ee/conversations/${conversationId}/messages`,
    token,
    { envelopes },
    { 'X-Device-Id': senderDeviceId }
  )
}

/**
 * Retrieve all message envelopes addressed to the caller's device in a conversation.
 * GET /e2ee/conversations/:conversationId/messages
 *
 * PROBLEM ENCOUNTERED:
 *  X-Device-Id header is mandatory. Omitting it returns HTTP 400 with:
 *  {"detail": "X-Device-Id header is required"}
 *  This is because the backend fetches only envelopes addressed to that specific device.
 */
export async function getMessages(conversationId, token, deviceId) {
  return apiFetch(
    'GET',
    `/e2ee/conversations/${conversationId}/messages`,
    token,
    null,
    { 'X-Device-Id': deviceId }
  )
}

// ─── WebSocket ─────────────────────────────────────────────────────────────────

/**
 * Open a WebSocket connection to the E2EE service for real-time message delivery.
 *
 * PROBLEM ENCOUNTERED:
 *  Browsers block setting 'Authorization' headers on WebSocket connections.
 *  The E2EE service handles this by accepting token + device_id as query parameters.
 *  See app/api/v1/chat.py websocket_endpoint().
 *
 * @param {string} token
 * @param {string} deviceId
 * @param {function} onMessage - called with parsed event object on each message
 * @param {function} onClose - called on disconnect
 * @returns {WebSocket}
 */
export function connectWebSocket(token, deviceId, onMessage, onClose) {
  const wsBase = BASE.replace(/^http/, 'ws')
  const url = `${wsBase}/e2ee/ws?token=${encodeURIComponent(token)}&device_id=${encodeURIComponent(deviceId)}`

  const ws = new WebSocket(url)

  ws.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data)
      // Bug 1 fix: onMessage is async — explicitly catch any unhandled rejection so
      // decryption failures are surfaced to the console rather than silently dropped.
      Promise.resolve(onMessage(data)).catch((e) => {
        console.error('[E2E WS] Unhandled error in message handler:', e)
      })
    } catch (e) {
      console.warn('[E2E WS] Failed to parse incoming message:', e)
    }
  }

  ws.onerror = (err) => console.error('[E2E WS] Error:', err)

  ws.onclose = () => {
    console.info('[E2E WS] Connection closed.')
    if (onClose) onClose()
  }

  return ws
}

/**
 * Send a typing indicator event over an existing WebSocket.
 */
export function sendTypingEvent(ws, conversationId, isTyping) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'typing', conversation_id: conversationId, is_typing: isTyping }))
  }
}

/**
 * Send a read receipt for an envelope over an existing WebSocket.
 */
export function sendReadReceipt(ws, envelopeId) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'read_receipt', envelope_id: envelopeId }))
  }
}
