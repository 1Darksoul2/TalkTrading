const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' })

// Server timestamps carry no timezone marker; they are UTC.
export function parseServerDate(iso) {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
}

export function timeAgo(iso) {
  const seconds = Math.round((parseServerDate(iso).getTime() - Date.now()) / 1000)
  const steps = [['day', 86400], ['hour', 3600], ['minute', 60]]
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return 'now'
}

// "3h left" for a story that expires at `iso`.
export function timeLeft(iso) {
  const seconds = Math.round((parseServerDate(iso).getTime() - Date.now()) / 1000)
  if (seconds <= 0) return 'expired'
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h left`
  return `${Math.max(1, Math.floor(seconds / 60))}m left`
}
