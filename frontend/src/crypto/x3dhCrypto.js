/**
 * x3dhCrypto.js
 * =============
 * Client-side JavaScript implementation of the X3DH (Extended Triple Diffie-Hellman)
 * key agreement protocol + AES-256-GCM message encryption.
 *
 * This mirrors the Python ClientCryptoEngine / ClientCryptoAdapter in E2E-main/app/crypto/
 * and produces serialization-compatible output (URL-safe Base64, Matrix m.room.encrypted
 * event format) so the E2EE microservice and any other client can process envelopes correctly.
 *
 * Crypto primitives used:
 *  - X25519 (Curve25519 DH)  → @noble/curves  (SubtleCrypto lacks X25519 cross-browser)
 *  - Ed25519 (signing SPK)   → @noble/curves
 *  - AES-256-GCM             → SubtleCrypto    (native, hardware-accelerated, with AAD)
 *  - HKDF-SHA256             → SubtleCrypto
 */

import { x25519, ed25519 } from '@noble/curves/ed25519.js'

// ─── Base64 URL-safe helpers (matches Python bytes_to_b64str / b64str_to_bytes) ──────────────────

export function bytesToB64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function b64ToBytes(b64str) {
  // Normalize URL-safe base64 and ensure proper padding
  let b64 = b64str.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4 !== 0) b64 += '='
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// ─── AES-256-GCM via SubtleCrypto with Additional Authenticated Data (AAD) ───────────────────────

async function aesGcmEncrypt(keyBytes, plaintext, additionalData) {
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encryptParams = { name: 'AES-GCM', iv }
  if (additionalData) encryptParams.additionalData = additionalData
  const cipherBuf = await crypto.subtle.encrypt(encryptParams, cryptoKey, plaintext)
  return { ciphertext: new Uint8Array(cipherBuf), iv }
}

async function aesGcmDecrypt(keyBytes, ciphertext, iv, additionalData) {
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt'])
  try {
    const decryptParams = { name: 'AES-GCM', iv }
    if (additionalData) decryptParams.additionalData = additionalData
    const plainBuf = await crypto.subtle.decrypt(decryptParams, cryptoKey, ciphertext)
    return new Uint8Array(plainBuf)
  } catch (e) {
    throw new Error('DecryptionError: AES-GCM authentication tag verification failed — corrupted or tampered ciphertext.')
  }
}

// ─── HKDF-SHA256 via SubtleCrypto (matches Python HKDF info & salt) ─────────────────────────────

async function hkdf(inputKeyMaterial, info = new TextEncoder().encode('Reddit-Insta-E2EE-X3DH'), salt = new Uint8Array(32)) {
  const keyMaterial = await crypto.subtle.importKey('raw', inputKeyMaterial, { name: 'HKDF' }, false, ['deriveKey'])
  const derivedKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
  const raw = await crypto.subtle.exportKey('raw', derivedKey)
  return new Uint8Array(raw) // 32 bytes
}

// ─── Helper for deterministic keys on demo devices ─────────────────────────────

function deriveSeedFromDeviceId(deviceId, offset = 0) {
  const enc = new TextEncoder().encode(`${deviceId}-secret-seed-${offset}`)
  const hash = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    hash[i] = (enc[i % enc.length] * 31 + i * 17 + offset * 7) & 0xff
  }
  return hash
}

// ─── ClientCryptoEngine (JS equivalent of Python ClientCryptoEngine) ─────────────────────────────

export class ClientCryptoEngine {
  constructor(deviceId) {
    this.deviceId = deviceId
    const isDeterministic = deviceId.startsWith('web-alice') || deviceId.startsWith('web-bob')

    // 1. Long-term Identity DH Key (X25519)
    this.identityPrivateDH = isDeterministic
      ? deriveSeedFromDeviceId(deviceId, 1)
      : x25519.utils.randomSecretKey()
    this.identityPublicDH = x25519.getPublicKey(this.identityPrivateDH)

    // 2. Long-term Identity Signing Key (Ed25519) — used to sign the SPK
    this.identityPrivateSign = isDeterministic
      ? deriveSeedFromDeviceId(deviceId, 2)
      : ed25519.utils.randomSecretKey()
    this.identityPublicSign = ed25519.getPublicKey(this.identityPrivateSign)

    // Combined 64-byte public identity key: DH pubkey || Sign pubkey
    this.identityPublicBytes = new Uint8Array([...this.identityPublicDH, ...this.identityPublicSign])

    // 3. Medium-term Signed Prekey (SPK)
    this.spkId = 1
    this.spkPrivate = isDeterministic
      ? deriveSeedFromDeviceId(deviceId, 3)
      : x25519.utils.randomSecretKey()
    this.spkPublic = x25519.getPublicKey(this.spkPrivate)
    this.spkSignature = ed25519.sign(this.spkPublic, this.identityPrivateSign)
    this.spkHistory = { 1: this.spkPrivate }

    // 4. One-Time Prekeys (OPKs)
    this.opkStore = {}       // id → private bytes
    this.opkPublicStore = {} // id → public bytes
    this.nextOpkId = 100
    this.generateOneTimePrekeys(50) // Pre-populate initial OPK pool

    // 5. Session state
    this.sessions = {}            // peer_device_id → 32-byte session key (Uint8Array)
    this.seenMessages = {}        // peer_device_id → Set of iv-b64 strings (replay protection)
    this.sessionEphemeralKeys = {}// peer_device_id → ephemeral public key bytes used in X3DH
    this.sessionOpkIds = {}       // peer_device_id → OPK id used in X3DH
    this.peerIdentityKeys = {}    // peer_device_id → peer identity key bytes
  }

  generateOneTimePrekeys(count) {
    const isDeterministic = this.deviceId.startsWith('web-alice') || this.deviceId.startsWith('web-bob')
    const result = []
    for (let i = 0; i < count; i++) {
      const id = this.nextOpkId++
      const priv = isDeterministic
        ? deriveSeedFromDeviceId(this.deviceId, 100 + id)
        : x25519.utils.randomSecretKey()
      const pub = x25519.getPublicKey(priv)
      this.opkStore[id] = priv
      this.opkPublicStore[id] = pub
      result.push({ id, pub })
    }
    return result
  }

  getRegisteredPrekeys(count = 10) {
    const result = []
    const ids = Object.keys(this.opkPublicStore).slice(0, count)
    for (const id of ids) {
      result.push({ id: Number(id), pub: this.opkPublicStore[id] })
    }
    return result
  }

  /**
   * Outbound X3DH: derive shared secret from 3 or 4 DH operations.
   * Matches Python: initiate_x3dh()
   */
  async initiateX3DH(peerDeviceId, peerIdentityBytes, peerSpkBytes, peerSpkSignature, peerSpkId, peerOpkBytes, peerOpkId) {
    const peerSignKey = peerIdentityBytes.slice(32, 64)
    const valid = ed25519.verify(peerSpkSignature, peerSpkBytes, peerSignKey)
    if (!valid) throw new Error('InvalidSignatureError: Peer signed prekey signature verification failed.')

    // Ephemeral key pair (EK)
    const ephPriv = x25519.utils.randomSecretKey()
    const ephPub = x25519.getPublicKey(ephPriv)
    this.sessionEphemeralKeys[peerDeviceId] = ephPub
    if (peerOpkId != null) {
      this.sessionOpkIds[peerDeviceId] = peerOpkId
    }

    const peerDHKey = peerIdentityBytes.slice(0, 32) // peer's X25519 identity DH public key

    // DH operations matching Python initiate_x3dh:
    // DH1 = local_identity_private_dh * peer_spk
    const dh1 = x25519.getSharedSecret(this.identityPrivateDH, peerSpkBytes)
    // DH2 = local_ephemeral_private_dh * peer_identity_dh
    const dh2 = x25519.getSharedSecret(ephPriv, peerDHKey)
    // DH3 = local_ephemeral_private_dh * peer_spk
    const dh3 = x25519.getSharedSecret(ephPriv, peerSpkBytes)

    const dhConcat = [...dh1, ...dh2, ...dh3]

    // DH4 = local_ephemeral_private_dh * peer_opk (optional)
    if (peerOpkBytes != null && peerOpkId != null) {
      const dh4 = x25519.getSharedSecret(ephPriv, peerOpkBytes)
      dhConcat.push(...dh4)
    }

    const ikm = new Uint8Array(dhConcat)
    const info = new TextEncoder().encode('Reddit-Insta-E2EE-X3DH')
    const sessionKey = await hkdf(ikm, info)

    this.sessions[peerDeviceId] = sessionKey
    this.peerIdentityKeys[peerDeviceId] = peerIdentityBytes
    this.seenMessages[peerDeviceId] = new Set()

    return { ephPub, peerSpkId, peerOpkId }
  }

  /**
   * Inbound X3DH: derive shared secret from peer's ephemeral key.
   * Matches Python: receive_x3dh()
   */
  async receiveX3DH(peerDeviceId, peerIdentityBytes, ephemeralKeyBytes, signedPrekeyId, oneTimePrekeyId) {
    const spkPriv = this.spkHistory[signedPrekeyId] || this.spkPrivate
    const peerDHKey = peerIdentityBytes.slice(0, 32)

    // DH1 = local_spk_private * peer_identity_dh
    const dh1 = x25519.getSharedSecret(spkPriv, peerDHKey)
    // DH2 = local_identity_private_dh * peer_ek
    const dh2 = x25519.getSharedSecret(this.identityPrivateDH, ephemeralKeyBytes)
    // DH3 = local_spk_private * peer_ek
    const dh3 = x25519.getSharedSecret(spkPriv, ephemeralKeyBytes)

    const dhConcat = [...dh1, ...dh2, ...dh3]

    // DH4 = local_opk_private * peer_ek (optional)
    if (oneTimePrekeyId != null) {
      let opkPriv = this.opkHistory?.[oneTimePrekeyId] || this.opkStore[oneTimePrekeyId]
      if (!opkPriv && (this.deviceId.startsWith('web-alice') || this.deviceId.startsWith('web-bob'))) {
        opkPriv = deriveSeedFromDeviceId(this.deviceId, 100 + oneTimePrekeyId)
      }
      if (opkPriv) {
        if (!this.opkHistory) this.opkHistory = {}
        this.opkHistory[oneTimePrekeyId] = opkPriv
        const dh4 = x25519.getSharedSecret(opkPriv, ephemeralKeyBytes)
        dhConcat.push(...dh4)
      }
    }

    const ikm = new Uint8Array(dhConcat)
    const info = new TextEncoder().encode('Reddit-Insta-E2EE-X3DH')
    const sessionKey = await hkdf(ikm, info)

    this.sessions[peerDeviceId] = sessionKey
    this.peerIdentityKeys[peerDeviceId] = peerIdentityBytes
    this.seenMessages[peerDeviceId] = new Set()
    return sessionKey
  }

  async encrypt(peerDeviceId, plaintextBytes) {
    const sessionKey = this.sessions[peerDeviceId]
    if (!sessionKey) throw new Error(`SessionError: No active session with device ${peerDeviceId}`)
    const assocData = new TextEncoder().encode(`${this.deviceId}:${peerDeviceId}`)
    return aesGcmEncrypt(sessionKey, plaintextBytes, assocData)
  }

  async decrypt(peerDeviceId, ciphertext, iv, checkReplay = false) {
    const sessionKey = this.sessions[peerDeviceId]
    if (!sessionKey) throw new Error(`SessionError: No active session with device ${peerDeviceId}`)

    // Replay protection: track IV for live incoming messages only
    if (checkReplay) {
      const ivB64 = bytesToB64(iv)
      if (!this.seenMessages[peerDeviceId]) this.seenMessages[peerDeviceId] = new Set()
      if (this.seenMessages[peerDeviceId].has(ivB64)) {
        throw new Error('DecryptionError: Replay attack detected — duplicate IV/ciphertext rejected.')
      }
      this.seenMessages[peerDeviceId].add(ivB64)
    }

    const assocData = new TextEncoder().encode(`${peerDeviceId}:${this.deviceId}`)
    return aesGcmDecrypt(sessionKey, ciphertext, iv, assocData)
  }

  async rotateSignedPrekey() {
    this.spkId++
    this.spkPrivate = x25519.utils.randomSecretKey()
    this.spkPublic = x25519.getPublicKey(this.spkPrivate)
    this.spkSignature = ed25519.sign(this.spkPublic, this.identityPrivateSign)
    this.spkHistory[this.spkId] = this.spkPrivate
    return { keyId: this.spkId, spkBytes: this.spkPublic, signature: this.spkSignature }
  }
}

// ─── ClientCryptoAdapter (JS equivalent of Python ClientCryptoAdapter) ────────────────────────────

export class ClientCryptoAdapter {
  constructor(deviceId) {
    this.deviceId = deviceId
    this.engine = new ClientCryptoEngine(deviceId)
  }

  /**
   * Build the device registration payload for POST /e2ee/devices.
   * Matches Python: ClientCryptoAdapter.register_device()
   */
  async registerDevice(deviceName) {
    const opks = this.engine.generateOneTimePrekeys(5)
    return {
      device_id: this.deviceId,
      device_name: deviceName || (typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : 'talktrading-client'),
      identity_key: bytesToB64(this.engine.identityPublicBytes),
      signed_prekey: {
        key_id: this.engine.spkId,
        key: bytesToB64(this.engine.spkPublic),
        signature: bytesToB64(this.engine.spkSignature),
      },
      one_time_prekeys: opks.map(({ id, pub }) => ({ key_id: id, key: bytesToB64(pub) })),
    }
  }

  /**
   * Establish outbound X3DH session with a peer device given its key bundle.
   */
  async createSession(peerDeviceId, bundle) {
    await this.engine.initiateX3DH(
      peerDeviceId,
      b64ToBytes(bundle.identity_key),
      b64ToBytes(bundle.signed_prekey.key),
      b64ToBytes(bundle.signed_prekey.signature),
      bundle.signed_prekey.key_id,
      bundle.one_time_prekey ? b64ToBytes(bundle.one_time_prekey.key) : null,
      bundle.one_time_prekey?.key_id ?? null
    )
  }

  /**
   * Encrypt a plaintext message for a peer device.
   * Returns a base64-encoded JSON string representing the Matrix m.room.encrypted event.
   * Matches Python serialize_matrix_encrypted_event format.
   */
  async encryptMessage(peerDeviceId, peerIdentityKeyBytes, payload) {
    const plaintextBytes = new TextEncoder().encode(JSON.stringify(payload))
    const { ciphertext, iv } = await this.engine.encrypt(peerDeviceId, plaintextBytes)

    const ephemeralKey = this.engine.sessionEphemeralKeys[peerDeviceId]
      || this.engine.identityPublicDH

    const recipientKeyB64 = bytesToB64(peerIdentityKeyBytes)

    const body = {
      ciphertext: bytesToB64(ciphertext),
      iv: bytesToB64(iv),
      ephemeral_key: bytesToB64(ephemeralKey),
      signed_prekey_id: this.engine.spkId,
    }

    const opkId = this.engine.sessionOpkIds[peerDeviceId]
    if (opkId != null) {
      body.one_time_prekey_id = opkId
    }

    const event = {
      type: 'm.room.encrypted',
      content: {
        algorithm: 'm.olm.v1.curve25519-aes-sha2',
        sender_key: bytesToB64(this.engine.identityPublicBytes),
        sender_device_id: this.deviceId,
        ciphertext: {
          [recipientKeyB64]: {
            type: 0,
            body: btoa(JSON.stringify(body)),
          },
        },
      },
    }

    return btoa(JSON.stringify(event))
  }

  /**
   * Decrypt an envelope string (base64 JSON Matrix event) received from the service.
   */
  async decryptEnvelope(envelopeB64, senderDeviceId, senderIdentityKeyB64, checkReplay = false) {
    const event = JSON.parse(atob(envelopeB64))

    const localIkB64 = bytesToB64(this.engine.identityPublicBytes)
    const ciphertextMap = event?.content?.ciphertext
    if (!ciphertextMap) throw new Error('DecryptionError: Malformed envelope — missing ciphertext map.')

    let entry = ciphertextMap[localIkB64]
    if (!entry) {
      // In 1-to-1 envelopes sent directly to this device, retrieve the recipient entry
      const keys = Object.keys(ciphertextMap)
      if (keys.length > 0) {
        entry = ciphertextMap[keys[0]]
      } else {
        throw new Error('DecryptionError: No entry addressed to this device in the ciphertext map.')
      }
    }

    const body = JSON.parse(atob(entry.body))
    const ciphertext = b64ToBytes(body.ciphertext)
    const iv = b64ToBytes(body.iv)
    const ephemeralKey = b64ToBytes(body.ephemeral_key)
    const signedPrekeyId = body.signed_prekey_id
    const oneTimePrekeyId = body.one_time_prekey_id ?? null

    const senderIdentityBytes = senderIdentityKeyB64 ? b64ToBytes(senderIdentityKeyB64) : b64ToBytes(event.content.sender_key)

    // Derive the specific envelope session key using the envelope's ephemeral key
    const sessionKey = await this.engine.receiveX3DH(
      senderDeviceId,
      senderIdentityBytes,
      ephemeralKey,
      signedPrekeyId,
      oneTimePrekeyId
    )

    if (checkReplay) {
      const ivB64 = bytesToB64(iv)
      if (!this.engine.seenMessages[senderDeviceId]) this.engine.seenMessages[senderDeviceId] = new Set()
      if (this.engine.seenMessages[senderDeviceId].has(ivB64)) {
        throw new Error('DecryptionError: Replay attack detected — duplicate IV/ciphertext rejected.')
      }
      this.engine.seenMessages[senderDeviceId].add(ivB64)
    }

    const assocData = new TextEncoder().encode(`${senderDeviceId}:${this.deviceId}`)
    const plaintextBytes = await aesGcmDecrypt(sessionKey, ciphertext, iv, assocData)
    return JSON.parse(new TextDecoder().decode(plaintextBytes))
  }

  /**
   * Encrypt payload for multiple devices at once.
   * Returns { device_id: envelopeB64String, ... }
   */
  async encryptForDevices(deviceBundles, payload) {
    const envelopes = {}
    for (const bundle of deviceBundles) {
      const peerDeviceId = bundle.device_id
      await this.createSession(peerDeviceId, bundle)
      envelopes[peerDeviceId] = await this.encryptMessage(
        peerDeviceId,
        b64ToBytes(bundle.identity_key),
        payload
      )
    }
    return envelopes
  }

  async rotateKeys() {
    const { keyId, spkBytes, signature } = await this.engine.rotateSignedPrekey()
    return {
      key_id: keyId,
      key: bytesToB64(spkBytes),
      signature: bytesToB64(signature),
    }
  }

  /** Serialize adapter state to plain object for localStorage persistence. */
  exportState() {
    return {
      deviceId: this.deviceId,
      identityPrivateDH: Array.from(this.engine.identityPrivateDH),
      identityPrivateSign: Array.from(this.engine.identityPrivateSign),
      spkId: this.engine.spkId,
      spkPrivate: Array.from(this.engine.spkPrivate),
      spkSignature: Array.from(this.engine.spkSignature),
      spkHistory: Object.fromEntries(
        Object.entries(this.engine.spkHistory || {}).map(([id, priv]) => [id, Array.from(priv)])
      ),
      nextOpkId: this.engine.nextOpkId,
      opkStore: Object.fromEntries(
        Object.entries(this.engine.opkStore).map(([id, priv]) => [id, Array.from(priv)])
      ),
      // Bug 2 fix: also export public OPK store so importState() restores the full
      // OPK set without generating new key pairs that would mismatch the backend DB.
      opkPublicStore: Object.fromEntries(
        Object.entries(this.engine.opkPublicStore).map(([id, pub]) => [id, Array.from(pub)])
      ),
      sessions: Object.fromEntries(
        Object.entries(this.engine.sessions || {}).map(([devId, key]) => [devId, Array.from(key)])
      ),
      sessionEphemeralKeys: Object.fromEntries(
        Object.entries(this.engine.sessionEphemeralKeys || {}).map(([devId, key]) => [devId, Array.from(key)])
      ),
      sessionOpkIds: { ...this.engine.sessionOpkIds },
      peerIdentityKeys: Object.fromEntries(
        Object.entries(this.engine.peerIdentityKeys || {}).map(([devId, key]) => [devId, Array.from(key)])
      ),
    }
  }

  /** Restore adapter from exported state. */
  static importState(state) {
    const adapter = new ClientCryptoAdapter(state.deviceId)
    const eng = adapter.engine

    eng.identityPrivateDH = new Uint8Array(state.identityPrivateDH)
    eng.identityPublicDH = x25519.getPublicKey(eng.identityPrivateDH)
    eng.identityPrivateSign = new Uint8Array(state.identityPrivateSign)
    eng.identityPublicSign = ed25519.getPublicKey(eng.identityPrivateSign)
    eng.identityPublicBytes = new Uint8Array([...eng.identityPublicDH, ...eng.identityPublicSign])

    eng.spkId = state.spkId
    eng.spkPrivate = new Uint8Array(state.spkPrivate)
    eng.spkPublic = x25519.getPublicKey(eng.spkPrivate)
    eng.spkSignature = new Uint8Array(state.spkSignature)
    eng.spkHistory = state.spkHistory
      ? Object.fromEntries(Object.entries(state.spkHistory).map(([id, arr]) => [id, new Uint8Array(arr)]))
      : { [eng.spkId]: eng.spkPrivate }

    eng.nextOpkId = state.nextOpkId
    eng.opkStore = Object.fromEntries(
      Object.entries(state.opkStore || {}).map(([id, arr]) => [id, new Uint8Array(arr)])
    )
    // Bug 2 fix: restore public OPK store from the exported snapshot so the adapter's
    // public keys stay consistent with what was registered in the backend DB.
    eng.opkPublicStore = state.opkPublicStore
      ? Object.fromEntries(
          Object.entries(state.opkPublicStore).map(([id, arr]) => [id, new Uint8Array(arr)])
        )
      : Object.fromEntries(
          // Fallback: re-derive public keys from the stored private keys for old state snapshots.
          Object.entries(eng.opkStore).map(([id, priv]) => [id, x25519.getPublicKey(priv)])
        )
    eng.sessions = Object.fromEntries(
      Object.entries(state.sessions || {}).map(([devId, arr]) => [devId, new Uint8Array(arr)])
    )
    eng.sessionEphemeralKeys = Object.fromEntries(
      Object.entries(state.sessionEphemeralKeys || {}).map(([devId, arr]) => [devId, new Uint8Array(arr)])
    )
    eng.sessionOpkIds = state.sessionOpkIds ? { ...state.sessionOpkIds } : {}
    eng.peerIdentityKeys = Object.fromEntries(
      Object.entries(state.peerIdentityKeys || {}).map(([devId, arr]) => [devId, new Uint8Array(arr)])
    )

    return adapter
  }
}
