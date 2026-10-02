import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  History,
  Landmark,
  Search,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { formatPublicDate } from './public-api'
import { fetchPublicationNcms } from './product-ncm-api'
import {
  fetchProductPublicationDetail,
  type ProductApiFetch,
} from './product-api'
import './publication-detail-page.css'
import './publication-ncm.css'

type Props = {
  publicationId: string
  apiFetch: ProductApiFetch
}

function referenceLabel(
  actType: string | null,
  actNumber: string | null,
  title: string,
) {
  const reference = [actType, actNumber]
    .filter(Boolean)
    .join(' ')

  return reference || title
}

function formatNcmCode(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 8) return value
  return (
    digits.slice(0, 4) + '.' +
    digits.slice(4, 6) + '.' +
    digits.slice(6, 8)
  )
}

function setArchiveNcmState(code: string) {
  const normalized = code.replace(/\D/g, '')
  if (normalized.length !== 8) return
  const formatted = formatNcmCode(normalized)

  try {
    const raw = sessionStorage.getItem('tribusca.panel.state')
    const current = raw
      ? JSON.parse(raw) as Record<string, unknown>
      : {}

    sessionStorage.setItem(
      'tribusca.panel.state',
      JSON.stringify({
        ...current,
        screen: 'acervo',
        query: formatted,
        appliedQuery: formatted,
        archivePage: 1,
      }),
    )
  } catch {
    sessionStorage.setItem(
      'tribusca.panel.state',
      JSON.stringify({
        screen: 'acervo',
        query: formatted,
        appliedQuery: formatted,
        archivePage: 1,
      }),
    )
  }
}

export function PublicationDetailPage({
  publicationId,
  apiFetch,
}: Props) {
  const navigate = useNavigate()
  const detailQuery = useQuery({
    queryKey: [
      'publication-detail',
      publicationId,
    ],
    queryFn: () =>
      fetchProductPublicationDetail(
        apiFetch,
        publicationId,
      ),
    retry: false,
  })

  const ncmQuery = useQuery({
    queryKey: ['publication-ncms', publicationId],
    queryFn: () => fetchPublicationNcms(apiFetch, publicationId),
    enabled: Boolean(publicationId),
    retry: false,
  })

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/painel')
  }

  const openNcmInArchive = (code: string) => {
    setArchiveNcmState(code)
    navigate('/painel')
  }

  if (detailQuery.isPending) {
    return (
      <main className="publication-detail-shell">
        <div className="publication-detail-state">
          <strong>
            Carregando legislação…
          </strong>
          <p>
            Buscando a versão armazenada no Acervo TriBusca.
          </p>
        </div>
      </main>
    )
  }

  if (detailQuery.isError) {
    return (
      <main className="publication-detail-shell">
        <div className="publication-detail-state is-error">
          <strong>
            Não foi possível abrir esta legislação
          </strong>
          <p>
            A publicação pode estar indisponível ou ter sido removida do Acervo.
          </p>
          <button
            type="button"
            className="publication-back-link"
            onClick={goBack}
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
        </div>
      </main>
    )
  }

  const {
    publication,
    version,
    origins,
  } = detailQuery.data

  const reference = referenceLabel(
    publication.actType,
    publication.actNumber,
    publication.title,
  )

  const versionLabel =
    version && version.versionCount > 1
      ? 'Versão ' +
        version.versionNo +
        ' de ' +
        version.versionCount
      : version
        ? 'Versão ' + version.versionNo
        : null

  const ncms = ncmQuery.data ?? []

  return (
    <div className="publication-detail-app">
      <header className="publication-detail-header">
        <Link
          to="/painel"
          className="publication-detail-brand"
          aria-label="Abrir painel TriBusca"
        >
          <img
            src="/brand/tribusca-logo-horizontal-dark.png"
            alt="TriBusca"
          />
        </Link>

        <button
          type="button"
          className="publication-back-link"
          onClick={goBack}
        >
          <ArrowLeft size={16} />
          Voltar
        </button>
      </header>

      <main className="publication-detail-main">
        <section className="publication-document-header">
          <div className="publication-document-badges">
            <span>
              {publication.uf ?? 'Federal'}
            </span>
            {versionLabel && (
              <span>{versionLabel}</span>
            )}
          </div>

          <p className="publication-document-reference">
            {reference}
          </p>

          <h1>{publication.title}</h1>

          <div className="publication-document-meta">
            <span>
              <Landmark size={16} />
              {publication.agency ??
                'Órgão não informado'}
            </span>
            <span>
              Publicação:{' '}
              {formatPublicDate(
                publication.publishedOn,
              )}
            </span>
            {publication.effectiveOn && (
              <span>
                Vigência:{' '}
                {formatPublicDate(
                  publication.effectiveOn,
                )}
              </span>
            )}
            {version?.capturedAt && (
              <span>
                <History size={16} />
                Capturada pelo TriBusca
              </span>
            )}
          </div>

          <div className="publication-document-actions">
            {publication.officialUrl && (
              <a
                href={publication.officialUrl}
                target="_blank"
                rel="noreferrer"
                className="publication-official-button"
              >
                <ExternalLink size={17} />
                Abrir fonte oficial
              </a>
            )}
          </div>
        </section>

        <section className="publication-document-card">
          <div className="publication-document-card-head">
            <span>
              <FileText size={18} />
              Texto da legislação
            </span>
          </div>

          {version?.presentation.format ===
          'SANITIZED_HTML' ? (
            <div
              className="publication-preserved-html"
              data-presentation-format="SANITIZED_HTML"
              dangerouslySetInnerHTML={{
                __html:
                  version.presentation.html,
              }}
            />
          ) : version?.contentText ? (
            <div
              className="publication-preserved-text"
              data-presentation-format={
                version.presentation.format
              }
            >
              {version.contentText}
            </div>
          ) : version?.excerpt ? (
            <div className="publication-preserved-text">
              {version.excerpt}
            </div>
          ) : (
            <div className="publication-detail-empty">
              <strong>
                Conteúdo integral ainda não armazenado
              </strong>
              <p>
                Use “Abrir fonte oficial” para consultar o documento na origem.
              </p>
            </div>
          )}
        </section>

        <section className="publication-origins-card publication-ncm-card">
          <h2>NCMs identificados nesta legislação</h2>
          <p>
            Códigos confirmados no catálogo oficial e extraídos do conteúdo armazenado.
          </p>

          {ncmQuery.isPending ? (
            <p className="publication-ncm-state">Carregando NCMs identificados…</p>
          ) : ncmQuery.isError ? (
            <p className="publication-ncm-state is-error">
              Não foi possível carregar os NCMs identificados. O texto da legislação continua disponível normalmente.
            </p>
          ) : ncms.length === 0 ? (
            <p className="publication-ncm-state">
              Nenhum NCM do catálogo oficial foi identificado nesta versão.
            </p>
          ) : (
            <div className="publication-ncm-list">
              {ncms.map((ncm) => (
                <article className="publication-ncm-item" key={ncm.code}>
                  <div>
                    <strong>{formatNcmCode(ncm.code)}</strong>
                    {ncm.description && <span>{ncm.description}</span>}
                    {ncm.excerpt && <small>{ncm.excerpt}</small>}
                  </div>
                  <button
                    type="button"
                    onClick={() => openNcmInArchive(ncm.code)}
                  >
                    <Search size={15} />
                    Buscar este NCM no Acervo
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {origins.length > 0 && (
          <section className="publication-origins-card">
            <h2>Origens oficiais</h2>
            <div className="publication-origin-list">
              {origins.map((origin) => (
                <a
                  key={
                    origin.sourceCode +
                    origin.officialUrl
                  }
                  href={origin.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>
                    <strong>
                      {origin.sourceName}
                    </strong>
                    <small>
                      {origin.sourceCode}
                    </small>
                  </span>
                  <ExternalLink size={16} />
                </a>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
