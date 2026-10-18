/**
 * Encrypted storage for this browser's chat keys.
 *
 * The key material is AES-GCM encrypted and kept in IndexedDB. The AES key is a
 * non-extractable CryptoKey, also in IndexedDB: page scripts can use it but can never read
 * its bytes, so copying the browser's storage (or a leaked localStorage dump) does not
 * reveal the private keys. Older plaintext copies in localStorage are migrated and erased.
 */
import { get, set, del } from 'idb-keyval'

const WRAP_KEY = 'tt-e2e-wrap-key'
const stateKey = userId => `tt-e2e-state-${userId}`
const legacyKey = userId => `talktrading_adapter_state_${userId}`

let wrapKeyPromise = null
function wrapKey() {
  if (!wrapKeyPromise) {
    wrapKeyPromise = (async () => {
      const existing = await get(WRAP_KEY)
      if (existing) return existing
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
      await set(WRAP_KEY, key)
      return key
    })()
    wrapKeyPromise.catch(() => { wrapKeyPromise = null })
  }
  return wrapKeyPromise
}

// Writes for one account run in order, so an older state never overwrites a newer one.
const queues = new Map()

export function saveKeyState(userId, state) {
  const run = async () => {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await wrapKey(), new TextEncoder().encode(JSON.stringify(state)))
    await set(stateKey(userId), { iv, data })
  }
  const next = (queues.get(userId) || Promise.resolve()).then(run, run)
  queues.set(userId, next.catch(e => console.warn('[E2E] Could not save chat keys:', e)))
  return next
}

export async function loadKeyState(userId) {
  const legacy = localStorage.getItem(legacyKey(userId))
  if (legacy) {
    const state = JSON.parse(legacy)
    await saveKeyState(userId, state)
    localStorage.removeItem(legacyKey(userId))
    return state
  }
  const stored = await get(stateKey(userId))
  if (!stored) return null
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: stored.iv }, await wrapKey(), stored.data)
  return JSON.parse(new TextDecoder().decode(plain))
}

export function clearKeyState(userId) {
  localStorage.removeItem(legacyKey(userId))
  return del(stateKey(userId))
}
