import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const authTarget = process.env.AUTH_PROXY_TARGET ?? process.env.VITE_API_BASE
const authProxy = authTarget ? {
  '/auth': { target: authTarget, changeOrigin: true, secure: true },
} : undefined

export default defineConfig({
  plugins: [react()],
  server: { proxy: authProxy },
  preview: {
    allowedHosts: ['web05-preview-production.up.railway.app'],
    proxy: authProxy,
  },
})
