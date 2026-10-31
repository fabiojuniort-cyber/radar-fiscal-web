/** ANAT-CONFIG-01: the accessible anatomy configuration exists only in builds that opt in explicitly (default off). */
export function parseAnatomyConfigFlag(value: unknown): boolean {
  return value === 'true'
}

export function anatomyConfigEnabled(): boolean {
  return parseAnatomyConfigFlag(import.meta.env.VITE_ENABLE_ANAT_CONFIG)
}
