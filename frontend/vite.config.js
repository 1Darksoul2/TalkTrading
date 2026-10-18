import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    // Required for @noble/curves to resolve its subpath exports correctly
    // in Vite 8 / rolldown. Without this, imports like '@noble/curves/ed25519.js'
    // fail under the 'browser' condition map.
    conditions: ['browser', 'module', 'import', 'default'],
  },
})
