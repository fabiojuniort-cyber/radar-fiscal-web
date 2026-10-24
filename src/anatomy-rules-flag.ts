/** ANAT-ADMIN-01 P4: the anatomy-rules admin screens exist only in builds that opt in explicitly (default off). */
export function parseAnatomyRulesAdminFlag(value: unknown): boolean {
  return value === 'true'
}

export function anatomyRulesAdminEnabled(): boolean {
  return parseAnatomyRulesAdminFlag(import.meta.env.VITE_ENABLE_ANAT_RULES_ADMIN)
}
