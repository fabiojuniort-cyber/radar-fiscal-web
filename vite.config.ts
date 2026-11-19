import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// The existing preview server is the application server used in homologation.
// No Railway/proxy configuration is changed by this plugin.
const resetCsp = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"
const resetPageHeaders: Plugin = {
  name: 'auth-reset-page-headers',
  configurePreviewServer(server) {
    server.middlewares.use((request, response, next) => {
      if (/^\/nova-senha\/?$/.test((request.url ?? '').split('?')[0])) {
        response.setHeader('Referrer-Policy', 'no-referrer')
        response.setHeader('Content-Security-Policy', resetCsp)
        response.setHeader('Cache-Control', 'no-store')
      }
      next()
    })
  },
}

const apiTarget = process.env.AUTH_PROXY_TARGET ?? process.env.VITE_API_BASE
const appProxy = apiTarget ? {
  '/auth': { target: apiTarget, changeOrigin: true, secure: true },
  '/api': { target: apiTarget, changeOrigin: true, secure: true },
  '/public': { target: apiTarget, changeOrigin: true, secure: true },
} : undefined

const buildId=process.env.RAILWAY_GIT_COMMIT_SHA??process.env.GITHUB_SHA??('local-'+Date.now())
export default defineConfig({
  define:{'import.meta.env.VITE_APP_BUILD_ID':JSON.stringify(buildId)},
  plugins: [react(),resetPageHeaders,{name:'trifaros-build-version',generateBundle(){this.emitFile({type:'asset',fileName:'build-version.json',source:JSON.stringify({id:buildId})})}}],
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
