import { CHART_SERVICE_URL } from './apiConfig'

const BASE_URL = (CHART_SERVICE_URL || 'http://127.0.0.1:8002').replace(/\/+$/, '')

async function apiFetch(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`)
  Object.entries(params).forEach(([k,v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const resp = await fetch(url, { signal: controller.signal })
    if (!resp.ok) {
      const error = await resp.json().catch(() => ({ detail: resp.statusText }))
      throw new Error(error.detail || `HTTP ${resp.status}`)
    }
    return await resp.json()
  } finally { clearTimeout(timeout) }
}
export const getSymbols = category => apiFetch('/symbols', category ? {category}: {})
export const getQuote = symbol => apiFetch(`/symbols/${encodeURIComponent(symbol)}/quote`)
export const getBatchQuotes = symbols => !symbols?.length ? Promise.resolve({quotes:[]}) : apiFetch('/quotes/batch',{symbols:symbols.join(',')})
export const getSparkline = symbol => apiFetch(`/symbols/${encodeURIComponent(symbol)}/sparkline`)
export const getChartServiceHealth = () => apiFetch('/health')
export default {healthCheck:getChartServiceHealth,getSymbols,getQuote,getBatchQuotes,getSparkline}
