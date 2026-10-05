import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.AUTH_PROXY_TARGET ?? process.env.VITE_API_BASE
const appProxy = apiTarget ? {
  '/auth': { target: apiTarget, changeOrigin: true, secure: true },
  '/api': { target: apiTarget, changeOrigin: true, secure: true },
  '/public': { target: apiTarget, changeOrigin: true, secure: true },
} : undefined

export default defineConfig({
  plugins: [react()],
  server: { proxy: appProxy },
  preview: {
    allowedHosts: [
      'web05-preview-production.up.railway.app',
      'trifaros.com.br',
      'www.trifaros.com.br',
    ],
    proxy: appProxy,
  },
})
