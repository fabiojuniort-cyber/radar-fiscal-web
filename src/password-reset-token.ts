// This module is imported first by main.tsx, before the application graph.
// The token is never exported as data or placed in storage/query state.
let tokenInMemory: string | null = null

export function capturePasswordResetToken(): string | null {
  if (typeof window === 'undefined' || !/^\/nova-senha\/?$/.test(window.location.pathname)) return null
  const fragment = window.location.hash
  if (!fragment) return tokenInMemory
  tokenInMemory = null
  // Remove the fragment (and any unsupported query) before parsing or rendering.
  try {
    window.history.replaceState(window.history.state, '', window.location.pathname)
  } catch {
    // Fail closed if a browser cannot clean its current history entry.
    window.location.replace(window.location.pathname)
    return null
  }
  const values = new URLSearchParams(fragment.slice(1)).getAll('token')
  if (values.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(values[0])) tokenInMemory = values[0]
  return tokenInMemory
}

export function clearPasswordResetToken(): void {
  tokenInMemory = null
}

capturePasswordResetToken()
