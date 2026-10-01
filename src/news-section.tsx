import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Newspaper, Search } from 'lucide-react'
import { FormEvent, useState } from 'react'

import { fetchNews } from './news-api'
import { paginationTokens } from './pagination'
import type { ProductApiFetch } from './product-api'
import { formatPublicDate } from './public-api'
import './news-section.css'

type Props = {
  apiFetch: ProductApiFetch
}

export function NewsSection({ apiFetch }: Props) {
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [page, setPage] = useState(1)

  const newsQuery = useQuery({
    queryKey: ['news', appliedQuery, page],
    queryFn: () => fetchNews(apiFetch, {
      q: appliedQuery || undefined,
      page,
      limit: 20,
    }),
    retry: false,
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAppliedQuery(query.trim())
    setPage(1)
  }

  return (
    <section className="tp-news-section">
      <div className="tp-section-heading">
        <span className="tp-eyebrow">Notícias tributárias</span>
        <h1>Notícias</h1>
        <p>
          Conteúdo oficial selecionado por relevância tributária e fiscal, sempre com acesso à fonte original.
        </p>
      </div>

      <form className="tp-news-search" onSubmit={submit}>
        <label htmlFor="tp-news-query">Buscar notícias</label>
        <div className="tp-news-search-row">
          <div className="tp-news-search-input">
            <Search size={17} aria-hidden="true" />
            <input
              id="tp-news-query"
              type="search"
              value={query}
              placeholder="IBS, CBS, NF-e, Simples Nacional…"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <button type="submit">Buscar notícias</button>
          {appliedQuery && (
            <button
              type="button"
              className="tp-news-secondary-action"
              onClick={() => {
                setQuery('')
                setAppliedQuery('')
                setPage(1)
              }}
            >
              Limpar busca
            </button>
          )}
        </div>
      </form>

      {newsQuery.isLoading || newsQuery.isFetching ? (
        <div className="tp-empty-state">
          <span className="tp-empty-mark">…</span>
          <div><strong>Carregando notícias</strong></div>
        </div>
      ) : newsQuery.isError ? (
        <div className="tp-empty-state is-error">
          <span className="tp-empty-mark">!</span>
          <div>
            <strong>Não foi possível carregar as notícias</strong>
            <p>Tente novamente em instantes.</p>
          </div>
        </div>
      ) : (newsQuery.data?.items.length ?? 0) === 0 ? (
        <div className="tp-empty-state">
          <span className="tp-empty-mark">—</span>
          <div>
            <strong>Nenhuma notícia encontrada</strong>
            <p>Não há notícia para este recorte.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="tp-news-list">
            {newsQuery.data!.items.map((item) => (
              <article className="tp-news-card" key={item.id}>
                <div className="tp-news-icon" aria-hidden="true">
                  <Newspaper size={18} />
                </div>
                <div className="tp-news-copy">
                  <div className="tp-news-meta">
                    <strong>{item.sourceName}</strong>
                    <span>
                      {item.category ?? item.agency ?? 'Notícia oficial'}
                      {' · '}
                      {formatPublicDate(item.publishedAt)}
                    </span>
                  </div>
                  <h2>{item.title}</h2>
                  {item.summary && <p>{item.summary}</p>}
                  {item.tags.length > 0 && (
                    <div className="tp-news-tags" aria-label="Marcadores da notícia">
                      {item.tags.slice(0, 8).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  )}
                  <a
                    className="tp-news-official-link"
                    href={item.officialUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir notícia oficial <ExternalLink size={15} aria-hidden="true" />
                  </a>
                </div>
              </article>
            ))}
          </div>

          <div className="tp-news-pagination" aria-label="Paginação de notícias">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Voltar página
            </button>
            <div className="tp-page-numbers">
              {paginationTokens(page, newsQuery.data!.totalPages).map((token, index) =>
                token === 'ellipsis' ? (
                  <span key={`ellipsis-${index}`}>…</span>
                ) : (
                  <button
                    key={token}
                    type="button"
                    className={token === page ? 'is-active' : ''}
                    aria-current={token === page ? 'page' : undefined}
                    aria-label={`Ir para a página ${token}`}
                    onClick={() => setPage(token)}
                  >
                    {token}
                  </button>
                ),
              )}
            </div>
            <button
              type="button"
              disabled={page >= newsQuery.data!.totalPages}
              onClick={() => setPage((current) => Math.min(newsQuery.data!.totalPages, current + 1))}
            >
              Avançar página
            </button>
          </div>
          <p className="tp-pagination-summary">
            Página {page} de {newsQuery.data!.totalPages} · {newsQuery.data!.totalItems} notícias
          </p>
        </>
      )}
    </section>
  )
}
