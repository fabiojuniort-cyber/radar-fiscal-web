import * as Dialog from '@radix-ui/react-dialog'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  BookOpen,
  Building2,
  Check,
  CircleHelp,
  FileSearch,
  Layers3,
  MonitorCheck,
  Menu,
  RadioTower,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import {
  DECODIFICA_EXAMPLES,
  FEDERAL_COVERAGE,
  STATE_COVERAGE,
  selectFeaturedStates,
} from './content'
import { AuthSessionProvider, useAuthSession } from './auth-session'
import { AuthenticatedProductPanel } from './authenticated-product-panel'
import { DEMO_PATH, isDemoAccessEnabled } from './demo-access'
import { PanelExperience } from './panel-experience'
import { PublicationDetailPage } from './publication-detail-page'
import {
  PRIVACY_POLICY,
  TERMS_OF_USE,
  type LegalDocument,
} from './legal-content'
import { PublicExperience } from './public-experience'
import { getPasswordChecks, isStrongPassword } from './password'
import {
  SignupApiError,
  registerPublicAccount,
} from './signup-api'
import {
  fetchPublicSources,
  findFederalSource,
  findStateSource,
  toCoveragePresentation,
} from './public-api'

type AuthView = 'login' | 'signup' | 'forgot' | 'reset'
type SonarLevel = 'high' | 'medium' | 'low'
type OpenAuth = (view: AuthView, returnFocus: HTMLElement) => void

const products = [
  {
    name: 'Acervo',
    descriptor: 'Base oficial organizada',
    icon: BookOpen,
    status: 'Em desenvolvimento',
    description: 'Publicações, versões, fontes, marcadores e busca em uma experiência única.',
  },
  {
    name: 'Central de Monitoramento',
    descriptor: 'Saúde das fontes',
    icon: MonitorCheck,
    status: 'Em desenvolvimento',
    description: 'Acompanhe consultas, indisponibilidades, falhas, última atualização e cobertura.',
  },
  {
    name: 'Sonar',
    descriptor: 'Afinidade Tributária',
    icon: RadioTower,
    status: 'Em desenvolvimento',
    description: 'Aproxima cada publicação do perfil tributário da empresa e dos estabelecimentos.',
  },
  {
    name: 'Revela',
    descriptor: 'Boletim inteligente',
    icon: BellRing,
    status: 'Em desenvolvimento',
    description: 'Entrega diariamente sinais de Alta afinidade e menções diretas.',
  },
  {
    name: 'Decodifica',
    descriptor: 'Leitura auxiliar',
    icon: Sparkles,
    status: 'Em desenvolvimento',
    description: 'Apresenta uma leitura mais clara, sempre ao lado da referência oficial.',
  },
  {
    name: 'Perfil Tributário',
    descriptor: 'Contexto da empresa',
    icon: Building2,
    status: 'Em desenvolvimento',
    description: 'Organiza os atributos usados para contextualizar empresas e estabelecimentos.',
  },
] as const

function App() {
  return <AuthSessionProvider><AppContent /></AuthSessionProvider>
}

function AppContent() {
  const location = useLocation()
  const demoAccessEnabled = isDemoAccessEnabled()
  const [authView, setAuthView] = useState<AuthView | null>(null)
  const authReturnFocus = useRef<HTMLElement | null>(null)
  const openAuth: OpenAuth = (view, returnFocus) => {
    authReturnFocus.current = returnFocus
    setAuthView(view)
  }
  const closeAuth = () => {
    const target = authReturnFocus.current
    setAuthView(null)
    window.requestAnimationFrame(() => {
      if (target?.isConnected) target.focus()
    })
  }

  if (location.pathname === DEMO_PATH) {
    return demoAccessEnabled ? <DemoPage /> : <Navigate to="/" replace />
  }

  const publicationDetailMatch =
    /^\/painel\/publicacoes\/([0-9a-f-]{36})$/i.exec(
      location.pathname,
    )

  if (publicationDetailMatch?.[1]) {
    return (
      <AuthenticatedPublicationDetail
        publicationId={publicationDetailMatch[1]}
      />
    )
  }

  if (location.pathname === '/painel') {
    return <AuthenticatedPanel />
  }

  return (
    <div className="app-shell">
      <PublicExperience onAuth={openAuth} />
      <AuthModal
        view={authView}
        onView={setAuthView}
        onClose={closeAuth}
        getReturnFocus={() => authReturnFocus.current}
      />
    </div>
  )
}

function AuthenticatedPanel() {
  const { me, checked, ensureSession, logout, apiFetch } = useAuthSession()
  const [logoutError, setLogoutError] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!me && !checked) void ensureSession()
  }, [me, checked, ensureSession])

  if (!me) {
    return checked ? <Navigate to="/" replace /> : <main className="auth-panel-loading">Verificando acesso…</main>
  }

  return (
    <AuthenticatedProductPanel
      identity={{
        name: me.user.name ?? me.user.email,
        email: me.user.email,
        memberships: me.memberships,
      }}
      apiFetch={apiFetch}
      exitError={logoutError ? 'Não foi possível encerrar a sessão. Tente novamente.' : null}
      onExit={async () => {
        setLogoutError(false)
        try {
          await logout()
          navigate('/')
        } catch {
          setLogoutError(true)
        }
      }}
    />
  )
}

function AuthenticatedPublicationDetail({
  publicationId,
}: {
  publicationId: string
}) {
  const {
    me,
    checked,
    ensureSession,
    apiFetch,
  } = useAuthSession()

  useEffect(() => {
    if (!me && !checked) {
      void ensureSession()
    }
  }, [me, checked, ensureSession])

  if (!me) {
    return checked
      ? <Navigate to="/" replace />
      : (
          <main className="auth-panel-loading">
            Verificando acesso…
          </main>
        )
  }

  return (
    <PublicationDetailPage
      publicationId={publicationId}
      apiFetch={apiFetch}
    />
  )
}

function DemoPage() {
  const navigate = useNavigate()

  return (
    <PanelExperience
      mode="demo"
      identity={{
        name: 'Ana Ribeiro',
        email: 'ana.ribeiro@empresa.com.br',
        memberships: [],
      }}
      onExit={() => navigate('/')}
    />
  )
}

function SiteHeader({ onAuth }: { onAuth: OpenAuth }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const closeMobile = () => setMobileOpen(false)

  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <Link to="/" className="brand-link" aria-label="TriBusca — página inicial" onClick={closeMobile}>
          <img
            src="/brand/tribusca-logo-horizontal-light.png"
            alt="TriBusca"
            className="brand-horizontal"
          />
        </Link>

        <nav aria-label="Navegação principal" className="nav-links">
          <NavLink to="/cobertura">Cobertura</NavLink>
          <NavLink to="/portfolio">Portfólio</NavLink>
          <NavLink to="/como-funciona">Como funciona</NavLink>
          <NavLink to="/reforma-tributaria">Reforma Tributária</NavLink>
        </nav>

        <div className="nav-actions">
          <button className="btn btn-secondary btn-small" type="button" onClick={(event) => onAuth('login', event.currentTarget)}>
            Entrar
          </button>
          <span className="btn btn-small coming-soon-action" aria-label="Cadastro em breve" aria-disabled="true">
            Em breve
          </span>
          <button
            ref={mobileMenuButtonRef}
            className="mobile-menu-button"
            type="button"
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="mobile-nav" aria-label="Navegação móvel">
          <div className="container mobile-nav-inner">
            <NavLink to="/cobertura" onClick={closeMobile}>Cobertura</NavLink>
            <NavLink to="/portfolio" onClick={closeMobile}>Portfólio</NavLink>
            <NavLink to="/como-funciona" onClick={closeMobile}>Como funciona</NavLink>
            <NavLink to="/reforma-tributaria" onClick={closeMobile}>Reforma Tributária</NavLink>
            <button
              type="button"
              onClick={(event) => {
                const returnFocus = mobileMenuButtonRef.current ?? event.currentTarget
                closeMobile()
                onAuth('login', returnFocus)
              }}
            >
              Entrar
            </button>
            <span className="mobile-coming-soon" aria-disabled="true">Cadastro em breve</span>
          </div>
        </nav>
      )}
    </header>
  )
}

function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Monitoramento e Inteligência Tributária</span>
            <h1>Saiba o que mudou. Entenda o que importa. Chegue à fonte oficial.</h1>
            <p className="hero-copy">
              O TriBusca acompanha fontes oficiais e organiza mudanças tributárias para sua empresa
              chegar mais rápido ao que merece atenção.
            </p>
            <div className="hero-actions">
              <span className="btn coming-soon-action hero-coming-soon" aria-label="Cadastro em breve" aria-disabled="true">
                Cadastro em breve
              </span>
              <Link className="btn btn-secondary" to="/portfolio">
                Conhecer o portfólio
              </Link>
            </div>
            <p className="availability-note">Cadastro em breve.</p>
          </div>
          <SonarHero />
        </div>
      </section>

      <StateCarousel />

      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Portfólio"
            title="Uma base oficial. Seis formas de transformar informação em contexto."
            copy="Cada recurso resolve uma etapa diferente da jornada, sem misturar fato oficial, inteligência TriBusca e conteúdo gerado por IA."
          />
          <div className="feature-grid feature-grid-six">
            {products.map((product) => (
              <article className="feature-card" key={product.name}>
                <div className="icon-box">
                  <product.icon size={24} />
                </div>
                <div className="feature-title-row">
                  <h3>{product.name}</h3>
                  <StatusChip status={product.status} />
                </div>
                <p className="feature-descriptor">{product.descriptor}</p>
                <p>{product.description}</p>
              </article>
            ))}
          </div>
          <div className="section-cta">
            <Link to="/portfolio" className="text-link">
              Ver portfólio completo <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container trust-grid">
          <div>
            <span className="eyebrow">Rastreabilidade</span>
            <h2>A fonte oficial continua no centro.</h2>
            <p>
              A TriBusca organiza o caminho até a evidência: origem, versão, histórico e contexto
              permanecem distinguíveis das camadas de inteligência.
            </p>
          </div>
          <div className="trust-list">
            <TrustItem icon={FileSearch} title="Fonte oficial" text="Origem e referência preservadas." />
            <TrustItem icon={Layers3} title="Histórico" text="Versões sem apagar o passado." />
            <TrustItem icon={ShieldCheck} title="Transparência" text="Fato, inteligência e IA identificados." />
          </div>
        </div>
      </section>
    </main>
  )
}

function StateCarousel() {
  const states = useMemo(() => selectFeaturedStates(), [])
  const [index, setIndex] = useState(0)
  const current = states[index]

  const previous = () => setIndex((value) => (value - 1 + states.length) % states.length)
  const next = () => setIndex((value) => (value + 1) % states.length)

  return (
    <section className="section state-section">
      <div className="container">
        <SectionHeading
          eyebrow="Cobertura estadual"
          title="Monitoramento tributário nos estados"
          copy="São Paulo abre a seleção. Outros quatro estados são sorteados a cada carregamento."
        />
        <div className="state-carousel" data-testid="state-carousel">
          <img src={current.img} alt={current.place} className="state-photo" />
          <div className="state-overlay" />
          <div className="state-copy">
            <span className="state-position">{index + 1} / {states.length}</span>
            <p className="micro-label">UF em destaque</p>
            <h3>{current.name} / {current.uf}</h3>
            <p>{current.capital} · {current.place}</p>
            <div className="state-publications">
              <strong>Últimas / principais publicações</strong>
              <span>—</span>
              <span>—</span>
              <span>—</span>
            </div>
            <a href={current.page} target="_blank" rel="noreferrer" className="photo-credit">
              Foto: {current.author} · {current.license} · Wikimedia Commons
            </a>
          </div>
          <div className="carousel-controls">
            <button type="button" onClick={previous} aria-label="Estado anterior"><ArrowLeft /></button>
            <button type="button" onClick={next} aria-label="Próximo estado"><ArrowRight /></button>
          </div>
        </div>
        <div className="carousel-dots" aria-label="Estados em destaque">
          {states.map((state, stateIndex) => (
            <button
              key={state.uf}
              type="button"
              aria-label={`Exibir ${state.name}`}
              aria-current={stateIndex === index}
              className={stateIndex === index ? 'active' : ''}
              onClick={() => setIndex(stateIndex)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function CoveragePage() {
  const states = [...STATE_COVERAGE].sort((a, b) => {
    if (a.uf === 'SP') return -1
    if (b.uf === 'SP') return 1
    return a.name.localeCompare(b.name, 'pt-BR')
  })
  const sourcesQuery = useQuery({
    queryKey: ['public-sources'],
    queryFn: ({ signal }) => fetchPublicSources(undefined, signal),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
  const dataAvailable = sourcesQuery.isSuccess && !sourcesQuery.isFetching
  const sourceItems = dataAvailable ? sourcesQuery.data.items : []

  return (
    <main>
      <PageHero
        eyebrow="Cobertura"
        title="Fontes oficiais acompanhadas pela TriBusca."
        copy="O status operacional vem da API pública oficial. Enquanto uma fonte não tiver dado público disponível, a interface mantém “—” sem inventar sucesso ou métricas."
      />
      <section className="section">
        <div className="container coverage-stack">
          <div>
            <h2>Serviços federais</h2>
            <p className="muted">Primeiro bloco da cobertura.</p>
          </div>
          {FEDERAL_COVERAGE.map((source) => {
            const presentation = toCoveragePresentation(
              findFederalSource(sourceItems, source.code),
              dataAvailable,
            )
            return (
              <CoverageCard
                key={source.code}
                name={source.name}
                {...presentation}
                testId="federal-coverage-card"
              />
            )
          })}

          <div className="coverage-separator">
            <h2>27 UFs</h2>
            <p className="muted">São Paulo primeiro; demais unidades em ordem alfabética.</p>
          </div>
          {states.map((state) => {
            const presentation = toCoveragePresentation(
              findStateSource(sourceItems, state.uf),
              dataAvailable,
            )
            return (
              <CoverageCard
                key={state.uf}
                name={`${state.name} / ${state.uf}`}
                {...presentation}
                testId="state-coverage-card"
              />
            )
          })}
        </div>
      </section>
    </main>
  )
}

function CoverageCard({
  name,
  status,
  lastSuccessAt,
  importedToday,
  totalPublications,
  testId,
}: {
  name: string
  status: string
  lastSuccessAt: string
  importedToday: string
  totalPublications: string
  testId?: string
}) {
  return (
    <article className="coverage-card" data-testid={testId}>
      <div className="coverage-identity">
        <strong>{name}</strong>
        <span className={`collection-status ${status === '—' ? 'collection-pending-data' : `collection-${status.toLowerCase().replaceAll(' ', '-')}`}`}>
          {status}
        </span>
      </div>
      <dl className="coverage-metrics">
        <div><dt>Última atualização</dt><dd>{lastSuccessAt}</dd></div>
        <div><dt>Importadas hoje</dt><dd>{importedToday}</dd></div>
        <div><dt>Total no Acervo</dt><dd>{totalPublications}</dd></div>
      </dl>
    </article>
  )
}

function PortfolioPage() {
  return (
    <main>
      <PageHero
        eyebrow="Portfólio"
        title="Ferramentas diferentes para perguntas diferentes."
        copy="Do Acervo à afinidade tributária, cada camada tem uma função clara e preserva a fonte oficial."
      />

      <section className="section">
        <div className="container feature-grid feature-grid-six">
          {products.map((product) => (
            <article className="feature-card" key={product.name}>
              <div className="icon-box"><product.icon size={24} /></div>
              <div className="feature-title-row">
                <h3>{product.name}</h3>
                <StatusChip status={product.status} />
              </div>
              <p className="feature-descriptor">{product.descriptor}</p>
              <p>{product.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section-soft">
        <div className="container portfolio-stack">
          <ProductDetail
            icon={RadioTower}
            name="Sonar"
            descriptor="Afinidade Tributária"
            statement="Quanto mais próximo do centro, maior a afinidade com o Perfil Tributário."
          >
            <div className="sonar-scale">
              <SonarState level="high" label="Alta afinidade" description="Sinal próximo" />
              <SonarState level="medium" label="Média afinidade" description="Distância intermediária" />
              <SonarState level="low" label="Baixa afinidade" description="Sinal distante" />
            </div>
            <div className="signal-list">
              {['Goiás', 'ICMS', 'Fertilizantes', 'NCM 3105', 'Produtor rural'].map((signal) => (
                <span key={signal}>{signal}</span>
              ))}
            </div>
            <p className="fine-print">Os rótulos textuais permanecem visíveis; cor e distância nunca são a única informação.</p>
          </ProductDetail>

          <ProductDetail
            icon={BellRing}
            name="Revela"
            descriptor="Boletim inteligente"
            statement="Uma seleção diária do que merece sua atenção."
          >
            <div className="daily-bulletin">
              <div className="bulletin-header">
                <span>Revela · Boletim diário</span>
                <strong>Hoje</strong>
              </div>
              <div className="bulletin-item">
                <span className="reason-badge reason-affinity">Alta afinidade</span>
                <div><strong>Publicação próxima ao seu perfil tributário</strong><p>ICMS · Goiás · Fertilizantes</p></div>
              </div>
              <div className="bulletin-item">
                <span className="reason-badge reason-mention">Menção direta</span>
                <div><strong>Empresa ou estabelecimento citado</strong><p>Menção identificada diretamente na publicação oficial.</p></div>
              </div>
            </div>
          </ProductDetail>

          <DecodificaShowcase />
        </div>
      </section>
    </main>
  )
}

function DecodificaShowcase() {
  const [index, setIndex] = useState(0)
  const example = DECODIFICA_EXAMPLES[index]

  return (
    <ProductDetail
      icon={Sparkles}
      name="Decodifica"
      descriptor="Leitura auxiliar"
      statement="Texto oficial e leitura clara lado a lado, sem substituir a fonte."
    >
      <div className="decodifica-carousel">
        <div className="decodifica-topline">
          <div>
            <span className="micro-label">Exemplo {index + 1} de {DECODIFICA_EXAMPLES.length}</span>
            <h3>{example.title}</h3>
            <p>{example.source}</p>
          </div>
          <div className="carousel-controls inline-controls">
            <button type="button" aria-label="Exemplo anterior" onClick={() => setIndex((index - 1 + DECODIFICA_EXAMPLES.length) % DECODIFICA_EXAMPLES.length)}><ArrowLeft /></button>
            <button type="button" aria-label="Próximo exemplo" onClick={() => setIndex((index + 1) % DECODIFICA_EXAMPLES.length)}><ArrowRight /></button>
          </div>
        </div>
        <div className="legal-pair">
          <article>
            <span className="micro-label">Texto oficial</span>
            <p>“{example.official}”</p>
            <strong>{example.source}</strong>
          </article>
          <article className="auxiliary-reading">
            <span className="micro-label">Leitura auxiliar</span>
            <p>{example.auxiliary}</p>
            <small>Gerada por IA. Não substitui o texto oficial.</small>
          </article>
        </div>
      </div>
    </ProductDetail>
  )
}

function HowItWorksPage() {
  const steps = [
    ['1', 'Fonte oficial', 'Conectores consultam as fontes previstas e preservam a origem.'],
    ['2', 'Captura e organização', 'Conteúdo é normalizado, deduplicado e versionado no Acervo.'],
    ['3', 'Marcadores', 'A publicação recebe sinais tributários úteis para busca e contexto.'],
    ['4', 'Sonar', 'Os sinais são comparados ao Perfil Tributário para calcular afinidade.'],
    ['5', 'Revela e Decodifica', 'O usuário recebe o que merece atenção e pode pedir leitura auxiliar.'],
    ['6', 'Evidência', 'A fonte oficial continua acessível para conferência.'],
  ]

  return (
    <main>
      <PageHero
        eyebrow="Como funciona"
        title="Da fonte oficial ao contexto da empresa."
        copy="A TriBusca separa coleta, organização, afinidade, entrega e compreensão para manter cada etapa explicável."
      />
      <section className="section">
        <div className="container process-list">
          {steps.map(([number, title, description]) => (
            <article className="process-step" key={number}>
              <span>{number}</span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

function TaxReformPage() {
  return (
    <main>
      <PageHero
        eyebrow="Reforma Tributária"
        title="Um ponto único para acompanhar a transformação do sistema tributário."
        copy="Legislação, regulamentação, notas técnicas e marcos reunidos como um recorte temático do Acervo."
      />
      <section className="section">
        <div className="container data-card-grid">
          {[
            ['Legislação', 'Atos oficiais relacionados à reforma.'],
            ['Regulamentação', 'Regulamentos e atos complementares.'],
            ['Notas técnicas', 'Documentos técnicos publicados pelas fontes oficiais.'],
            ['Acervo da Reforma', 'Busca e histórico do recorte temático.'],
          ].map(([title, text]) => (
            <article className="data-card" key={title}><h3>{title}</h3><p>{text}</p></article>
          ))}
        </div>
      </section>
      <section className="section section-soft">
        <div className="container">
          <SectionHeading
            eyebrow="Linha do tempo"
            title="Publicação, vigência e marcos previstos em lei não são a mesma coisa."
            copy="A timeline só receberá datas quando houver evidência oficial correspondente no Acervo."
          />
          <div className="timeline-card">
            <TimelineRow type="Publicação" description="Data em que o ato oficial foi publicado." />
            <TimelineRow type="Vigência" description="Data em que a regra passa a produzir efeitos, quando informada oficialmente." />
            <TimelineRow type="Marco previsto em lei" description="Etapa futura do faseamento expressamente prevista em fonte oficial." />
          </div>
        </div>
      </section>
    </main>
  )
}

function TimelineRow({ type, description }: { type: string; description: string }) {
  return (
    <div className="timeline-row">
      <div className="timeline-icon"><Check size={18} /></div>
      <div>
        <span className="timeline-type">{type}</span>
        <strong>—</strong>
        <p>{description}</p>
      </div>
    </div>
  )
}

function AuthModal({
  view,
  onView,
  onClose,
  getReturnFocus,
}: {
  view: AuthView | null
  onView: (view: AuthView) => void
  onClose: () => void
  getReturnFocus: () => HTMLElement | null
}) {
  const [signupSuccessEmail, setSignupSuccessEmail] = useState('')

  useEffect(() => {
    if (view === 'signup') setSignupSuccessEmail('')
  }, [view])

  const signupCreated = (email: string) => {
    setSignupSuccessEmail(email)
    onView('login')
  }

  return (
    <Dialog.Root open={view !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            const target = getReturnFocus()
            if (target?.isConnected) {
              event.preventDefault()
              target.focus()
            }
          }}
        >
          <Dialog.Close className="dialog-close" aria-label="Fechar"><X size={18} /></Dialog.Close>
          <img src="/brand/tribusca-logo-horizontal-light.png" alt="TriBusca" className="dialog-logo" />
          {view === 'login' && (
            <LoginForm
              onClose={onClose}
              onView={onView}
              initialEmail={signupSuccessEmail}
              accountCreated={signupSuccessEmail.length > 0}
            />
          )}
          {view === 'signup' && (
            <PasswordFlow
              mode="signup"
              onView={onView}
              onSignupCreated={signupCreated}
            />
          )}
          {view === 'forgot' && <ForgotPassword onView={onView} />}
          {view === 'reset' && <PasswordFlow mode="reset" onView={onView} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function LoginForm({
  onClose,
  onView,
  initialEmail = '',
  accountCreated = false,
}: {
  onClose: () => void
  onView: (view: AuthView) => void
  initialEmail?: string
  accountCreated?: boolean
}) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const navigate = useNavigate()
  const demoAccessEnabled = isDemoAccessEnabled()
  const { login: loginSession } = useAuthSession()

  const login = useMutation({
    mutationFn: async () => {
      await loginSession(email, password)
    },
    onSuccess: () => {
      setPassword('')
      onClose()
      navigate('/painel')
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    login.mutate()
  }

  const openDemo = () => {
    onClose()
    navigate(DEMO_PATH)
  }

  return (
    <>
      <Dialog.Title>Entrar na TriBusca</Dialog.Title>
      <p className="dialog-intro">Acesse sua conta TriBusca.</p>
      {accountCreated && (
        <p className="auth-success" role="status">
          Conta criada com sucesso. Entre com a senha que você acabou de definir.
        </p>
      )}
      <form className="auth-form" onSubmit={submit}>
        <label>E-mail<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Senha<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {login.isError && <p className="auth-error" role="alert">Não foi possível entrar. Verifique suas credenciais e tente novamente.</p>}
        <button className="btn full" type="submit" disabled={login.isPending}>{login.isPending ? 'Entrando…' : 'Entrar'}</button>
      </form>
      {demoAccessEnabled && (
        <div className="demo-login-option">
          <div className="demo-login-separator" aria-hidden="true"><span>ou</span></div>
          <button className="btn btn-secondary full" type="button" onClick={openDemo}>
            Entrar em modo demonstração
          </button>
          <p>Acesso temporário para navegação e validação da interface.</p>
        </div>
      )}
      <p className="auth-switch">Ainda não tem conta? <button type="button" onClick={() => onView('signup')}>Criar conta</button></p>
    </>
  )
}

function ForgotPassword({ onView }: { onView: (view: AuthView) => void }) {
  return (
    <>
      <Dialog.Title>Recuperar senha</Dialog.Title>
      <p className="dialog-intro">
        Para recuperar o acesso, entre em contato pelo canal de suporte da TriBusca.
      </p>
      <p className="auth-switch"><button type="button" onClick={() => onView('login')}>Voltar para Entrar</button></p>
    </>
  )
}

function PasswordFlow({
  mode,
  onView,
  onSignupCreated,
}: {
  mode: 'signup' | 'reset'
  onView: (view: AuthView) => void
  onSignupCreated?: (email: string) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [legalView, setLegalView] = useState<'terms' | 'privacy' | null>(null)
  const checks = getPasswordChecks(password)
  const match = password.length > 0 && password === confirm
  const valid = isStrongPassword(password) && match && (mode === 'reset' || acceptedTerms)

  const signup = useMutation({
    mutationFn: async () => registerPublicAccount({
      name,
      email,
      company,
      cnpj: cnpj.trim() || undefined,
      password,
      confirmPassword: confirm,
      acceptedTerms,
    }),
    onSuccess: (account) => {
      setPassword('')
      setConfirm('')
      onSignupCreated?.(account.user.email)
    },
  })

  const signupError = (() => {
    if (!signup.isError) return null
    const error = signup.error

    if (error instanceof SignupApiError) {
      switch (error.code) {
        case 'email_already_registered':
          return 'Este e-mail já está cadastrado. Use Entrar para acessar a conta.'
        case 'company_already_registered':
          return 'Este CNPJ já está associado a uma conta TriBusca. Não foi criado um segundo tenant.'
        case 'invalid_password':
          return 'A senha não atende aos requisitos ou a confirmação não coincide.'
        case 'invalid_signup_data':
          return 'Revise os dados informados e tente novamente.'
        case 'too_many_requests':
          return 'Muitas tentativas de cadastro para este e-mail. Aguarde e tente novamente.'
        case 'network_error':
          return 'Não foi possível concluir o cadastro. Verifique sua conexão e tente novamente.'
        case 'unexpected_error':
          return 'Não foi possível criar a conta agora. Tente novamente.'
      }
    }

    return 'Não foi possível criar a conta agora. Tente novamente.'
  })()

  const submit = (event: FormEvent) => {
    event.preventDefault()

    if (mode === 'signup' && valid && !signup.isPending) {
      signup.mutate()
    }
  }

  return (
    <>
      <Dialog.Title>{mode === 'signup' ? 'Criar conta' : 'Nova senha'}</Dialog.Title>
      <p className="dialog-intro">
        {mode === 'signup'
          ? '7 dias para conhecer a TriBusca. Crie sua conta com seus próprios dados de acesso.'
          : 'Defina uma nova senha para sua conta.'}
      </p>
      <form className="auth-form" onSubmit={submit}>
        {mode === 'signup' && (
          <>
            <label>Nome completo<input type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={160} required /></label>
            <label>E-mail corporativo<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} required /></label>
            <label>Empresa<input type="text" autoComplete="organization" value={company} onChange={(event) => setCompany(event.target.value)} minLength={2} maxLength={200} required /></label>
            <label>CNPJ<input type="text" inputMode="numeric" value={cnpj} onChange={(event) => setCnpj(event.target.value)} maxLength={32} placeholder="Opcional" /></label>
          </>
        )}
        <label>Senha<input aria-label="Senha" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <label>Confirmar senha<input aria-label="Confirmar senha" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></label>
        <div className="password-rules" aria-label="Requisitos da senha">
          <PasswordRule ok={checks.minLength} text="Mínimo de 8 caracteres" />
          <PasswordRule ok={checks.uppercase} text="Uma letra maiúscula" />
          <PasswordRule ok={checks.lowercase} text="Uma letra minúscula" />
          <PasswordRule ok={checks.number} text="Um número" />
          <PasswordRule ok={checks.special} text="Um caractere especial" />
          <PasswordRule ok={match} text="As senhas coincidem" />
        </div>
        {mode === 'signup' && (
          <div className="terms-check">
            <input
              type="checkbox"
              aria-label="Aceite dos Termos de uso e da Política de privacidade"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              required
            />
            <span>
              Li e aceito os{' '}
              <button
                type="button"
                className="legal-inline-button"
                onClick={() => setLegalView('terms')}
              >
                Termos de uso
              </button>{' '}
              e a{' '}
              <button
                type="button"
                className="legal-inline-button"
                onClick={() => setLegalView('privacy')}
              >
                Política de privacidade
              </button>.
            </span>
          </div>
        )}
        {mode === 'signup' && signupError && (
          <p className="auth-error" role="alert">{signupError}</p>
        )}
        <button
          className="btn full"
          type="submit"
          disabled={!valid || (mode === 'signup' && signup.isPending)}
        >
          {mode === 'signup'
            ? (signup.isPending ? 'Criando conta…' : 'Criar conta')
            : 'Salvar nova senha'}
        </button>
      </form>
      <p className="auth-switch"><button type="button" onClick={() => onView('login')}>Voltar para Entrar</button></p>
      <LegalSignupDialog
        document={
          legalView === 'terms'
            ? TERMS_OF_USE
            : legalView === 'privacy'
              ? PRIVACY_POLICY
              : null
        }
        onClose={() => setLegalView(null)}
      />
    </>
  )
}

function LegalSignupDialog({
  document,
  onClose,
}: {
  document: LegalDocument | null
  onClose: () => void
}) {
  return (
    <Dialog.Root
      open={document !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="legal-dialog-overlay" />
        {document && (
          <Dialog.Content
            className="legal-dialog-content"
            aria-describedby="legal-dialog-description"
          >
            <Dialog.Close
              className="dialog-close"
              aria-label="Fechar"
            >
              <X size={18} />
            </Dialog.Close>
            <Dialog.Title>{document.title}</Dialog.Title>
            <Dialog.Description
              id="legal-dialog-description"
              className="legal-dialog-intro"
            >
              Versão {document.version} · Vigente desde {document.effectiveDate}.
            </Dialog.Description>
            <p className="legal-dialog-summary">{document.intro}</p>
            <div className="legal-dialog-scroll">
              {document.sections.map((section) => (
                <section key={section.title}>
                  <h3>{section.title}</h3>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </section>
              ))}
            </div>
          </Dialog.Content>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function PasswordRule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={ok ? 'rule-ok' : 'rule-pending'} aria-label={`${text}: ${ok ? 'atendido' : 'pendente'}`}>
      {ok ? <Check size={14} aria-hidden="true" /> : <CircleHelp size={14} aria-hidden="true" />}
      {text}
    </span>
  )
}

function SonarHero() {
  return (
    <div className="sonar-hero-card">
      <span className="micro-label">Sonar · Afinidade Tributária</span>
      <SonarVisual level="high" />
      <div><strong>Alta afinidade</strong><p>Sinal próximo ao Perfil Tributário.</p></div>
    </div>
  )
}

function SonarVisual({ level }: { level: SonarLevel }) {
  return (
    <div className={`sonar sonar-${level}`} role="img" aria-label={`${level === 'high' ? 'Alta' : level === 'medium' ? 'Média' : 'Baixa'} afinidade no Sonar`}>
      <span className="sonar-ring ring-1" />
      <span className="sonar-ring ring-2" />
      <span className="sonar-ring ring-3" />
      <span className="sonar-sweep" />
      <span className="sonar-center" />
      <span className="sonar-ping" />
    </div>
  )
}

function SonarState({ level, label, description }: { level: SonarLevel; label: string; description: string }) {
  return (
    <div className={`sonar-state sonar-state-${level}`}>
      <SonarVisual level={level} />
      <div><strong>{label}</strong><span>{description}</span></div>
    </div>
  )
}

function ProductDetail({
  icon: Icon,
  name,
  descriptor,
  statement,
  children,
}: {
  icon: typeof Search
  name: string
  descriptor: string
  statement: string
  children: React.ReactNode
}) {
  return (
    <article className="product-detail">
      <div className="product-copy">
        <div className="icon-box"><Icon size={24} /></div>
        <h2>{name}</h2>
        <p className="feature-descriptor">{descriptor}</p>
        <p className="product-statement">{statement}</p>
      </div>
      <div className="product-content">{children}</div>
    </article>
  )
}

function StatusChip({ status }: { status: string }) {
  return <span className="status-chip">{status}</span>
}

function TrustItem({ icon: Icon, title, text }: { icon: typeof Search; title: string; text: string }) {
  return (
    <div className="trust-item"><Icon size={22} /><div><strong>{title}</strong><span>{text}</span></div></div>
  )
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="section-heading"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{copy}</p></div>
}

function PageHero({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <section className="page-hero"><div className="container"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div></section>
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-wrap">
        <img src="/brand/tribusca-logo-horizontal-dark.png" alt="TriBusca" className="footer-logo" />
        <p>Monitoramento e Inteligência Tributária.</p>
        <p className="footer-note">Fonte oficial no centro.</p>
      </div>
    </footer>
  )
}

export default App
