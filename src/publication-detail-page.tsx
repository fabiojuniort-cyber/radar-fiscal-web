import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  History,
  Landmark,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { formatPublicDate } from './public-api'
import {
  fetchProductPublicationDetail,
  type ProductApiFetch,
} from './product-api'
import './publication-detail-page.css'

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

export function PublicationDetailPage({
  publicationId,
  apiFetch,
}: Props) {
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

  if (detailQuery.isPending) {
    return (
      <main className="publication-detail-shell">
        <div className="publication-detail-state">
          <strong>
            Carregando legislação…
          </strong>
          <p>
            Buscando a versão preservada no
            Acervo TriBusca.
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
            A publicação pode estar indisponível
            ou ter sido removida do Acervo.
          </p>
          <Link
            to="/painel"
            className="publication-back-link"
          >
            <ArrowLeft size={16} />
            Voltar ao painel
          </Link>
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

  return (
    <div className="publication-detail-app">
      <header className="publication-detail-header">
        <Link
          to="/painel"
          className="publication-detail-brand"
          aria-label="Voltar ao painel TriBusca"
        >
          <img
            src="/brand/tribusca-logo-horizontal-light.png"
            alt="TriBusca"
          />
        </Link>

        <Link
          to="/painel"
          className="publication-back-link"
        >
          <ArrowLeft size={16} />
          Voltar ao Acervo
        </Link>
      </header>

      <main className="publication-detail-main">
        <section className="publication-document-header">
          <div className="publication-document-badges">
            <span>Acervo oficial</span>
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
            <small>
              Estrutura e espaçamento preservados
              da captura oficial.
            </small>
          </div>

          {version?.presentation.format ===
          'SANITIZED_HTML' ? (
            <div
              className="publication-preserved-html"
              data-presentation-format="SANITIZED_HTML"
              // The backend re-sanitizes this allowlisted legal HTML
              // before returning it. Raw source HTML is never rendered.
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
                Conteúdo integral ainda não
                armazenado
              </strong>
              <p>
                A referência oficial foi preservada.
                Use o botão “Abrir fonte oficial”
                para consultar o documento na origem.
              </p>
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
