import { describe, expect, it } from 'vitest'

import { paginationTokens } from './pagination'

describe('paginationTokens', () => {
  it('shows every page when the catalog is short', () => {
    expect(paginationTokens(3, 6)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('keeps the first and last page around the current window', () => {
    expect(paginationTokens(500, 999)).toEqual([
      1,
      'ellipsis',
      498,
      499,
      500,
      501,
      502,
      'ellipsis',
      999,
    ])
  })
})
