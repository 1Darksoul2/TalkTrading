import { useCallback, useEffect, useState } from 'react'
import Card from '../components/ui/Card'
import {
  NEWS_SERVICE_URL, STORY_SERVICE_URL, CHART_SERVICE_URL, E2EE_SERVICE_URL, POST_SERVICE_URL,
  REEL_SERVICE_URL, COMMUNITY_SERVICE_URL, EXPLORE_SERVICE_URL,
} from '../services/apiConfig'
import { getToken } from '../utils/session'

// What each part of the app depends on, and the health endpoint that answers for it.
const SERVICES = [
  { name: 'Accounts, posts & follows', url: `${POST_SERVICE_URL}/health/` },
  { name: 'Stories', url: `${STORY_SERVICE_URL}/health` },
  { name: 'Reels', url: `${REEL_SERVICE_URL}/api/v1/health` },
  { name: 'Encrypted chat', url: `${E2EE_SERVICE_URL}/health` },
  { name: 'Communities', url: `${COMMUNITY_SERVICE_URL}/api/v1/health` },
  { name: 'Explore', url: `${EXPLORE_SERVICE_URL}/actuator/health/liveness` },
  { name: 'News', url: `${NEWS_SERVICE_URL}/health` },
  { name: 'Markets', url: `${CHART_SERVICE_URL}/health` },
  { name: 'Live prices', url: `${CHART_SERVICE_URL}/quotes/batch?symbols=AAPL,BTC`, check: data => data.quotes?.some(q => q.price != null) },
]

async function probe(service) {
  const started = performance.now()
  try {
    const response = await fetch(service.url, { headers: { Authorization: `Bearer ${getToken()}` }, cache: 'no-store' })
    const ms = Math.round(performance.now() - started)
    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}`, ms }
    if (service.check && !service.check(await response.json())) return { ok: false, detail: 'no data from provider', ms }
    return { ok: true, ms }
  } catch (err) {
    return { ok: false, detail: err.message, ms: Math.round(performance.now() - started) }
  }
}

/** Which backend services are answering right now. Useful when something in the app is not loading. */
export default function Status() {
  const [results, setResults] = useState({})
  const [checkedAt, setCheckedAt] = useState(null)

  const run = useCallback(async () => {
    setResults({})
    const entries = await Promise.all(SERVICES.map(async s => [s.name, await probe(s)]))
    setResults(Object.fromEntries(entries))
    setCheckedAt(new Date())
  }, [])

  useEffect(() => { run() }, [run])

  const down = Object.values(results).filter(r => !r.ok).length

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Service status</h1>
          <p className="text-sm text-on-surface-muted">
            {checkedAt
              ? down ? `${down} part${down > 1 ? 's' : ''} not answering · checked ${checkedAt.toLocaleTimeString()}` : `Everything is up · checked ${checkedAt.toLocaleTimeString()}`
              : 'Checking…'}
          </p>
        </div>
        <button onClick={run} className="px-4 py-2 rounded-xl border border-white/[0.08] text-sm font-semibold text-on-surface hover:bg-white/5">Check again</button>
      </div>
      <Card className="divide-y divide-white/[0.06]">
        {SERVICES.map(s => {
          const r = results[s.name]
          return (
            <div key={s.name} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-on-surface">{s.name}</span>
              <span className={`flex items-center gap-2 text-xs font-semibold ${!r ? 'text-on-surface-muted' : r.ok ? 'text-bullish' : 'text-bearish'}`}>
                <span className={`w-2 h-2 rounded-full ${!r ? 'bg-on-surface-muted/40' : r.ok ? 'bg-bullish' : 'bg-bearish'}`} />
                {!r ? 'checking' : r.ok ? `up · ${r.ms} ms` : `down · ${r.detail}`}
              </span>
            </div>
          )
        })}
      </Card>
    </div>
  )
}
