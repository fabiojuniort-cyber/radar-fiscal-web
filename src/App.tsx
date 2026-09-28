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
import { FormEvent, useMemo, useRef, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import {
  DECODIFICA_EXAMPLES,
  FEDERAL_COVERAGE,
  STATE_COVERAGE,
  selectFeaturedStates,
} from './content'
import { DEMO_PATH, isDemoAccessEnabled } from './demo-access'
import { getPasswordChecks, isStrongPassword } from './password'
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

const demoSections = [
  'Início',
  'Publicações',
  'Busca',
  'Monitoramento',
  'Empresas',
  'Estabelecimentos',
  'Perfil Tributário',
  'Configurações',
] as const

type DemoSection = (typeof demoSections)[number]

const demoDashboardCards = [
  'Fontes previstas',
  'Fontes consultadas',
  'Fontes com erro',
  'Publicações capturadas',
  'Publicações potencialmente relevantes',
  'Pendentes de análise',
] as const

function App() {
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

  return (
    <div className="app-shell">
      <SiteHeader onAuth={openAuth} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/cobertura" element={<CoveragePage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/como-funciona" element={<HowItWorksPage />} />
        <Route path="/reforma-tributaria" element={<TaxReformPage />} />
      </Routes>
      <SiteFooter />
      <AuthModal
        view={authView}
        onView={setAuthView}
        onClose={closeAuth}
        getReturnFocus={() => authReturnFocus.current}
      />
    </div>
  )
}


function DemoPage() {
  const [activeSection, setActiveSection] = useState<DemoSection>('Início')
  const navigate = useNavigate()

  return (
    <div className="demo-app">
      <header className="demo-topbar">
        <div className="demo-branding">
          <img
            src="/brand/tribusca-logo-horizontal-light.png"
            alt="TriBusca"
            className="demo-logo"
          />
          <div>
            <span className="demo-mode-badge">Modo demonstração</span>
            <p>Dados exibidos nesta área são demonstrativos.</p>
          </div>
        </div>
        <button
          className="btn btn-secondary demo-exit"
          type="button"
          onClick={() => navigate('/')}
        >
          Sair da demonstração
        </button>
      </header>

      <div className="demo-workspace">
        <aside className="demo-sidebar" aria-label="Navegação do painel demonstrativo">
          <nav className="demo-nav">
            {demoSections.map((section) => (
              <button
                key={section}
                type="button"
                aria-current={activeSection === section ? 'page' : undefined}
                onClick={() => setActiveSection(section)}
              >
                {section}
              </button>
            ))}
          </nav>
        </aside>

        <main className="demo-main">
          {activeSection === 'Início' ? (
            <>
              <div className="demo-page-heading">
                <span className="micro-label">Painel demonstrativo</span>
                <h1>Visão geral</h1>
                <p>
                  Estrutura inicial do produto autenticado, sem sessão real e sem acesso a dados
                  privados.
                </p>
              </div>

              <div className="demo-metric-grid" aria-label="Indicadores demonstrativos">
                {demoDashboardCards.map((card) => (
                  <article className="demo-metric-card" key={card}>
                    <span>{card}</span>
                    <strong>—</strong>
                    <small>Demonstração</small>
                  </article>
                ))}
              </div>

              <section className="demo-placeholder-panel">
                <span className="demo-mode-badge">Modo demonstração</span>
                <h2>Ambiente visual isolado</h2>
                <p>
                  Esta experiência usa somente conteúdo mock local. Nenhum endpoint autenticado,
                  tenant, empresa, usuário, CNPJ privado ou configuração real é consultado.
                </p>
              </section>
            </>
          ) : (
            <section className="demo-placeholder-panel demo-section-placeholder">
              <span className="demo-mode-badge">Modo demonstração</span>
              <h1>{activeSection}</h1>
              <p>
                Área preparada para evolução futura. Nesta atividade, a navegação é apenas visual e
                permanece isolada de dados e sessões reais.
              </p>
              <div className="demo-placeholder-value">
                <strong>—</strong>
                <span>Demonstração</span>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
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
          {view === 'login' && <LoginForm onClose={onClose} />}
          {view === 'signup' && <PasswordFlow mode="signup" onView={onView} />}
          {view === 'forgot' && <ForgotPassword onView={onView} />}
          {view === 'reset' && <PasswordFlow mode="reset" onView={onView} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function LoginForm({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()
  const demoAccessEnabled = isDemoAccessEnabled()
  const apiBase = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

  const login = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'login_failed')
      return data
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
      <p className="dialog-intro">Acesse sua área autenticada com o contrato oficial do backend.</p>
      <form className="auth-form" onSubmit={submit}>
        <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <p className="auth-unavailable-note">Recuperação de senha em breve.</p>
        {login.isError && <p className="auth-error" role="alert">Não foi possível entrar. Verifique suas credenciais e a conexão com a API.</p>}
        {login.isSuccess && <p className="auth-success" role="status">Credenciais validadas. Integração da área autenticada é o próximo passo.</p>}
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
      <p className="auth-switch">Cadastro em breve.</p>
    </>
  )
}

function ForgotPassword({ onView }: { onView: (view: AuthView) => void }) {
  return (
    <>
      <Dialog.Title>Recuperar senha</Dialog.Title>
      <p className="dialog-intro">O fluxo visual está definido; o endpoint de recuperação ainda não será inventado.</p>
      <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
        <label>E-mail<input type="email" required /></label>
        <button className="btn full" type="submit" disabled>Enviar instruções</button>
      </form>
      <button className="text-button standalone" type="button" onClick={() => onView('reset')}>Visualizar etapa “Nova senha”</button>
      <p className="auth-switch"><button type="button" onClick={() => onView('login')}>Voltar para Entrar</button></p>
    </>
  )
}

function PasswordFlow({
  mode,
  onView,
}: {
  mode: 'signup' | 'reset'
  onView: (view: AuthView) => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const checks = getPasswordChecks(password)
  const match = password.length > 0 && password === confirm
  const valid = isStrongPassword(password) && match

  return (
    <>
      <Dialog.Title>{mode === 'signup' ? 'Criar conta' : 'Nova senha'}</Dialog.Title>
      <p className="dialog-intro">
        {mode === 'signup'
          ? 'Prepare seu acesso. O cadastro só será ativado quando houver contrato backend.'
          : 'Defina a nova senha. O envio só será ativado quando houver contrato backend.'}
      </p>
      <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
        {mode === 'signup' && (
          <>
            <label>Nome<input type="text" required /></label>
            <label>E-mail<input type="email" required /></label>
          </>
        )}
        <label>Senha<input aria-label="Senha" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <label>Confirmar senha<input aria-label="Confirmar senha" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></label>
        <div className="password-rules" aria-label="Requisitos da senha">
          <PasswordRule ok={checks.minLength} text="Mínimo de 8 caracteres" />
          <PasswordRule ok={checks.uppercase} text="Uma letra maiúscula" />
          <PasswordRule ok={checks.lowercase} text="Uma letra minúscula" />
          <PasswordRule ok={checks.number} text="Um número" />
          <PasswordRule ok={checks.special} text="Um caractere especial" />
          <PasswordRule ok={match} text="As senhas coincidem" />
        </div>
        <button className="btn full" type="submit" disabled={!valid || true}>
          {mode === 'signup' ? 'Criar conta' : 'Salvar nova senha'}
        </button>
        <p className="integration-note">Integração aguardando contrato de API. Nenhum endpoint fictício é chamado.</p>
      </form>
      <p className="auth-switch"><button type="button" onClick={() => onView('login')}>Voltar para Entrar</button></p>
    </>
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
