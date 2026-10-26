import type { ProductApiFetch } from './product-api'

/**
 * ANAT-ADMIN-01 P4 (tribusca-control#116): client of the administrative anatomy-rules API (backend P3-D,
 * radar-fiscal-backend#260). Every call carries a correlation id; errors surface only the server's code.
 */
const BASE = '/api/v1/admin/anatomy-rules'

export class AnatomyRulesApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly correlationId: string | null) { super(code) }
}

export type CandidateState = 'frozen' | 'simulated' | 'approved' | 'rejected' | 'active' | 'superseded'
export type RowOutcome = 'pass' | 'fail' | 'partial' | 'inconclusive' | 'cancelled' | 'failed'
export interface Draft { id: string; author: string; revision: number; updatedAt: string; profiles: unknown[]; examples: Example[] }
export interface Example { id: string; [key: string]: unknown }
export interface Candidate {
  id: string; ruleSetId: string; ruleHash: string; exampleSetId: string; exampleSetHash: string; engineHash: string
  createdBy: string; draftId: string; draftRevision: number; draftAuthor: string; state: CandidateState; createdAt: string
  profiles?: unknown[]; examples?: Example[]
}
export interface SimulationSummary {
  id: string; status: 'complete' | 'partial' | 'cancelled' | 'failed'; passCount: number; failCount: number; partialCount: number
  cancelledCount: number; inconclusiveCount: number; reportHash: string; requestedBy: string; createdAt: string
  rows: { exampleId: string; outcome: RowOutcome; outputHash: string | null; analysisId: string | null }[]
}
export interface Difference { id: string; category: string; key: string; change: 'added' | 'removed' | 'changed'; before: unknown; after: unknown }
export interface ComparisonRecord {
  id: string; exampleId: string; comparisonHash: string; baselineRuleSetId: string; baselineRuleHash: string; createdAt: string
  envelope: { differences: Difference[]; counts: Record<string, { before: number; after: number }> }
}
export interface ReviewRecord {
  id: string; simulationId: string; reviewer: string; outcome: 'approved' | 'rejected'; rationale: string; createdAt: string
  comparisonIds: string[]; decisions: { comparisonId: string; differenceId: string; decision: string; note: string }[]
}
export interface CandidateDetail { candidate: Candidate; simulations: SimulationSummary[]; comparisons: ComparisonRecord[]; reviews: ReviewRecord[] }
export interface AffectedScope {
  basis: 'active_candidate' | 'shipped_defaults'
  targets: { source: string; family: string | null; changed: boolean; beforeEffectiveHash: string; afterEffectiveHash: string }[]
  publications: { status: string; reason: string }; analyses: { status: string; reason: string }
  unknownFamily: string; reprocessing: string
}
export interface Preview { previewId: string; intentHash: string; expiresAt: string; token: string; affectedScope: AffectedScope }
export interface Activation {
  id: string; scope: string; candidateId: string; reviewId: string; kind: 'activate' | 'rollback'; previousActivationId: string | null
  previewId: string; actor: string; justification: string; activatedAt: string; supersededAt: string | null
}
export interface AuditEntry { id: string; action: string; entityId: string; actorId: string; data: Record<string, unknown>; correlationId: string | null; occurredAt: string }

const uuid = () => (globalThis.crypto?.randomUUID?.() ?? '00000000-0000-4000-8000-000000000000')

async function call<T>(apiFetch: ProductApiFetch, method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await apiFetch(`${BASE}${path}`, {
    method,
    headers: { Accept: 'application/json', 'x-correlation-id': uuid(), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(signal ? { signal } : {}),
  })
  const json: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const record = (json && typeof json === 'object' ? json : {}) as { error?: unknown; correlationId?: unknown }
    throw new AnatomyRulesApiError(typeof record.error === 'string' ? record.error : 'anatomy_rules_request_failed', response.status,
      typeof record.correlationId === 'string' ? record.correlationId : null)
  }
  return json as T
}

export const anatomyRulesApi = (apiFetch: ProductApiFetch) => ({
  drafts: () => call<Draft[]>(apiFetch, 'GET', '/drafts'),
  createDraft: (profiles: unknown[], examples: unknown[]) => call<{ id: string; revision: number }>(apiFetch, 'POST', '/drafts', { profiles, examples }),
  updateDraft: (id: string, revision: number, profiles: unknown[], examples: unknown[]) =>
    call<{ id: string; revision: number }>(apiFetch, 'PUT', `/drafts/${id}`, { revision, profiles, examples }),
  freeze: (id: string, revision: number) => call<{ candidateId: string; created: boolean }>(apiFetch, 'POST', `/drafts/${id}/freeze`, { revision }),
  candidates: () => call<Candidate[]>(apiFetch, 'GET', '/candidates'),
  candidate: (id: string) => call<CandidateDetail>(apiFetch, 'GET', `/candidates/${id}`),
  simulate: (id: string, signal?: AbortSignal) =>
    call<{ simulationId: string; status: string; rows: { exampleId: string; outcome: RowOutcome; reason: string | null }[] }>(apiFetch, 'POST', `/candidates/${id}/simulate`, undefined, signal),
  compare: (id: string, scope: string, baselineRuleSetId: string | null, signal?: AbortSignal) =>
    call<{ baselineRuleSetId: string; comparisons: { exampleId: string; comparisonId: string; differenceCount: number }[] }>(apiFetch, 'POST', `/candidates/${id}/compare`, { scope, baselineRuleSetId }, signal),
  review: (id: string, body: { simulationId: string; outcome: 'approved' | 'rejected'; rationale: string; comparisonIds: string[];
    decisions: { comparisonId: string; differenceId: string; decision: string; note?: string }[] }) => call<{ reviewId: string }>(apiFetch, 'POST', `/candidates/${id}/reviews`, body),
  preview: (body: { action: 'activate' | 'rollback'; candidateId: string; reviewId: string; scope: string }) => call<Preview>(apiFetch, 'POST', '/activation/preview', body),
  confirm: (body: { token: string; intentHash: string; justification: string }) => call<{ activationId: string; replayed: boolean }>(apiFetch, 'POST', '/activation/confirm', body),
  activations: () => call<Activation[]>(apiFetch, 'GET', '/activations'),
  audit: () => call<AuditEntry[]>(apiFetch, 'GET', '/audit'),
})
export type AnatomyRulesApi = ReturnType<typeof anatomyRulesApi>

/** Pure rules mirrored from §2.5 for the UI (the database remains the authority). */
export function approvalBlockers(detail: CandidateDetail, simulationId: string | null, decisions: Record<string, string>, reviewerId: string): string[] {
  const out: string[] = []
  const c = detail.candidate
  if (reviewerId === c.createdBy || reviewerId === c.draftAuthor) out.push('Você é autor deste candidato e não pode revisá-lo.')
  const sim = detail.simulations.find((s) => s.id === simulationId)
  const examples = c.examples ?? []
  if (!sim) out.push('Escolha uma simulação deste candidato.')
  else if (sim.status !== 'complete' || sim.rows.length !== examples.length || sim.rows.some((r) => r.outcome !== 'pass')) {
    out.push('Todos os exemplos precisam estar em pass numa simulação completa.')
  }
  const latest = new Map<string, ComparisonRecord>()
  for (const k of detail.comparisons) if (!latest.has(k.exampleId)) latest.set(k.exampleId, k)
  if (examples.some((e) => !latest.has(e.id))) out.push('Falta uma comparação para algum exemplo.')
  const diffs = [...latest.values()].flatMap((k) => k.envelope.differences.map((d) => `${k.id}:${d.id}`))
  if (diffs.some((key) => decisions[key] !== 'expected')) out.push('Toda diferença precisa ser marcada como esperada para aprovar.')
  return out
}
export const shortHash = (h: string | null | undefined) => (h ? `${h.slice(0, 8)}…` : '—')
