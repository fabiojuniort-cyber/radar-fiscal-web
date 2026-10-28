let previousPhrase: string | undefined
/** Keep the last displayed phrase across assistant mounts, not only timer ticks. */
export function nextOnboardingPhrase(pool: string[], random = () => {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0]! / 0x100000000
}) {
  const unique = [...new Set(pool.filter(Boolean))]
  try { previousPhrase = sessionStorage.getItem('trifaros.onboarding.last-phrase') ?? previousPhrase } catch { /* Storage may be disabled. */ }
  const candidates = unique.filter(value => value !== previousPhrase)
  const available = candidates.length ? candidates : unique
  if (!available.length) return 'Preparando seu perfil…'
  const phrase = available[Math.min(available.length - 1, Math.floor(random() * available.length))]!
  previousPhrase = phrase
  try { sessionStorage.setItem('trifaros.onboarding.last-phrase', phrase) } catch { /* In-memory protection remains available. */ }
  return phrase
}
