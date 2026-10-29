// Deployment-specific details that are not service addresses (those are in services/apiConfig.js).
// Set at build time by deploy/docker/gateway.Dockerfile from deploy/.env.

// Where testers write for help, feedback, data requests and reports. Empty in local development.
export const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL || '').trim()

// Date the legal pages were last changed; shown on them.
export const LEGAL_UPDATED = '19 October 2026'
