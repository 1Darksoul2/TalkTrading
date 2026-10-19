// Where each backend service lives. Production builds get these from the gateway build
// (deploy/docker/gateway.Dockerfile); `npm run dev` uses the ports start_all.py starts them on.
const DEV_DEFAULTS = {
  VITE_NEWS_SERVICE_URL: 'http://127.0.0.1:8000',
  VITE_STORY_SERVICE_URL: 'http://127.0.0.1:8001',
  VITE_CHART_SERVICE_URL: 'http://127.0.0.1:8002',
  VITE_E2EE_SERVICE_URL: 'http://127.0.0.1:8003',
  VITE_POST_SERVICE_URL: 'http://127.0.0.1:8004',
  VITE_REEL_SERVICE_URL: 'http://127.0.0.1:8005',
  VITE_COMMUNITY_SERVICE_URL: 'http://127.0.0.1:8080',
  VITE_EXPLORE_SERVICE_URL: 'http://127.0.0.1:8083',
}

function serviceUrl(name) {
  const value = import.meta.env[name] || (import.meta.env.DEV ? DEV_DEFAULTS[name] : '')
  // A production build without the address would silently talk to the wrong host; fail loudly instead.
  if (!value) throw new Error(`${name} is not set for this build`)
  return value.replace(/\/+$/, '')
}

export const NEWS_SERVICE_URL = serviceUrl('VITE_NEWS_SERVICE_URL')
export const STORY_SERVICE_URL = serviceUrl('VITE_STORY_SERVICE_URL')
export const CHART_SERVICE_URL = serviceUrl('VITE_CHART_SERVICE_URL')
export const E2EE_SERVICE_URL = serviceUrl('VITE_E2EE_SERVICE_URL')
export const POST_SERVICE_URL = serviceUrl('VITE_POST_SERVICE_URL')
export const REEL_SERVICE_URL = serviceUrl('VITE_REEL_SERVICE_URL')
export const COMMUNITY_SERVICE_URL = serviceUrl('VITE_COMMUNITY_SERVICE_URL')
export const EXPLORE_SERVICE_URL = serviceUrl('VITE_EXPLORE_SERVICE_URL')
