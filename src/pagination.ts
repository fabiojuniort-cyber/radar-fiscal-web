export type PaginationToken = number | 'ellipsis'

export function paginationTokens(
  currentPage: number,
  totalPages: number,
): PaginationToken[] {
  const total = Math.max(1, Math.floor(totalPages))
  const current = Math.min(total, Math.max(1, Math.floor(currentPage)))

  if (total <= 9) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const pages = new Set<number>([1, total])

  if (current <= 6) {
    for (let page = 1; page <= 7; page += 1) pages.add(page)
  } else if (current >= total - 5) {
    for (let page = total - 6; page <= total; page += 1) pages.add(page)
  } else {
    pages.add(current - 2)
    pages.add(current - 1)
    pages.add(current)
    pages.add(current + 1)
    pages.add(current + 2)
  }

  const ordered = [...pages].sort((a, b) => a - b)
  const tokens: PaginationToken[] = []

  ordered.forEach((page, index) => {
    const previous = ordered[index - 1]
    if (previous && page - previous > 1) tokens.push('ellipsis')
    tokens.push(page)
  })

  return tokens
}
