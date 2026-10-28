import type { ProductApiFetch } from './product-api'

/**
 * ANAT-CONFIG-01 (tribusca-control#116): client of the accessible anatomy configuration API
 * (radar-fiscal-backend, /api/v1/admin/anatomy-config). Errors carry the server's Portuguese message and issues.
 */
const BASE = '/api/v1/admin/anatomy-config'

export type Nature = 'operative' | 'historical' | 'editorial_note' | 'amendment' | 'structure' | 'ambiguous'
export type Scope = { level: 'default' } | { level: 'source'; source: string } | { level: 'family'; source: string; family: string }
export interface Change { scope: Scope; path: string; action: 'add' | 'remove'; literal: string }
export interface Correction { sampleId: string; partKey: string; expected: Nature; note?: string }
export interface FieldInfo { path: string; group: string; field: string; title: string; help: string; example: string; produces: string; kind: string }
export interface RuleRow { scope: Scope; scopeLabel: string; path: string; title: string; help: string; literals: string[] }
export type Provenance = { kind: 'synthetic'; note: string } | { kind: 'official'; url: string; consultedAt: string; version: string; reason: string }
export interface SampleSummary { id: string; title: string; source: string; family: string | null; format: string; provenance: Provenance; covers: string[]; annotated: number }
export interface Overview {
  current: { versionId: string | null; version: number; origin: 'saved' | 'shipped'; corrections: Correction[]; kind?: string; author?: string; createdAt?: string; note?: string | null; rules: RuleRow[] }
  catalog: FieldInfo[]; samples: SampleSummary[]; natures: Record<Nature, string>; sources: Record<string, string>
}
export interface AiReading { anchor: string; structure: string; nature: Nature; natureLabel: string; validity: string; validityLabel: string; evidence: string; explanation: string;
  references?: string[]; ambiguity?: string; secondCheck: { agrees: boolean; note: string } }
export interface Passage { key: string; partId: string; parentKey: string | null; depth: number; type: string; structure: string; label: string; text: string;
  nature: Nature; natureLabel: string; validity: string; validityLabel: string; reasons: string[]; references: string[]; ncm: string[]; ai: AiReading | null }
export interface ReviewItem { sampleId: string; partKey: string | null; kind: string; title: string; detail: string }
export interface Described { status: string; statusLabel: string; passages: Passage[]; review: ReviewItem[]; counts: Record<Nature, number> }
export interface SampleAnalysis { id: string; title: string; source: string; provenance: Provenance; before: Described; after: Described
  diff: { changed: { key: string; structure: string; text: string; from: Nature; fromLabel: string; to: Nature; toLabel: string }[]; appeared: number; disappeared: number; reviewBefore: number; reviewAfter: number } }
export interface Analysis { basedOnVersion: number; changes: number; totals: { samples: number; passages: number; changedPassages: number; samplesChanged: number; reviewBefore: number; reviewAfter: number }; samples: SampleAnalysis[] }
export interface Suggestion extends Change { description: string; why: string }
export interface VersionRow { id: string; version: number; kind: 'save' | 'restore'; note: string | null; author: string; authorEmail: string | null; createdAt: string;
  restoredFrom: string | null; restoredFromVersion: number | null; correctionCount: number; current: boolean }
export interface AuditRow { id: string; action: string; actorEmail: string | null; data: Record<string, unknown>; occurredAt: string }

export class AnatomyConfigError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string, public readonly issues: { message: string }[] = []) { super(message) }
}
const uuid = () => (globalThis.crypto?.randomUUID?.() ?? '00000000-0000-4000-8000-000000000000')
async function call<T>(apiFetch: ProductApiFetch, method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await apiFetch(`${BASE}${path}`, {
    method, headers: { Accept: 'application/json', 'x-correlation-id': uuid(), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...(signal ? { signal } : {}),
  })
  const json: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const r = (json && typeof json === 'object' ? json : {}) as { error?: unknown; message?: unknown; issues?: unknown }
    throw new AnatomyConfigError(typeof r.error === 'string' ? r.error : 'request_failed', response.status,
      typeof r.message === 'string' ? r.message : 'Não foi possível concluir. Tente de novo; nada foi alterado.', Array.isArray(r.issues) ? r.issues as { message: string }[] : [])
  }
  return json as T
}
export const anatomyConfigApi = (apiFetch: ProductApiFetch) => ({
  overview: () => call<Overview>(apiFetch, 'GET', ''),
  analysis: (body: { changes?: Change[]; corrections?: Correction[] }, signal?: AbortSignal) => call<Analysis>(apiFetch, 'POST', '/analysis', body, signal),
  suggestions: (body: { sampleId: string; text: string; wanted: Nature }) => call<{ wantedLabel: string; suggestions: Suggestion[]; unsupported: string | null }>(apiFetch, 'POST', '/suggestions', body),
  save: (body: { basedOnVersion: number; changes: Change[]; corrections: Correction[]; note?: string }) => call<{ versionId: string; version: number }>(apiFetch, 'POST', '/save', body),
  restore: (body: { basedOnVersion: number; versionId: string; note?: string }) => call<{ versionId: string; version: number }>(apiFetch, 'POST', '/restore', body),
  versions: () => call<VersionRow[]>(apiFetch, 'GET', '/versions'),
  audit: () => call<AuditRow[]>(apiFetch, 'GET', '/audit'),
})
export type AnatomyConfigApi = ReturnType<typeof anatomyConfigApi>

export const scopeLabel = (s: Scope, sources: Record<string, string>) =>
  s.level === 'default' ? 'Padrão geral (todas as fontes)' : s.level === 'source' ? `Fonte: ${sources[s.source] ?? s.source}` : `Família "${s.family}" da fonte ${sources[s.source] ?? s.source}`
export function describeChange(c: Change, catalog: FieldInfo[], sources: Record<string, string>): string {
  const f = catalog.find((x) => x.path === c.path)
  return `${c.action === 'add' ? 'Incluir' : 'Retirar'} "${c.literal}" em ${f ? f.title.toLowerCase() : c.path} — ${scopeLabel(c.scope, sources)}`
}
export const sameChange = (a: Change, b: Change) => JSON.stringify(a) === JSON.stringify(b)
