import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  BookOpen,
  Building2,
  Check,
  ChevronRight,
  FileSearch,
  Layers3,
  Menu,
  MonitorCheck,
  RadioTower,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'

import {
  DECODIFICA_EXAMPLES,
  FEDERAL_COVERAGE,
  STATE_COVERAGE,
  selectFeaturedStates,
} from './content'
import {
  fetchPublicSources,
  findFederalSource,
  findStateSource,
  toCoveragePresentation,
} from './public-api'
import './public-experience.css'

type AuthView = 'login' | 'signup' | 'forgot' | 'reset'
type OpenAuth = (view: AuthView, returnFocus: HTMLElement) => void

export const STATE_CAROUSEL_AUTOPLAY_MS = 15_000
const STATE_CAROUSEL_SWIPE_THRESHOLD_PX = 48

const products = [
  { name: 'Acervo', descriptor: 'Base oficial organizada', icon: BookOpen, description: 'Publicações, versões, fontes, marcadores e busca em uma experiência única.' },
  { name: 'Central de Monitoramento', descriptor: 'Saúde das fontes', icon: MonitorCheck, description: 'Consultas, indisponibilidades, falhas e cobertura visíveis em um só lugar.' },
  { name: 'Sonar', descriptor: 'Afinidade tributária', icon: RadioTower, description: 'Cruza cada publicação com o Perfil Tributário da empresa e de seus estabelecimentos.' },
  { name: 'Revela', descriptor: 'Boletim inteligente', icon: BellRing, description: 'Reúne diariamente o que merece atenção e explica por que cada item entrou.' },
  { name: 'Decodifica', descriptor: 'Leitura auxiliar', icon: Sparkles, description: 'Explica o texto oficial em linguagem mais clara, sempre identificado como IA.' },
  { name: 'Perfil Tributário', descriptor: 'Contexto da empresa', icon: Building2, description: 'Organiza empresa, estabelecimentos, atividades, UFs e demais atributos relevantes.' },
] as const

const federalDescriptions: Record<string, string> = {
  'DOU / INLABS': 'Atos federais publicados no Diário Oficial da União.',
  CONFAZ: 'Convênios, ajustes e protocolos relacionados ao ICMS.',
  'NF-e / ENCAT': 'Notas técnicas e documentação dos documentos fiscais eletrônicos.',
  SPED: 'Publicações e documentação dos projetos do SPED.',
  CGIBS: 'Resoluções, regulamentos e documentos do Comitê Gestor do IBS.',
  'Receita Federal': 'Normas e atos tributários federais da Receita Federal.',
}

const howSteps = [
  ['1', 'Captura oficial', 'Fontes oficiais consultadas automaticamente; texto, arquivos e hash preservados.'],
  ['2', 'Normalização', 'Cada publicação é organizada em um formato comum, com órgão, tipo, número e datas oficiais.'],
  ['3', 'Deduplicação e versões', 'A mesma norma não é duplicada. Mudanças de conteúdo geram nova versão, com histórico.'],
  ['4', 'Marcadores Tributários', 'Vocabulário controlado da TriBusca — nunca tags livres criadas pela IA.'],
  ['5', 'Perfil Tributário', 'Contexto da empresa e de seus estabelecimentos.'],
  ['6', 'Relevância explicável', 'Cruzamento com o Perfil Tributário, dizendo por que cada norma foi priorizada.'],
] as const

const reformTimeline = [
  { date: '2023', kind: 'Publicação', title: 'Emenda Constitucional nº 132/2023', text: 'Institui a Reforma Tributária do consumo: IBS, CBS e Imposto Seletivo.' },
  { date: '2025', kind: 'Publicação', title: 'Lei Complementar nº 214/2025', text: 'Regulamenta o IBS, a CBS e o Imposto Seletivo.' },
  { date: '2026', kind: 'Vigência', title: 'Início da fase de teste', text: 'Cobrança de teste da CBS e do IBS, prevista na LC 214/2025.' },
  { date: '30/04/2026', kind: 'Publicação', title: 'Resolução CGIBS nº 6/2026', text: 'Regulamento do IBS.' },
  { date: '15/09/2026', kind: 'Publicação', title: 'Resolução CGIBS nº 18/2026', text: 'Publicação do Comitê Gestor do IBS.' },
  { date: '2027', kind: 'Marco previsto em lei', title: 'CBS em vigor', text: 'Previsão de extinção de PIS e Cofins.' },
  { date: '2029–2032', kind: 'Marco previsto em lei', title: 'Transição do ICMS e do ISS', text: 'Redução gradual, com aumento correspondente do IBS.' },
  { date: '2033', kind: 'Marco previsto em lei', title: 'Novo modelo integral', text: 'Extinção de ICMS e ISS prevista.' },
] as const

export function PublicExperience({ onAuth }: { onAuth: OpenAuth }) {
  return <div className="public-reference-shell">
    <PublicHeader onAuth={onAuth} />
    <Routes>
      <Route path="/" element={<HomePage onAuth={onAuth} />} />
      <Route path="/cobertura" element={<CoveragePage onAuth={onAuth} />} />
      <Route path="/portfolio" element={<PortfolioPage onAuth={onAuth} />} />
      <Route path="/como-funciona" element={<HowItWorksPage onAuth={onAuth} />} />
      <Route path="/reforma-tributaria" element={<TaxReformPage onAuth={onAuth} />} />
      <Route path="/termos" element={<TermsPage />} />
      <Route path="/privacidade" element={<PrivacyPage />} />
    </Routes>
    <PublicFooter />
  </div>
}

function PublicHeader({ onAuth }: { onAuth: OpenAuth }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const close = () => setMobileOpen(false)
  return <header className="site-header ref-header">
    <nav className="ref-container ref-nav-wrap">
      <Link to="/" className="brand-link" aria-label="TriBusca — página inicial" onClick={close}>
        <img src="/brand/tribusca-logo-horizontal-light.png" alt="TriBusca" className="brand-horizontal" />
      </Link>
      <nav aria-label="Navegação principal" className="nav-links ref-nav-links">
        <NavLink to="/cobertura">Cobertura</NavLink>
        <NavLink to="/portfolio">Portfólio</NavLink>
        <NavLink to="/como-funciona">Como funciona</NavLink>
        <NavLink to="/reforma-tributaria">Reforma Tributária</NavLink>
      </nav>
      <div className="nav-actions ref-nav-actions">
        <button className="ref-button ref-button-ghost" type="button" onClick={(event) => onAuth('login', event.currentTarget)}>Entrar</button>
        <button className="ref-button ref-button-primary" type="button" onClick={(event) => onAuth('signup', event.currentTarget)}>Criar conta</button>
        <button ref={mobileMenuButtonRef} className="mobile-menu-button" type="button" aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={mobileOpen} onClick={() => setMobileOpen((value) => !value)}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
    </nav>
    {mobileOpen && <nav className="mobile-nav" aria-label="Navegação móvel">
      <div className="ref-container mobile-nav-inner">
        <NavLink to="/cobertura" onClick={close}>Cobertura</NavLink>
        <NavLink to="/portfolio" onClick={close}>Portfólio</NavLink>
        <NavLink to="/como-funciona" onClick={close}>Como funciona</NavLink>
        <NavLink to="/reforma-tributaria" onClick={close}>Reforma Tributária</NavLink>
        <button type="button" onClick={(event) => { const returnFocus = mobileMenuButtonRef.current ?? event.currentTarget; close(); onAuth('login', returnFocus) }}>Entrar</button>
        <button className="mobile-signup" type="button" onClick={(event) => { const returnFocus = mobileMenuButtonRef.current ?? event.currentTarget; close(); onAuth('signup', returnFocus) }}>Criar conta</button>
      </div>
    </nav>}
  </header>
}

function HomePage({ onAuth }: { onAuth: OpenAuth }) {
  return <main>
    <section className="ref-hero ref-hero-home">
      <div className="ref-container ref-hero-grid">
        <div className="ref-hero-copy">
          <span className="ref-kicker">Monitoramento e Inteligência Tributária</span>
          <h1>Saiba o que mudou.<br />Entenda o que importa.<br />Chegue à fonte oficial.</h1>
          <p>A TriBusca acompanha fontes oficiais e organiza mudanças tributárias para sua empresa chegar mais rápido ao que merece atenção.</p>
          <div className="ref-hero-actions">
            <button className="ref-button ref-button-cyan" type="button" onClick={(event) => onAuth('signup', event.currentTarget)}>Experimentar grátis <ArrowRight size={17} /></button>
            <Link className="ref-button ref-button-light" to="/portfolio">Conhecer soluções</Link>
          </div>
          <small>7 dias para conhecer a TriBusca.</small>
        </div>
        <HomeRadar />
      </div>
    </section>

    <RadarNow />
    <StateCarousel />
    <FederalHome />
    <PortfolioHome />
    <NormaClara />
    <HowHome />
    <Traceability />
    <PublicCta onAuth={onAuth} captionBelowActions />
  </main>
}

function HomeRadar() {
  return <div className="ref-radar-card" aria-label="Exemplo visual do Sonar">
    <div className="ref-radar-orbit orbit-1" />
    <div className="ref-radar-orbit orbit-2" />
    <div className="ref-radar-orbit orbit-3" />
    <div className="ref-radar-sweep" />
    <span className="ref-radar-dot dot-a" /><span className="ref-radar-dot dot-b" /><span className="ref-radar-dot dot-c" />
    <div className="ref-radar-caption"><strong>Sonar</strong><span>Afinidade Tributária</span></div>
  </div>
}

function RadarNow() {
  return <section className="ref-section ref-radar-now-section">
    <div className="ref-container">
      <SectionTitle eyebrow="Agora no radar" title="Últimas capturas reais" />
      <div className="ref-capture-grid">
        {[0,1,2].map((item) => <article className="ref-capture-card" key={item}><span>— · —</span><strong>—</strong></article>)}
      </div>
    </div>
  </section>
}

function StateCarousel() {
  const states = useMemo(() => selectFeaturedStates(), [])
  const [index, setIndex] = useState(0)
  const [hoverPaused, setHoverPaused] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const [motionOptIn, setMotionOptIn] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const current = states[index]
  const previous = () => setIndex((value) => (value - 1 + states.length) % states.length)
  const next = () => setIndex((value) => (value + 1) % states.length)

  const query = useQuery({
    queryKey: ['public-sources-home'],
    queryFn: ({ signal }) => fetchPublicSources(undefined, signal),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
  const dataAvailable = query.isSuccess && !query.isFetching
  const sourceItems = dataAvailable ? query.data.items : []
  const stateStatus = toCoveragePresentation(
    findStateSource(sourceItems, current.uf),
    dataAvailable,
  ).status

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [])

  const manuallyPaused = userPaused || (reducedMotion && !motionOptIn)

  useEffect(() => {
    if (manuallyPaused || hoverPaused || states.length < 2) return
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % states.length)
    }, STATE_CAROUSEL_AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [hoverPaused, manuallyPaused, states.length])

  const togglePlayback = () => {
    if (manuallyPaused) {
      setMotionOptIn(true)
      setUserPaused(false)
      return
    }
    setUserPaused(true)
  }

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    if (!touch) return
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current
    const touch = event.changedTouches[0]
    touchStartRef.current = null
    if (!start || !touch) return

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (
      Math.abs(deltaX) < STATE_CAROUSEL_SWIPE_THRESHOLD_PX ||
      Math.abs(deltaX) <= Math.abs(deltaY)
    ) return

    if (deltaX < 0) next()
    else previous()
  }

  return <section className="ref-section ref-state-section">
    <div className="ref-container">
      <SectionTitle eyebrow="Cobertura estadual" title="Monitoramento tributário nos estados" />
      <div
        className="state-carousel ref-state-carousel"
        data-testid="state-carousel"
        onMouseEnter={() => setHoverPaused(true)}
        onMouseLeave={() => setHoverPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => { touchStartRef.current = null }}
      >
        <img src={current.img} alt={current.place} className="state-photo" />
        <div className="state-overlay" />
        <span className="ref-state-photo-label">Fotografia de {current.capital} · Wikimedia Commons</span>
        <div className="state-copy ref-state-copy">
          <span className="ref-state-uf">{current.uf}</span>
          <span
            className={`collection-status ref-status ref-state-status ${statusClass(stateStatus)}`}
            data-testid="state-carousel-status"
            aria-live="polite"
          >
            {stateStatus}
          </span>
          <h3>{current.name} · {current.capital}</h3>
          <p>{current.place}</p>
          <div className="state-publications ref-state-publications">
            <div className="ref-state-publications-head"><strong>Últimas publicações · {current.uf}</strong><Link to="/cobertura">Ver todas <ArrowRight size={14} /></Link></div>
            {[0,1,2].map((item) => <div className="ref-state-publication-placeholder" key={item}><span>— · —</span><b>—</b></div>)}
          </div>
          <a href={current.page} target="_blank" rel="noreferrer" className="photo-credit">Foto: {current.author} · {current.license} · Wikimedia Commons</a>
        </div>
        <div className="carousel-controls ref-carousel-controls">
          <button type="button" onClick={previous} aria-label="Estado anterior"><ArrowLeft /></button>
          <button className="ref-carousel-playback" type="button" onClick={togglePlayback}>{manuallyPaused ? 'Reproduzir' : 'Pausar'}</button>
          <button type="button" onClick={next} aria-label="Próximo estado"><ArrowRight /></button>
        </div>
      </div>
      <div className="ref-state-tabs" role="tablist" aria-label="Estados em destaque">{states.map((state, stateIndex) => <button key={state.uf} role="tab" type="button" aria-label={`Exibir ${state.name}`} aria-selected={stateIndex === index} className={stateIndex === index ? 'active' : ''} onClick={() => setIndex(stateIndex)}>{state.uf}</button>)}</div>
      <p className="ref-state-carousel-footer" data-testid="state-carousel-position">{index + 1} / {states.length} · Fotografias reais do Wikimedia Commons, com autoria e licença na legenda.</p>
    </div>
  </section>
}

function FederalHome() {
  const query = useQuery({ queryKey:['public-sources-home'], queryFn:({signal})=>fetchPublicSources(undefined, signal), retry:false, staleTime:0, gcTime:0, refetchOnWindowFocus:false })
  const available = query.isSuccess && !query.isFetching
  const items = available ? query.data.items : []
  return <section className="ref-section ref-soft-section">
    <div className="ref-container">
      <SectionTitle eyebrow="Cobertura Federal" title="O que está ativo fica claro." copy="A TriBusca diferencia uma fonte em produção de outra ainda em implantação. Nada é apresentado como cobertura produtiva antes de estar operacional." />
      <div className="ref-federal-grid">{FEDERAL_COVERAGE.map((source) => {
        const data = toCoveragePresentation(findFederalSource(items, source.code), available)
        const status = query.isLoading || query.isFetching ? 'Verificando…' : data.status
        return <article key={source.code} className="ref-federal-card"><span className={`collection-status ref-status ${statusClass(status)}`}>{status}</span><strong>{source.name}</strong><p>{federalDescriptions[source.name] ?? 'Fonte oficial monitorada pela TriBusca.'}</p><small>Última atualização: {data.lastSuccessAt}</small></article>
      })}</div>
    </div>
  </section>
}

function PortfolioHome() {
  return <section className="ref-section"><div className="ref-container">
    <div className="ref-section-head-row"><SectionTitle eyebrow="Portfólio" title="Uma plataforma, seis recursos." copy="Os recursos são partes da TriBusca, não produtos separados. O status de cada um é mostrado como está hoje." /><Link className="ref-text-link" to="/portfolio">Ver portfólio completo <ArrowRight size={16} /></Link></div>
    <div className="ref-product-grid">{products.map((product) => <article className="ref-product-card" key={product.name}><span className="ref-icon-box"><product.icon size={22} /></span><div><strong>{product.name}</strong><small>{product.descriptor}</small></div><span className="ref-product-status">Em desenvolvimento</span><p>{product.description}</p></article>)}</div>
  </div></section>
}

function NormaClara() {
  const [index,setIndex] = useState(0)
  const ex=DECODIFICA_EXAMPLES[index]
  return <section className="ref-section ref-soft-section"><div className="ref-container">
    <div className="ref-example-heading"><SectionTitle eyebrow="Norma Clara" title={`${index+1}. ${ex.title}`} copy="Texto oficial e leitura auxiliar lado a lado, com identificação explícita da camada de IA." /><div className="ref-example-controls"><span>{index+1} / {DECODIFICA_EXAMPLES.length}</span><button type="button" aria-label="Exemplo anterior" onClick={()=>setIndex((index-1+DECODIFICA_EXAMPLES.length)%DECODIFICA_EXAMPLES.length)}><ArrowLeft /></button><button type="button" aria-label="Próximo exemplo" onClick={()=>setIndex((index+1)%DECODIFICA_EXAMPLES.length)}><ArrowRight /></button></div></div>
    <div className="ref-legal-pair"><article><span>Texto oficial</span><p>“{ex.official}”</p><strong>{ex.source}</strong></article><article className="ref-ai-reading"><span>Norma Clara · Leitura auxiliar</span><p>{ex.auxiliary}</p><small>Gerada por IA. Não substitui o texto oficial.</small></article></div>
    <div className="ref-example-progress" aria-label="Exemplos Norma Clara">{DECODIFICA_EXAMPLES.map((item,itemIndex)=><button key={item.title} type="button" aria-label={`Exibir exemplo ${itemIndex+1}`} aria-current={itemIndex===index} className={itemIndex===index?'active':''} onClick={()=>setIndex(itemIndex)}/>)}</div>
  </div></section>
}

function HowHome() {
  const steps=[['1','Captura oficial','A TriBusca consulta as fontes e preserva a origem.'],['2','Organização','A publicação é normalizada, deduplicada e versionada.'],['3','Contexto','Marcadores e Perfil Tributário ajudam a explicar relevância.']]
  return <section className="ref-section"><div className="ref-container">
    <SectionTitle eyebrow="Como funciona" title="A legislação encontra a empresa." copy="Da fonte oficial ao contexto tributário, cada etapa permanece explicável e rastreável." />
    <div className="ref-step-grid">{steps.map(([n,name,desc])=><article key={n}><span>{n}</span><strong>{name}</strong><p>{desc}</p></article>)}</div>
    <span className="ref-example-badge">Exemplo ilustrativo · classificação e relevância em desenvolvimento</span>
    <RelevanceExample />
  </div></section>
}

function RelevanceExample() {
  return <div className="ref-relevance-example"><div className="ref-example-column"><span>Publicação</span><strong>Convênio ICMS 100/97</strong><p>ICMS · Benefício Fiscal · Fertilizantes · Operações de saída</p></div><div className="ref-example-column"><span>Perfil</span><strong>Empresa exemplo</strong><p>Agronegócio · GO · Fertilizantes · Venda</p></div><div className="ref-example-column ref-example-priority"><span>Por que priorizar</span><strong>Possivelmente relevante</strong>{['Trata de fertilizantes','Envolve operação de venda','Trata de ICMS','A empresa possui estabelecimento em GO'].map(item=><p key={item}><Check size={14} /> {item}</p>)}</div></div>
}

function Traceability() {
  return <section className="ref-section ref-trace-section"><div className="ref-container"><SectionTitle eyebrow="Rastreabilidade" title="Informação rastreável até a origem." copy="Fato oficial, inteligência TriBusca e conteúdo gerado por IA permanecem separados." /><div className="ref-trace-grid"><Trace icon={FileSearch} title="Fonte oficial" text="Órgão e URL preservados"/><Trace icon={Layers3} title="Histórico" text="Coletas e alterações"/><Trace icon={BookOpen} title="Versões" text="Conteúdo versionado"/><Trace icon={ShieldCheck} title="Integridade" text="Arquivo e hash"/></div></div></section>
}

function Trace({icon:Icon,title,text}:{icon:typeof FileSearch;title:string;text:string}) { return <article><span><Icon size={20}/></span><strong>{title}</strong><p>{text}</p></article> }

function CoveragePage({ onAuth }: { onAuth: OpenAuth }) {
  const states=[...STATE_COVERAGE].sort((a,b)=>a.uf==='SP'?-1:b.uf==='SP'?1:a.name.localeCompare(b.name,'pt-BR'))
  const query=useQuery({queryKey:['public-sources'],queryFn:({signal})=>fetchPublicSources(undefined,signal),retry:false,staleTime:0,gcTime:0,refetchOnWindowFocus:false})
  const available=query.isSuccess&&!query.isFetching
  const items=available?query.data.items:[]
  return <main><PageHero eyebrow="Cobertura" title="Fontes oficiais acompanhadas, com saúde operacional visível." copy="A TriBusca diferencia uma fonte em produção de outra ainda em implantação. Nada é apresentado como cobertura produtiva antes de estar operacional." />
    <section className="ref-section"><div className="ref-container">
      {!available && !query.isLoading && <div className="ref-live-warning">Dados ao vivo indisponíveis no momento. Os campos sem informação aparecem como “—”.</div>}
      <SectionTitle eyebrow="Cobertura Federal" title="O que está ativo fica claro." />
      <div className="ref-coverage-grid">{FEDERAL_COVERAGE.map(source=>{const data=toCoveragePresentation(findFederalSource(items,source.code),available);return <CoverageCard key={source.code} code={source.code.toUpperCase()} name={source.name} description={federalDescriptions[source.name]??'Fonte oficial monitorada.'} {...data} testId="federal-coverage-card"/>})}</div>
    </div></section>
    <section className="ref-section ref-soft-section"><div className="ref-container"><SectionTitle eyebrow="Cobertura estadual" title="Monitoramento tributário nos estados" copy="Diários oficiais estaduais entram um a um. São Paulo é o primeiro; os demais estados seguem em implantação."/><div className="ref-coverage-grid">{states.map(state=>{const data=toCoveragePresentation(findStateSource(items,state.uf),available);return <CoverageCard key={state.uf} code={state.uf} name={`${state.name} / ${state.uf}`} description={`Diário Oficial e atos estaduais de ${state.name}.`} {...data} testId="state-coverage-card"/>})}</div></div></section>
    <section className="ref-section"><div className="ref-container"><SectionTitle eyebrow="Saúde operacional" title="Cada fonte mostra como está hoje." copy="Falha de fonte não significa ausência de publicações."/><div className="ref-health-grid"><Health name="Operacional" text="Consultada com sucesso no ciclo mais recente."/><Health name="Instável" text="Respostas intermitentes ou parciais."/><Health name="Indisponível" text="A fonte oficial não respondeu. Isso não significa ausência de publicações."/><Health name="Ainda não consultada" text="Fonte em implantação, sem coleta produtiva."/></div></div></section>
    <PublicCta onAuth={onAuth}/>
  </main>
}

function CoverageCard({code,name,description,status,lastSuccessAt,importedToday,totalPublications,testId}:{code:string;name:string;description:string;status:string;lastSuccessAt:string;importedToday:string;totalPublications:string;testId?:string}) {
  return <article className="coverage-card ref-coverage-card" data-testid={testId}><div className="ref-source-code">{code}</div><div className="ref-coverage-copy"><strong>{name}</strong><p>{description}</p><span className={`collection-status ref-status ${statusClass(status)}`}>Coleta {status}</span></div><dl className="coverage-metrics"><div><dt>Última atualização</dt><dd>{lastSuccessAt}</dd></div><div><dt>Importadas hoje</dt><dd>{importedToday}</dd></div><div><dt>Total no acervo</dt><dd>{totalPublications}</dd></div></dl></article>
}

function Health({name,text}:{name:string;text:string}) { return <article><span className="ref-health-dot"/><strong>{name}</strong><p>{text}</p></article> }

function PortfolioPage({onAuth}:{onAuth:OpenAuth}) {
  const portfolioAnchors=[['acervo','Acervo'],['central','Central de Monitoramento'],['sonar','Sonar'],['revela','Revela'],['decodifica','Decodifica'],['perfil','Perfil Tributário']] as const
  return <main><PageHero eyebrow="Portfólio" title="Recursos da TriBusca para encontrar o que importa no meio do ruído." copy="Os recursos são partes da mesma plataforma, não produtos separados. Cada um mostra seu estado atual: nada é apresentado como disponível antes de estar operacional." />
    <nav className="ref-portfolio-anchors" aria-label="Recursos do portfólio"><div className="ref-container">{portfolioAnchors.map(([id,label])=><a key={id} href={`#${id}`}>{label}</a>)}</div></nav>
    <section className="ref-section"><div className="ref-container ref-product-detail-stack">
      <ProductSection id="acervo" icon={BookOpen} name="Acervo" descriptor="Base de consulta" description="Consulta organizada ao conteúdo oficial coletado e preservado pela TriBusca: publicações, versões, origem oficial e metadados. A Busca é uma função do Acervo, com pesquisa por título, número, órgão, conteúdo, fonte, UF e período."><AcervoMock/></ProductSection>
      <ProductSection id="central" icon={MonitorCheck} name="Central de Monitoramento" descriptor="Saúde das fontes" description="Mostra a situação operacional de cada fonte oficial: última consulta, tentativas, indisponibilidade e tempo de resposta. Falha de uma fonte não é tratada como ausência de publicações."><div className="ref-monitor-demo"><Health name="Operacional" text="Coleta concluída"/><Health name="Instável" text="Resposta parcial"/><Health name="Indisponível" text="Fonte não respondeu"/><Health name="Ainda não consultada" text="Implantação"/></div><small className="ref-detail-note">Estados de saúde exibidos para cada fonte.</small></ProductSection>
      <ProductSection id="sonar" icon={RadioTower} name="Sonar" descriptor="Afinidade tributária" description="Cruza os Marcadores Tributários de cada publicação com o Perfil Tributário da empresa e de seus estabelecimentos. O resultado é classificado em Alta, Média ou Baixa afinidade, sempre com os sinais encontrados."><SonarDemo/><p className="ref-detail-note">Uma publicação pode ter afinidade com uma filial e não com outra. Uma nova versão da publicação gera novo cálculo.</p><span className="ref-example-badge">Exemplo ilustrativo.</span></ProductSection>
      <ProductSection id="revela" icon={BellRing} name="Revela" descriptor="Boletim diário" description="Atualização tributária diária personalizada. Reúne as publicações de Alta afinidade no Sonar e as que têm menção direta à empresa ou a seus estabelecimentos, como a citação do CNPJ."><div className="ref-bulletin-demo"><span>Revela · boletim de hoje</span><strong>Empresa exemplo</strong><article><b>Alta afinidade</b><p>Convênio ICMS · benefício fiscal para fertilizantes</p><small>Sinais: ICMS · fertilizantes · estabelecimento em GO</small></article><article><b>Menção direta</b><p>Publicação cita o CNPJ da filial GO-02</p><small>Estabelecimento relacionado: GO-02</small></article></div><p className="ref-detail-note">Cada item informa por que entrou no boletim e leva à publicação na TriBusca.</p><span className="ref-example-badge">Exemplo ilustrativo.</span></ProductSection>
      <ProductSection id="decodifica" icon={Sparkles} name="Decodifica" descriptor="Linguagem clara" description="Explica o texto oficial em linguagem clara, artigo por artigo, sob demanda dentro da publicação. O custo aparece no próprio botão antes de acionar: 1 crédito para cada até 25.000 caracteres. Se a norma for alterada, a explicação anterior continua disponível, marcada como desatualizada."><div className="ref-decodifica-states"><span>Decodificar (4 créditos)</span><span>Traduzido</span><span>Desatualizado</span></div><DecodificaDetail/></ProductSection>
      <ProductSection id="perfil" icon={Building2} name="Perfil Tributário" descriptor="Contexto da empresa" description="Organiza o contexto da empresa: CNPJ, regime, CNAEs, atividades, segmentos, estabelecimentos e UFs. Progressivamente, produtos, NCMs, operações, CFOPs, tributos e obrigações. Nada disso é exigido de uma vez no cadastro."><div className="ref-profile-tags">{['CNPJ','Regime','CNAEs','Estabelecimentos','UFs','Produtos','NCMs','Operações','CFOPs','Tributos'].map(x=><span key={x}>{x}</span>)}</div></ProductSection>
    </div></section><PublicCta onAuth={onAuth} showLogin={false} captionBelowActions/></main>
}

function ProductSection({id,icon:Icon,name,descriptor,description,children}:{id:string;icon:typeof BookOpen;name:string;descriptor:string;description:string;children:ReactNode}) { return <section id={id} className="ref-product-detail"><div className="ref-product-detail-head"><span className="ref-icon-box"><Icon size={24}/></span><div><span className="ref-product-status">Em desenvolvimento</span><small>{descriptor}</small><h2>{name}</h2></div></div><p>{description}</p>{children}</section> }

function AcervoMock(){return <div className="ref-acervo-mock"><div><Search size={17}/><span>Buscar no Acervo…</span><button type="button">Buscar</button></div><div>{['Título ▾','Número ▾','Órgão ▾','Conteúdo ▾','Fonte ▾','UF ▾','Período ▾'].map(x=><span key={x}>{x}</span>)}</div><small>Exemplo ilustrativo da interface.</small></div>}

function SonarDemo(){return <div className="ref-sonar-demo"><div className="sonar-scale"><SonarState level="high" label="Alta" description="sinal próximo ao centro"/><SonarState level="medium" label="Média" description="distância intermediária"/><SonarState level="low" label="Baixa" description="sinal distante"/></div><div className="ref-signal-demo"><strong>Sinais encontrados</strong>{['Trata de ICMS','Envolve operação de venda','Estabelecimento em GO'].map(x=><p key={x}><Check size={14}/> {x}</p>)}</div></div>}

function SonarState({level,label,description}:{level:'high'|'medium'|'low';label:string;description:string}) { return <div className={`sonar-state sonar-state-${level}`}><div className={`sonar sonar-${level}`}><span className="sonar-ring ring-1"/><span className="sonar-ring ring-2"/><span className="sonar-ring ring-3"/><span className="sonar-sweep"/><span className="sonar-ping"/></div><div><strong>{label} afinidade</strong><p>{description}</p></div></div> }

function DecodificaDetail(){const[index,setIndex]=useState(0);const ex=DECODIFICA_EXAMPLES[index];return <div className="ref-decodifica-detail"><div className="ref-example-heading"><div><span className="micro-label">Exemplo {index+1} de {DECODIFICA_EXAMPLES.length}</span><h3>{index+1}. {ex.title}</h3></div><div className="ref-example-controls"><span>{index+1} / {DECODIFICA_EXAMPLES.length}</span><button type="button" aria-label="Exemplo anterior" onClick={()=>setIndex((index-1+DECODIFICA_EXAMPLES.length)%DECODIFICA_EXAMPLES.length)}><ArrowLeft/></button><button type="button" aria-label="Próximo exemplo" onClick={()=>setIndex((index+1)%DECODIFICA_EXAMPLES.length)}><ArrowRight/></button></div></div><div className="ref-legal-pair"><article><span>Texto oficial</span><p>“{ex.official}”</p><strong>{ex.source}</strong></article><article className="ref-ai-reading"><span>Decodifica · Leitura auxiliar</span><p>{ex.auxiliary}</p><small>Gerada por IA. Não substitui o texto oficial.</small></article></div><div className="ref-example-progress" aria-label="Exemplos Decodifica">{DECODIFICA_EXAMPLES.map((item,itemIndex)=><button key={item.title} type="button" aria-label={`Exibir exemplo ${itemIndex+1}`} aria-current={itemIndex===index} className={itemIndex===index?'active':''} onClick={()=>setIndex(itemIndex)}/>)}</div></div>}

function HowItWorksPage({onAuth}:{onAuth:OpenAuth}) { return <main><PageHero eyebrow="Como funciona" title="A legislação encontra a empresa." copy="Da fonte oficial à relevância para a sua empresa, cada etapa preserva a origem e explica o porquê."/><section className="ref-section"><div className="ref-container"><div className="ref-process-list">{howSteps.map(([n,name,desc])=><article key={n}><span>{n}</span><div><strong>{name}</strong><p>{desc}</p></div></article>)}</div></div></section><section className="ref-section ref-soft-section"><div className="ref-container"><SectionTitle eyebrow="Relevância" title="Por que priorizar" copy="Cada prioridade vem com os motivos verificáveis. A TriBusca prefere linguagem baseada em evidência e grau de certeza, como “Possível impacto identificado”."/><span className="ref-example-badge">Exemplo ilustrativo · classificação e relevância em desenvolvimento</span><RelevanceExample/></div></section><section className="ref-section"><div className="ref-container"><SectionTitle eyebrow="Transparência" title="Fato oficial, inteligência e IA, sempre separados." copy="Cada camada da experiência deixa claro de onde veio a informação."/><div className="ref-transparency-grid"><Trace icon={FileSearch} title="Fato oficial" text="Texto e arquivos como publicados pela fonte, com órgão, URL e data."/><Trace icon={RadioTower} title="Inteligência TriBusca" text="Marcadores, versões e relevância calculados pela plataforma, com motivos."/><Trace icon={Sparkles} title="Conteúdo gerado por IA" text="Leituras auxiliares sempre identificadas. Não substituem o texto oficial."/></div></div></section><Traceability/><PublicCta onAuth={onAuth}/></main> }

function TaxReformPage({onAuth}:{onAuth:OpenAuth}) { const [filter,setFilter]=useState('Todos');return <main><PageHero eyebrow="Reforma Tributária" title="A Reforma Tributária, organizada a partir da fonte oficial." copy="Legislação, regulamentação, notas técnicas e demais publicações oficiais da reforma reunidas a partir do Acervo da TriBusca, com uma linha do tempo que separa publicação, vigência e marcos."/><section className="ref-section"><div className="ref-container"><SectionTitle eyebrow="Linha do tempo" title="Publicação e vigência são datas diferentes."/><div className="ref-reform-legend"><span>Publicação</span><span>Vigência</span><span>Marco previsto em lei</span></div><div className="ref-reform-timeline">{reformTimeline.map((item,index)=><article key={`${item.date}-${item.title}`}><div className="ref-timeline-axis"><span/><i/></div><div className="ref-timeline-content"><small>{item.date}</small><em>{item.kind}</em><strong>{item.title}</strong><p>{item.text}</p></div>{index===reformTimeline.length-1?null:null}</article>)}</div><p className="ref-legal-note">Datas futuras aparecem apenas quando previstas em norma oficial. Conferir cada item com a fonte antes de publicar.</p></div></section><section className="ref-section ref-soft-section"><div className="ref-container"><SectionTitle eyebrow="No Acervo" title="Publicações relacionadas" copy="Lista ilustrativa com publicações já coletadas pelo conector CGIBS; ligar ao Acervo real."/><div className="ref-filter-row">{['Todos','Legislação','Regulamentação','Notas técnicas','IBS','CBS','Imposto Seletivo'].map(x=><button key={x} className={filter===x?'active':''} onClick={()=>setFilter(x)} type="button">{x}</button>)}</div><div className="ref-related-list">{[['CGIBS','Resolução CGIBS nº 18/2026','15/09/2026'],['CGIBS','Resolução CGIBS nº 6/2026 — Regulamento do IBS','30/04/2026'],['Planalto','Lei Complementar nº 214/2025','2025'],['CGIBS','Split Payment — OpenAPI v1.1.0','Documento técnico'],['CGIBS','DeRE v1.2.0 — leiautes e XSD','Documento técnico']].map(([org,title,date])=><article key={title}><span>{org}</span><strong>{title}</strong><small>{date}</small></article>)}</div></div></section><PublicCta onAuth={onAuth}/></main> }

function TermsPage() {
  return <LegalDocumentPage
    eyebrow="Termos de uso"
    title="Termos de Uso do TriBusca"
    intro="Versão 2026-09-29-v1 · Vigente a partir de 29/09/2026."
    sections={[
      {
        title: '1. Objeto',
        paragraphs: [
          'O TriBusca é uma plataforma de monitoramento e inteligência tributária que organiza publicações oficiais e oferece recursos de pesquisa, priorização e leitura auxiliar.',
          'O serviço não substitui a consulta à fonte oficial, a análise profissional individualizada nem a decisão do usuário sobre obrigações tributárias, fiscais ou legais.',
        ],
      },
      {
        title: '2. Conta e responsabilidade do usuário',
        paragraphs: [
          'Você deve fornecer dados verdadeiros e manter suas credenciais sob controle. A senha é definida pelo próprio usuário e não deve ser compartilhada.',
          'O primeiro cadastro válido de uma organização cria um ambiente próprio no TriBusca e recebe perfil OWNER. Quando um CNPJ é informado, o autosserviço não cria um segundo ambiente para o mesmo CNPJ.',
        ],
      },
      {
        title: '3. Uso permitido',
        paragraphs: [
          'A plataforma deve ser usada para finalidades legítimas relacionadas ao acompanhamento, organização e análise de informações tributárias.',
          'Não é permitido tentar contornar controles de segurança, acessar dados de outros clientes, automatizar abuso do serviço ou utilizar a plataforma de forma ilícita.',
        ],
      },
      {
        title: '4. Fontes oficiais e conteúdo assistido',
        paragraphs: [
          'O TriBusca procura preservar a referência e a origem das publicações oficiais. Conteúdos de inteligência, classificação ou IA são apresentados como camadas auxiliares e podem exigir validação humana.',
          'Em caso de divergência, prevalece a publicação disponível na fonte oficial competente.',
        ],
      },
      {
        title: '5. Disponibilidade e evolução',
        paragraphs: [
          'O produto está em evolução e pode receber ajustes de funcionalidades, integrações, limites e condições de acesso. Interrupções de fontes externas ou manutenções podem afetar temporariamente a disponibilidade de dados.',
          'Condições comerciais, planos pagos ou cobranças futuras serão informados antes de produzirem efeitos para a conta.',
        ],
      },
      {
        title: '6. Encerramento e segurança',
        paragraphs: [
          'O acesso poderá ser restringido em caso de risco de segurança, uso abusivo, violação destes termos ou necessidade técnica justificada.',
          'Solicitações relacionadas à conta deverão ser tratadas pelos canais de atendimento disponibilizados pelo TriBusca no produto ou no site.',
        ],
      },
      {
        title: '7. Atualizações destes termos',
        paragraphs: [
          'Novas versões poderão ser publicadas quando houver mudanças relevantes no serviço. Quando necessário, um novo aceite poderá ser solicitado.',
          'Esta versão identifica o conjunto de termos aceito no cadastro e pode passar por revisão jurídica antes de expansão comercial ampla.',
        ],
      },
    ]}
  />
}

function PrivacyPage() {
  return <LegalDocumentPage
    eyebrow="Privacidade"
    title="Política de Privacidade do TriBusca"
    intro="Versão 2026-09-29-v1 · Vigente a partir de 29/09/2026."
    sections={[
      {
        title: '1. Dados tratados',
        paragraphs: [
          'No cadastro podemos tratar nome, e-mail, empresa, CNPJ opcional, aceite dos documentos e informações técnicas necessárias à segurança da conta.',
          'Durante autenticação e uso do serviço também podem ser tratados identificadores de sessão, endereço IP, navegador, horários de acesso e registros técnicos de segurança.',
        ],
      },
      {
        title: '2. Finalidades',
        paragraphs: [
          'Os dados são usados para criar e administrar a conta, autenticar usuários, proteger o ambiente, manter histórico operacional, prestar o serviço e prevenir fraude ou abuso.',
          'Dados empresariais e parâmetros tributários cadastrados posteriormente serão utilizados para personalizar monitoramento, filtros e funcionalidades contratadas.',
        ],
      },
      {
        title: '3. Senhas e segurança',
        paragraphs: [
          'O TriBusca não armazena a senha em texto puro. A credencial é armazenada por meio de hash Argon2id e as sessões utilizam controles próprios de autenticação.',
          'Nenhum mecanismo de segurança elimina todos os riscos; por isso mantemos controles de acesso, segregação por tenant, RLS e registros técnicos compatíveis com a arquitetura do produto.',
        ],
      },
      {
        title: '4. Compartilhamento',
        paragraphs: [
          'Os dados podem ser tratados por provedores de infraestrutura e serviços necessários à operação da plataforma, sempre de acordo com a finalidade do serviço.',
          'Não vendemos dados pessoais. Compartilhamentos adicionais somente ocorrerão quando necessários à prestação do serviço, ao cumprimento de obrigação aplicável ou mediante base legítima apropriada.',
        ],
      },
      {
        title: '5. Retenção',
        paragraphs: [
          'Os dados são mantidos pelo período necessário à operação da conta, segurança, auditoria e cumprimento de obrigações aplicáveis. Prazos específicos poderão variar conforme o tipo de registro.',
          'Quando a conta for encerrada, dados poderão ser eliminados, anonimizados ou mantidos pelo período necessário para finalidades legítimas e obrigações aplicáveis.',
        ],
      },
      {
        title: '6. Direitos e solicitações',
        paragraphs: [
          'O titular pode solicitar informações, correção e demais direitos previstos na legislação aplicável, observados os limites legais e técnicos de cada solicitação.',
          'As solicitações deverão ser encaminhadas pelos canais de atendimento disponibilizados pelo TriBusca no produto ou no site.',
        ],
      },
      {
        title: '7. Atualizações',
        paragraphs: [
          'Esta política poderá ser atualizada para refletir mudanças do produto, dos fornecedores ou das práticas de tratamento. A versão vigente permanecerá identificada nesta página.',
          'Esta versão inicial pode passar por revisão jurídica antes da expansão comercial ampla do serviço.',
        ],
      },
    ]}
  />
}

function LegalDocumentPage({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string
  title: string
  intro: string
  sections: Array<{ title: string; paragraphs: string[] }>
}) {
  return <main className="ref-legal-page">
    <PageHero eyebrow={eyebrow} title={title} copy={intro} />
    <section className="ref-section">
      <div className="ref-container ref-legal-document">
        {sections.map((section) => <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>)}
        <p className="ref-legal-disclaimer">
          Documento operacional inicial do TriBusca. Recomenda-se revisão jurídica antes de expansão comercial ampla.
        </p>
      </div>
    </section>
  </main>
}

function PageHero({eyebrow,title,copy}:{eyebrow:string;title:string;copy:string}) { return <section className="ref-page-hero"><div className="ref-container"><span className="ref-kicker">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div></section> }
function SectionTitle({eyebrow,title,copy}:{eyebrow:string;title:string;copy?:string}) { return <div className="ref-section-title"><span>{eyebrow}</span><h2>{title}</h2>{copy ? <p>{copy}</p> : null}</div> }
function statusClass(status:string){return status==='—'?'collection-pending-data':`collection-${status.toLowerCase().replaceAll(' ','-').replaceAll('…','')}`}

function PublicCta({onAuth,showLogin=true,captionBelowActions=false}:{onAuth:OpenAuth;showLogin?:boolean;captionBelowActions?:boolean}) { return <section className="ref-public-cta"><div className="ref-container"><div><h2>Pare de procurar mudanças tributárias manualmente.</h2>{captionBelowActions?null:<p>7 dias para conhecer a TriBusca.</p>}</div><div className="ref-cta-actions"><div><button className="ref-button ref-button-cyan" type="button" onClick={(event)=>onAuth('signup',event.currentTarget)}>Experimentar grátis</button>{showLogin?<button className="ref-button ref-button-light" type="button" onClick={(event)=>onAuth('login',event.currentTarget)}>Entrar</button>:null}</div>{captionBelowActions?<p>7 dias para conhecer a TriBusca.</p>:null}</div></div></section> }

function PublicFooter(){return <footer className="site-footer ref-footer"><div className="ref-container footer-wrap ref-footer-wrap"><img src="/brand/tribusca-logo-horizontal-dark.png" alt="TriBusca" className="footer-logo"/><p>Monitoramento e Inteligência Tributária</p><p className="footer-note"><Link to="/termos">Termos de uso</Link> · <Link to="/privacidade">Política de privacidade</Link> · © 2026 TriBusca</p></div></footer>}