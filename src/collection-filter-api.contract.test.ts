import { describe, expect, it, vi } from 'vitest'
import {
  applyDirectCollectionFilterRule,
  CollectionFilterApiError,
  previewDirectCollectionFilterRule,
} from './collection-filter-api'

// Mirrors the exact JSON field names/status verified by backend
// test/collection-filter.admin.integration.test.ts (app.inject, HTTP 200).
// The SHA-256 token is fixture data, not a production token.
const previewWireBody = JSON.stringify({
  count: 1,
  blockedCompany: 1,
  blockedOtherSource: 1,
  token: 'a'.repeat(64),
})
const driftWireBody = JSON.stringify({
  changed: true,
  count: 2,
  blockedCompany: 1,
  blockedOtherSource: 1,
  token: 'b'.repeat(64),
  deletedCount: 0,
})
const successWireBody = JSON.stringify({
  changed: false,
  apagadas: 2,
  restantes: 0,
  deletedCount: 2,
  revision: 7,
  elapsedMs: 240,
})

const rule = {
  sourceCode: 'dou',
  section: 'DO3',
  canonicalType: 'AVISO DE LICITACAO PREGAO',
  mode: 'EXCLUDE_ALWAYS',
} as const

describe('L-11 backend response wire contract / browser parser', () => {
  it('parses the backend preview HTTP 200 payload and preserves confirmation token', async () => {
    const apiFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(previewWireBody, {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
    await expect(previewDirectCollectionFilterRule(apiFetch, rule)).resolves.toEqual({
      count: 1,
      blockedCompany: 1,
      blockedOtherSource: 1,
      token: 'a'.repeat(64),
    })
    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(apiFetch.mock.calls[0]?.[0]).toBe('/api/v1/admin/collection-filter/direct-rule/preview')
    expect(JSON.parse(String(apiFetch.mock.calls[0]?.[1]?.body))).toEqual(rule)
  })

  it('parses the backend confirm count-drift payload without treating it as success', async () => {
    const apiFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(driftWireBody, {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
    const result = await applyDirectCollectionFilterRule(apiFetch, {
      ...rule, expectedCount: 1, previewToken: 'a'.repeat(64),
    })
    expect(result).toMatchObject({
      changed: true, count: 2, blockedCompany: 1, blockedOtherSource: 1,
      token: 'b'.repeat(64), deletedCount: 0,
    })
    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(apiFetch.mock.calls[0]?.[0]).toBe('/api/v1/admin/collection-filter/direct-rule/confirm')
  })

  it('parses the backend successful confirm payload once, without auto retry', async () => {
    const apiFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(successWireBody, {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
    const result = await applyDirectCollectionFilterRule(apiFetch, {
      ...rule, expectedCount: 2, previewToken: 'b'.repeat(64),
    })
    expect(result).toEqual({
      changed: false, apagadas: 2, restantes: 0, deletedCount: 2,
      revision: 7, elapsedMs: 240,
    })
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })

  it('reveals the actual browser HTTP status when non-JSON middleware rejects preview', async () => {
    const apiFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('<html>Service Unavailable</html>', {
      status: 503, headers: { 'Content-Type': 'text/html' },
    }))
    await expect(previewDirectCollectionFilterRule(apiFetch, rule)).rejects.toMatchObject({
      code: 'collection_filter_request_failed_http_503',
      status: 503,
    } satisfies Partial<CollectionFilterApiError>)
  })

  it('does not retry confirmation after an HTTP 502, as deletion may have committed', async () => {
    const apiFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('Gateway error', { status: 502 }))
    await expect(applyDirectCollectionFilterRule(apiFetch, {
      ...rule, expectedCount: 2, previewToken: 'b'.repeat(64),
    })).rejects.toMatchObject({
      code: 'collection_filter_request_failed_http_502',
      status: 502,
    } satisfies Partial<CollectionFilterApiError>)
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })
})
