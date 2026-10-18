// Neutral picture for accounts (and communities) without an uploaded photo; inline, so no request.
const svg = (shape) => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2b2f36"/>${shape}</svg>`)}`

export const DEFAULT_AVATAR = svg('<circle cx="32" cy="25" r="11" fill="#8a919c"/><path d="M12 56c2-11 10-17 20-17s18 6 20 17z" fill="#8a919c"/>')
export const DEFAULT_GROUP_ICON = svg('<circle cx="23" cy="26" r="8" fill="#8a919c"/><circle cx="41" cy="26" r="8" fill="#8a919c"/><path d="M8 50c1-8 7-13 15-13s14 5 15 13zM26 50c1-8 7-13 15-13s14 5 15 13z" fill="#8a919c"/>')
