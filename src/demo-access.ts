export const DEMO_PATH = '/painel-demo'

export function parseDemoAccessFlag(value: unknown) {
  return value === 'true'
}

export function isDemoAccessEnabled() {
  return parseDemoAccessFlag(import.meta.env.VITE_ENABLE_DEMO_ACCESS)
}
