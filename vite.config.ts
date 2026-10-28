import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.AUTH_PROXY_TARGET ?? process.env.VITE_API_BASE
const appProxy = apiTarget ? {
  '/auth': { target: apiTarget, changeOrigin: true, secure: true },
  '/api': { target: apiTarget, changeOrigin: true, secure: true },
  '/public': { target: apiTarget, changeOrigin: true, secure: true },
} : undefined

const buildId=process.env.RAILWAY_GIT_COMMIT_SHA??process.env.GITHUB_SHA??('local-'+Date.now())
export default defineConfig({
  define:{'import.meta.env.VITE_APP_BUILD_ID':JSON.stringify(buildId)},
  plugins: [react(),{name:'trifaros-build-version',generateBundle(){this.emitFile({type:'asset',fileName:'build-version.json',source:JSON.stringify({id:buildId})})}}],
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
