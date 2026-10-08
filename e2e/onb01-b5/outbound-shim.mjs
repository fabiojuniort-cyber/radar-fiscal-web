// ONB-01-B5: test-only backend preload, never import in production.
// Intercepts ONLY outbound fetch calls to external CNPJ providers.
// API endpoints /auth, /api, /public stay real and are never intercepted.
import { env } from 'node:process'
if (env.NODE_ENV !== 'test' || env.ONB01_B5_RUNNER_MODE !== 'isolated-postgres-service') {
  throw new Error('Refusing ONB-01-B5 outbound shim outside disposable test runner')
}
const originalFetch = globalThis.fetch
let blocked = 0
globalThis.fetch = async function b5OutboundFetch(input, init) {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (url.protocol === 'https:' && (
    (url.hostname === 'brasilapi.com.br' && url.pathname.startsWith('/api/cnpj/v1/')) ||
    url.hostname === 'minhareceita.org'
  )) {
    blocked++
    if (blocked > 10) throw new Error('B5 provider retry safety threshold reached')
    return new Response(JSON.stringify({ error: 'synthetic_provider_unavailable' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    })
  }
  if ((url.hostname === '127.0.0.1' || url.hostname === 'localhost') &&
      (url.protocol === 'http:' || url.protocol === 'https:')) {
    return originalFetch(input, init)
  }
  throw new Error('B5 blocked unexpected external fetch (' + url.hostname + ')')
}
