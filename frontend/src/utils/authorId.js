// Mirrors post-service's app/core/security.py get_current_user_id() fallback:
//   (zlib.crc32(user_id_val.encode('utf-8')) % 900000) + 100
// Post Service's Post/Comment/Like/Save tables use an int author_id/user_id
// column, but auth now issues UUID subjects. The backend derives a stable
// pseudo-int from the UUID deterministically; the frontend needs the same
// value to filter "my posts" by author_id without a dedicated /me endpoint.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(str) {
  let crc = 0xffffffff
  const bytes = new TextEncoder().encode(str)
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export function deriveAuthorId(userUuid) {
  if (!userUuid) return null
  return (crc32(userUuid) % 900000) + 100
}
