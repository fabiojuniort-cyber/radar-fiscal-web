import {OnboardingPhraseEditor} from './onboarding-phrase-editor'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ArrowLeft,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import type { ProductApiFetch } from './product-api'
import {
  PlatformAdminApiError,
  fetchPlatformAdministrators,
  grantPlatformAdministrator,
  revokePlatformAdministrator,
  type PlatformAdministrator,
} from './platform-admin-api'
import { fetchAdminMe } from './taxonomy-api'
import './platform-admin.css'

const ERROR_TEXT: Record<string, string> = {
  platform_admin_required: 'Seu usuário não possui acesso de administrador da plataforma.',
  platform_admin_user_not_found: 'Não existe uma conta com esse e-mail.',
  platform_admin_user_inactive: 'A conta informada não está ativa.',
  last_platform_admin: 'O último administrador ativo não pode ser removido.',
  platform_admin_email_required: 'Informe um e-mail.',
}

function errorText(error: unknown): string {
  if (error instanceof PlatformAdminApiError) {
    return ERROR_TEXT[error.code] ?? `Falha administrativa: ${error.code}`
  }
  return 'Não foi possível concluir a operação.'
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function PlatformAdministratorsPage({
  apiFetch,
}: {
  apiFetch: ProductApiFetch
}) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [revokeTarget, setRevokeTarget] =
    useState<PlatformAdministrator | null>(null)

  const meQuery = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: () => fetchAdminMe(apiFetch),
    retry: false,
  })

  const adminsQuery = useQuery({
    queryKey: ['platform', 'administrators'],
    queryFn: () => fetchPlatformAdministrators(apiFetch),
    retry: false,
    enabled: meQuery.data?.platformAdmin === true,
  })

  const activeAdmins = useMemo(
    () =>
      (adminsQuery.data?.items ?? []).filter(
        (item) => item.status === 'ACTIVE',
      ).length,
    [adminsQuery.data?.items],
  )

  const grant = useMutation({
    mutationFn: (target: string) =>
      grantPlatformAdministrator(apiFetch, target),
    onSuccess: async () => {
      setEmail('')
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['platform', 'administrators'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['admin', 'me'],
        }),
      ])
    },
  })

  const revoke = useMutation({
    mutationFn: (target: string) =>
      revokePlatformAdministrator(apiFetch, target),
    onSuccess: async () => {
      setRevokeTarget(null)
      await queryClient.invalidateQueries({
        queryKey: ['platform', 'administrators'],
      })
    },
  })

  if (meQuery.isPending) {
    return (
      <main className="auth-panel-loading">
        Verificando acesso administrativo…
      </main>
    )
  }

  if (meQuery.isError || !meQuery.data?.platformAdmin) {
    return (
      <div className="pa-app">
        <main className="pa-denied">
          <ShieldCheck size={30} />
          <h1>Acesso restrito</h1>
          <p>
            Esta área é exclusiva de administradores globais da plataforma.
          </p>
          <Link to="/painel">Voltar ao painel</Link>
        </main>
      </div>
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const target = email.trim()
    if (target) grant.mutate(target)
  }

  return (
    <div className="pa-app">
      <header className="pa-header">
        <Link to="/painel" className="pa-back">
          <ArrowLeft size={16} /> Painel
        </Link>
        <div>
          <span>Administração da plataforma</span>
          <h1>Administradores</h1>
          <p>
            Controle quem pode administrar Taxonomia, Filtro de Coleta,
            Novos tipos, Desconsiderados e Monitoramento técnico.
          </p>
        </div>
        <nav aria-label="Áreas administrativas">
          <Link to="/admin/taxonomia">Taxonomia</Link>
          <Link to="/admin/filtro-coleta">Filtro de Coleta</Link>
        </nav>
      </header>

      <main className="pa-main">
        <section className="pa-summary" aria-label="Resumo">
          <article>
            <KeyRound size={20} />
            <div>
              <strong>{activeAdmins}</strong>
              <span>administrador(es) ativo(s)</span>
            </div>
          </article>
          <p>
            Administradores globais têm acesso independente de plano ou
            licença. O último administrador ativo nunca pode ser removido.
          </p>
        </section>

        <section className="pa-card">
          <div className="pa-card-heading">
            <div>
              <h2>Conceder acesso</h2>
              <p>Use o e-mail de uma conta ativa já cadastrada.</p>
            </div>
          </div>
          <form className="pa-grant" onSubmit={submit}>
            <label>
              E-mail
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@empresa.com.br"
                required
              />
            </label>
            <button type="submit" disabled={grant.isPending}>
              <Plus size={16} />
              {grant.isPending ? 'Concedendo…' : 'Conceder acesso'}
            </button>
          </form>
          {grant.isError && (
            <p className="pa-error" role="alert">
              {errorText(grant.error)}
            </p>
          )}
        </section>

        <section className="pa-card">
          <div className="pa-card-heading">
            <div>
              <h2>Administradores atuais</h2>
              <p>
                Toda concessão e revogação fica registrada na auditoria.
              </p>
            </div>
          </div>

          {adminsQuery.isPending ? (
            <p className="pa-muted">Carregando administradores…</p>
          ) : adminsQuery.isError ? (
            <p className="pa-error" role="alert">
              {errorText(adminsQuery.error)}
            </p>
          ) : (
            <div className="pa-admin-list">
              {(adminsQuery.data?.items ?? []).map((item) => (
                <article key={item.userId} className="pa-admin-row">
                  <div className="pa-avatar" aria-hidden="true">
                    {(item.name || item.email)
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                  <div className="pa-admin-identity">
                    <strong>{item.name || 'Sem nome cadastrado'}</strong>
                    <span>{item.email}</span>
                    <small>
                      Acesso concedido em {formatDate(item.grantedAt)}
                    </small>
                  </div>
                  <span
                    className={
                      item.status === 'ACTIVE'
                        ? 'pa-status is-active'
                        : 'pa-status'
                    }
                  >
                    {item.status === 'ACTIVE' ? 'Ativo' : item.status}
                  </span>
                  <button
                    className="pa-revoke"
                    type="button"
                    onClick={() => setRevokeTarget(item)}
                  >
                    <Trash2 size={16} />
                    Remover
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      <OnboardingPhraseEditor apiFetch={apiFetch}/></main>

      <Dialog.Root
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => {
          if (!open && !revoke.isPending) setRevokeTarget(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="pa-dialog-overlay" />
          <Dialog.Content className="pa-dialog">
            <Dialog.Title>Remover administrador?</Dialog.Title>
            <Dialog.Description>
              {revokeTarget
                ? `O acesso global de ${revokeTarget.email} será removido. A operação será registrada na auditoria.`
                : ''}
            </Dialog.Description>
            <Dialog.Close asChild>
              <button className="pa-dialog-close" aria-label="Fechar">
                <X size={18} />
              </button>
            </Dialog.Close>
            {revoke.isError && (
              <p className="pa-error" role="alert">
                {errorText(revoke.error)}
              </p>
            )}
            <div className="pa-dialog-actions">
              <Dialog.Close asChild>
                <button type="button" disabled={revoke.isPending}>
                  Cancelar
                </button>
              </Dialog.Close>
              <button
                type="button"
                className="is-danger"
                disabled={revoke.isPending || !revokeTarget}
                onClick={() => {
                  if (revokeTarget) revoke.mutate(revokeTarget.email)
                }}
              >
                {revoke.isPending ? 'Removendo…' : 'Remover acesso'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
