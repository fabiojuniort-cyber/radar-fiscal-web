import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Newspaper, Search } from 'lucide-react'
import { FormEvent, useState } from 'react'

import { fetchNews, type NewsItem } from './news-api'
import { paginationTokens } from './pagination'
import type { ProductApiFetch } from './product-api'
import { formatPublicDate } from './public-api'
import './news-section.css'

type Props = {
  apiFetch: ProductApiFetch
}

type NewsVisualProps = {
  item: NewsItem
  priority?: boolean
}

function NewsVisual({ item, priority = false }: NewsVisualProps) {
  const [failed, setFailed] = useState(false)

  if (!item.imageUrl || failed) {
    return (
      <div className="tp-news-image-fallback" aria-hidden="true">
        <Newspaper size={30} />
        <span>TriFaros Notícias</span>
      </div>
    )
  }

  return (
    <img
      className="tp-news-image"
      src={item.imageUrl}
      alt={`Imagem da notícia: ${item.title}`}
      loading={priority ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
    />
  )
}

function NewsMeta({ item }: { item: NewsItem }) {
  return (
    <div className="tp-news-meta">
      <strong>{item.category ?? item.agency ?? 'Notícia oficial'}</strong>
      <span>{formatPublicDate(item.publishedAt)}</span>
    </div>
  )
}

function NewsTags({ item, limit = 5 }: { item: NewsItem; limit?: number }) {
  if (item.tags.length === 0) return null
  return (
    <div className="tp-news-tags" aria-label="Marcadores da notícia">
      {item.tags.slice(0, limit).map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
    </div>
  )
}

function OfficialLink({ item, compact = false }: { item: NewsItem; compact?: boolean }) {
  return (
    <a
      className="tp-news-official-link"
      href={item.officialUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`Abrir notícia oficial: ${item.title}`}
    >
      {compact ? 'Ler notícia' : 'Abrir notícia oficial'}
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  )
}

function LeadStory({ item }: { item: NewsItem }) {
  return (
    <article className="tp-news-lead">
      <a
        className="tp-news-lead-visual"
        href={item.officialUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`Abrir notícia pela imagem: ${item.title}`}
      >
        <NewsVisual item={item} priority />
      </a>
      <div className="tp-news-lead-copy">
        <NewsMeta item={item} />
        <h2>{item.title}</h2>
        {item.summary && <p>{item.summary}</p>}
        <NewsTags item={item} />
        <OfficialLink item={item} />
      </div>
    </article>
  )
}

function SideStory({ item }: { item: NewsItem }) {
  return (
    <article className="tp-news-side-story">
      <a
        className="tp-news-side-visual"
        href={item.officialUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`Abrir notícia pela imagem: ${item.title}`}
      >
        <NewsVisual item={item} />
      </a>
      <NewsMeta item={item} />
      <h3>{item.title}</h3>
      {item.summary && <p>{item.summary}</p>}
      <OfficialLink item={item} compact />
    </article>
  )
}

function GridStory({ item }: { item: NewsItem }) {
  return (
    <article className="tp-news-grid-story">
      <a
        className="tp-news-grid-visual"
        href={item.officialUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`Abrir notícia pela imagem: ${item.title}`}
      >
        <NewsVisual item={item} />
      </a>
      <div className="tp-news-grid-copy">
        <NewsMeta item={item} />
        <h3>{item.title}</h3>
        {item.summary && <p>{item.summary}</p>}
        <NewsTags item={item} limit={3} />
        <OfficialLink item={item} compact />
      </div>
    </article>
  )
}

function CompactStory({ item }: { item: NewsItem }) {
  return (
    <article className="tp-news-compact-story">
      <div className="tp-news-compact-copy">
        <NewsMeta item={item} />
        <h3>{item.title}</h3>
        {item.summary && <p>{item.summary}</p>}
      </div>
      <OfficialLink item={item} compact />
    </article>
  )
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

  const items = newsQuery.data?.items ?? []
  const lead = items[0]
  const sideStories = items.slice(1, 3)
  const gridStories = items.slice(3, 6)
  const compactStories = items.slice(6)

  return (
    <section className="tp-news-section">
      <header className="tp-news-masthead">
        <div>
          <span className="tp-news-kicker">TriFaros · Inteligência tributária</span>
          <h1>Notícias</h1>
        </div>
        <p>Informação oficial selecionada por relevância fiscal e tributária.</p>
      </header>

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
      ) : items.length === 0 ? (
        <div className="tp-empty-state">
          <span className="tp-empty-mark">—</span>
          <div>
            <strong>Nenhuma notícia encontrada</strong>
            <p>Não há notícia para este recorte.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="tp-news-edition-bar" aria-label="Resumo da edição">
            <span>{appliedQuery ? `Resultados para “${appliedQuery}”` : 'Últimas notícias'}</span>
            <span>{newsQuery.data!.totalItems} matérias selecionadas</span>
          </div>

          <div className="tp-news-frontpage">
            {lead && <LeadStory item={lead} />}
            {sideStories.length > 0 && (
              <div className="tp-news-side-column">
                {sideStories.map((item) => <SideStory item={item} key={item.id} />)}
              </div>
            )}
          </div>

          {gridStories.length > 0 && (
            <section className="tp-news-featured" aria-labelledby="tp-news-featured-title">
              <div className="tp-news-section-rule">
                <h2 id="tp-news-featured-title">Em destaque</h2>
              </div>
              <div className="tp-news-grid">
                {gridStories.map((item) => <GridStory item={item} key={item.id} />)}
              </div>
            </section>
          )}

          {compactStories.length > 0 && (
            <section className="tp-news-more" aria-labelledby="tp-news-more-title">
              <div className="tp-news-section-rule">
                <h2 id="tp-news-more-title">Mais notícias</h2>
              </div>
              <div className="tp-news-compact-list">
                {compactStories.map((item) => <CompactStory item={item} key={item.id} />)}
              </div>
            </section>
          )}

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
