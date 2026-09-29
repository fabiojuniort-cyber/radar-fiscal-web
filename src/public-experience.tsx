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
  ['1', 'Captura oficial', 'Fontes oficiais consultadas automaticamente; texto, arquivos e referência preservados.'],
  ['2', 'Normalização', 'Cada publicação é organizada em um formato comum, com órgão, tipo, número e datas oficiais.'],
  ['3', 'Deduplicação e versões', 'A mesma norma não é duplicada. Mudanças de conteúdo geram nova versão, com histórico.'],
  ['4', 'Marcadores Tributários', 'Vocabulário controlado da TriBusca — não tags livres inventadas pela IA.'],
  ['5', 'Perfil Tributário', 'Contexto da empresa e de seus estabelecimentos para a análise de afinidade.'],
  ['6', 'Relevância explicável', 'O cruzamento explica por que cada publicação foi priorizada.'],
] as const

const reformTimeline = [
  { date: '2023', kind: 'Publicação', title: 'Emenda Constitucional nº 132/2023', text: 'Institui a Reforma Tributária do consumo e cria a base constitucional para IBS, CBS e Imposto Seletivo.' },
  { date: '2025', kind: 'Publicação', title: 'Lei Complementar nº 214/2025', text: 'Institui e regulamenta o IBS, a CBS e o Imposto Seletivo.' },
  { date: '2026', kind: 'Vigência', title: 'Início da fase de teste', text: 'Ano de transição operacional dos novos tributos e dos documentos fiscais.' },
  { date: '30/04/2026', kind: 'Publicação', title: 'Resolução CGIBS nº 6/2026', text: 'Regulamenta o Imposto sobre Bens e Serviços (IBS).' },
  { date: '15/09/2026', kind: 'Publicação', title: 'Resolução CGIBS nº 18/2026', text: 'Publicação do Comitê Gestor do IBS.' },
  { date: '2027', kind: 'Marco previsto em lei', title: 'CBS em vigor', text: 'Avanço da transição com os marcos legais previstos para a CBS.' },
  { date: '2029–2032', kind: 'Marco previsto em lei', title: 'Transição do ICMS e do ISS', text: 'Redução gradual dos tributos atuais e crescimento correspondente do IBS.' },
  { date: '2033', kind: 'Marco previsto em lei', title: 'Novo modelo integral', text: 'Conclusão prevista da transição para o novo modelo de tributação do consumo.' },
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
    <PublicCta onAuth={onAuth} />
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
      <SectionTitle eyebrow="Agora no radar" title="Últimas capturas reais" copy="A área está pronta para receber publicações do Acervo público quando o gate de exposição estiver concluído." />
      <div className="ref-capture-grid">
        {[0,1,2].map((item) => <article className="ref-capture-card" key={item}><span>Fonte oficial</span><strong>—</strong><p>Publicação disponível após integração segura com o Acervo público.</p></article>)}
      </div>
    </div>
  </section>
}

function StateCarousel() {
  const states = useMemo(() => selectFeaturedStates(), [])
  const [index, setIndex] = useState(0)
  const [hoverPaused, setHoverPaused] = useState(false)
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

  useEffect(() => {
    if (reducedMotion || hoverPaused || states.length < 2) return
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % states.length)
    }, STATE_CAROUSEL_AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [hoverPaused, reducedMotion, states.length])

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
      <SectionTitle eyebrow="Cobertura estadual" title="Monitoramento tributário nos estados" copy="São Paulo abre a seleção; os demais estados seguem a cobertura configurada pela TriBusca." />
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
          <div className="state-publications ref-state-publications"><strong>Últimas publicações · {current.uf}</strong><span>—</span><span>—</span><span>—</span></div>
          <a href={current.page} target="_blank" rel="noreferrer" className="photo-credit">Foto: {current.author} · {current.license} · Wikimedia Commons</a>
        </div>
        <div className="carousel-controls ref-carousel-controls"><button type="button" onClick={previous} aria-label="Estado anterior"><ArrowLeft /></button><button type="button" onClick={next} aria-label="Próximo estado"><ArrowRight /></button></div>
        <span className="state-position ref-state-position">{index + 1} / {states.length}</span>
      </div>
      <div className="carousel-dots ref-carousel-dots" aria-label="Estados em destaque">{states.map((state, stateIndex) => <button key={state.uf} type="button" aria-label={`Exibir ${state.name}`} aria-current={stateIndex === index} className={stateIndex === index ? 'active' : ''} onClick={() => setIndex(stateIndex)} />)}</div>
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
        return <article key={source.code} className="ref-federal-card"><span className={`collection-status ref-status ${statusClass(data.status)}`}>{data.status}</span><strong>{source.name}</strong><p>{federalDescriptions[source.name] ?? 'Fonte oficial monitorada pela TriBusca.'}</p><small>Última atualização: {data.lastSuccessAt}</small></article>
      })}</div>
    </div>
  </section>
}

function PortfolioHome() {
  return <section className="ref-section"><div className="ref-container">
    <div className="ref-section-head-row"><SectionTitle eyebrow="Portfólio" title="Uma plataforma, seis recursos." copy="Os recursos são partes da TriBusca, não produtos separados. O status de cada um é mostrado como está hoje." /><Link className="ref-text-link" to="/portfolio">Ver portfólio completo <ArrowRight size={16} /></Link></div>
    <div className="ref-product-grid">{products.map((product) => <article className="ref-product-card" key={product.name}><span className="ref-icon-box"><product.icon size={22} /></span><div><strong>{product.name}</strong><small>{product.descriptor}</small></div><p>{product.description}</p><span className="ref-product-status">Em desenvolvimento</span></article>)}</div>
  </div></section>
}

function NormaClara() {
  const [index,setIndex] = useState(0)
  const ex=DECODIFICA_EXAMPLES[index]
  return <section className="ref-section ref-soft-section"><div className="ref-container">
    <SectionTitle eyebrow="Norma Clara" title={`${index+1}. ${ex.title}`} copy="Texto oficial e leitura auxiliar lado a lado, com identificação explícita da camada de IA." />
    <div className="ref-legal-pair"><article><span>Texto oficial</span><p>“{ex.official}”</p><strong>{ex.source}</strong></article><article className="ref-ai-reading"><span>Norma Clara · Leitura auxiliar</span><p>{ex.auxiliary}</p><small>Gerada por IA. Não substitui o texto oficial.</small></article></div>
    <div className="ref-carousel-row"><span>{index+1} / {DECODIFICA_EXAMPLES.length}</span><div><button type="button" aria-label="Exemplo anterior" onClick={()=>setIndex((index-1+DECODIFICA_EXAMPLES.length)%DECODIFICA_EXAMPLES.length)}><ArrowLeft /></button><button type="button" aria-label="Próximo exemplo" onClick={()=>setIndex((index+1)%DECODIFICA_EXAMPLES.length)}><ArrowRight /></button></div></div>
  </div></section>
}

function HowHome() {
  const steps=[['1','Captura oficial','A TriBusca consulta as fontes e preserva a origem.'],['2','Organização','A publicação é normalizada, deduplicada e versionada.'],['3','Contexto','Marcadores e Perfil Tributário ajudam a explicar relevância.']]
  return <section className="ref-section"><div className="ref-container">
    <SectionTitle eyebrow="Como funciona" title="A legislação encontra a empresa." copy="Da fonte oficial ao contexto tributário, cada etapa permanece explicável e rastreável." />
    <div className="ref-step-grid">{steps.map(([n,name,desc])=><article key={n}><span>{n}</span><strong>{name}</strong><p>{desc}</p></article>)}</div>
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
      <SectionTitle eyebrow="Cobertura Federal" title="O que está ativo fica claro." copy="A situação exibida abaixo vem da API pública oficial da TriBusca." />
      <div className="ref-coverage-grid">{FEDERAL_COVERAGE.map(source=>{const data=toCoveragePresentation(findFederalSource(items,source.code),available);return <CoverageCard key={source.code} code={source.code.toUpperCase()} name={source.name} description={federalDescriptions[source.name]??'Fonte oficial monitorada.'} {...data} testId="federal-coverage-card"/>})}</div>
    </div></section>
    <section className="ref-section ref-soft-section"><div className="ref-container"><SectionTitle eyebrow="Cobertura estadual" title="Monitoramento tributário nos estados" copy="Diários oficiais estaduais entram um a um. São Paulo é o primeiro; os demais estados seguem a implantação configurada."/><div className="ref-coverage-grid">{states.map(state=>{const data=toCoveragePresentation(findStateSource(items,state.uf),available);return <CoverageCard key={state.uf} code={state.uf} name={`${state.name} / ${state.uf}`} description={`Diário Oficial e atos estaduais de ${state.name}.`} {...data} testId="state-coverage-card"/>})}</div></div></section>
    <section className="ref-section"><div className="ref-container"><SectionTitle eyebrow="Saúde operacional" title="Cada fonte mostra como está hoje." copy="Falha de fonte não significa ausência de publicações."/><div className="ref-health-grid"><Health name="Operacional" text="Consultada com sucesso no ciclo mais recente."/><Health name="Instável" text="Respostas intermitentes ou parciais."/><Health name="Indisponível" text="A fonte oficial não respondeu."/><Health name="Ainda não consultada" text="Fonte em implantação, sem coleta produtiva."/></div></div></section>
    <PublicCta onAuth={onAuth}/>
  </main>
}

function CoverageCard({code,name,description,status,lastSuccessAt,importedToday,totalPublications,testId}:{code:string;name:string;description:string;status:string;lastSuccessAt:string;importedToday:string;totalPublications:string;testId?:string}) {
  return <article className="coverage-card ref-coverage-card" data-testid={testId}><div className="ref-source-code">{code}</div><div className="ref-coverage-copy"><strong>{name}</strong><p>{description}</p><span className={`collection-status ref-status ${statusClass(status)}`}>{status}</span></div><dl className="coverage-metrics"><div><dt>Última atualização</dt><dd>{lastSuccessAt}</dd></div><div><dt>Importadas hoje</dt><dd>{importedToday}</dd></div><div><dt>Total no acervo</dt><dd>{totalPublications}</dd></div></dl></article>
}

function Health({name,text}:{name:string;text:string}) { return <article><span className="ref-health-dot"/><strong>{name}</strong><p>{text}</p></article> }

function PortfolioPage({onAuth}:{onAuth:OpenAuth}) {
  return <main><PageHero eyebrow="Portfólio" title="Recursos da TriBusca para encontrar o que importa no meio do ruído." copy="Os recursos são partes da mesma plataforma, não produtos separados. Cada um mostra seu estado atual." />
    <section className="ref-section"><div className="ref-container ref-product-detail-stack">
      <ProductSection icon={BookOpen} name="Acervo" descriptor="Base de consulta"><AcervoMock/></ProductSection>
      <ProductSection icon={MonitorCheck} name="Central de Monitoramento" descriptor="Saúde das fontes"><div className="ref-monitor-demo"><Health name="Operacional" text="Coleta concluída"/><Health name="Instável" text="Resposta parcial"/><Health name="Indisponível" text="Fonte não respondeu"/><Health name="Ainda não consultada" text="Implantação"/></div></ProductSection>
      <ProductSection icon={RadioTower} name="Sonar" descriptor="Afinidade tributária"><SonarDemo/></ProductSection>
      <ProductSection icon={BellRing} name="Revela" descriptor="Boletim diário"><div className="ref-bulletin-demo"><span>Revela · boletim de hoje</span><strong>Empresa exemplo</strong><article><b>Alta afinidade</b><p>Convênio ICMS · benefício fiscal para fertilizantes</p><small>Sinais: ICMS · fertilizantes · estabelecimento em GO</small></article><article><b>Menção direta</b><p>Publicação cita o CNPJ da filial GO-02</p><small>Estabelecimento relacionado: GO-02</small></article></div></ProductSection>
      <ProductSection icon={Sparkles} name="Decodifica" descriptor="Linguagem clara"><DecodificaDetail/></ProductSection>
      <ProductSection icon={Building2} name="Perfil Tributário" descriptor="Contexto da empresa"><div className="ref-profile-tags">{['CNPJ','Regime','CNAEs','Estabelecimentos','UFs','Produtos','NCMs','Operações','CFOPs','Tributos'].map(x=><span key={x}>{x}</span>)}</div></ProductSection>
    </div></section><PublicCta onAuth={onAuth}/></main>
}

function ProductSection({icon:Icon,name,descriptor,children}:{icon:typeof BookOpen;name:string;descriptor:string;children:ReactNode}) { return <section className="ref-product-detail"><div className="ref-product-detail-head"><span className="ref-icon-box"><Icon size={24}/></span><div><span className="ref-product-status">Em desenvolvimento</span><small>{descriptor}</small><h2>{name}</h2></div></div><p>{products.find(p=>p.name===name)?.description}</p>{children}</section> }

function AcervoMock(){return <div className="ref-acervo-mock"><div><Search size={17}/><span>Buscar no Acervo…</span><button type="button">Buscar</button></div><div>{['Título ▾','Número ▾','Órgão ▾','Conteúdo ▾','Fonte ▾','UF ▾','Período ▾'].map(x=><span key={x}>{x}</span>)}</div><small>Exemplo ilustrativo da interface.</small></div>}

function SonarDemo(){return <div className="ref-sonar-demo"><div className="sonar-scale"><SonarState level="high" label="Alta" description="sinal próximo ao centro"/><SonarState level="medium" label="Média" description="distância intermediária"/><SonarState level="low" label="Baixa" description="sinal distante"/></div><div className="ref-signal-demo"><strong>Sinais encontrados</strong>{['Trata de ICMS','Envolve operação de venda','Estabelecimento em GO'].map(x=><p key={x}><Check size={14}/> {x}</p>)}</div></div>}

function SonarState({level,label,description}:{level:'high'|'medium'|'low';label:string;description:string}) { return <div className={`sonar-state sonar-state-${level}`}><div className={`sonar sonar-${level}`}><span className="sonar-ring ring-1"/><span className="sonar-ring ring-2"/><span className="sonar-ring ring-3"/><span className="sonar-sweep"/><span className="sonar-ping"/></div><div><strong>{label} afinidade</strong><p>{description}</p></div></div> }

function DecodificaDetail(){const[index,setIndex]=useState(0);const ex=DECODIFICA_EXAMPLES[index];return <div className="ref-decodifica-detail"><span className="micro-label">Exemplo {index+1} de {DECODIFICA_EXAMPLES.length}</span><div className="ref-carousel-row"><span>{index+1} / {DECODIFICA_EXAMPLES.length}</span><div><button type="button" aria-label="Exemplo anterior" onClick={()=>setIndex((index-1+DECODIFICA_EXAMPLES.length)%DECODIFICA_EXAMPLES.length)}><ArrowLeft/></button><button type="button" aria-label="Próximo exemplo" onClick={()=>setIndex((index+1)%DECODIFICA_EXAMPLES.length)}><ArrowRight/></button></div></div><h3>{index+1}. {ex.title}</h3><div className="ref-legal-pair"><article><span>Texto oficial</span><p>“{ex.official}”</p><strong>{ex.source}</strong></article><article className="ref-ai-reading"><span>Decodifica · Leitura auxiliar</span><p>{ex.auxiliary}</p><small>Gerada por IA. Não substitui o texto oficial.</small></article></div></div>}

function HowItWorksPage({onAuth}:{onAuth:OpenAuth}) { return <main><PageHero eyebrow="Como funciona" title="A legislação encontra a empresa." copy="Da fonte oficial à relevância para a sua empresa, cada etapa preserva a origem e explica o porquê."/><section className="ref-section"><div className="ref-container"><div className="ref-process-list">{howSteps.map(([n,name,desc])=><article key={n}><span>{n}</span><div><strong>{name}</strong><p>{desc}</p></div></article>)}</div></div></section><section className="ref-section ref-soft-section"><div className="ref-container"><SectionTitle eyebrow="Relevância" title="Por que priorizar" copy="Cada prioridade vem acompanhada de motivos verificáveis e grau de certeza."/><RelevanceExample/></div></section><section className="ref-section"><div className="ref-container"><SectionTitle eyebrow="Transparência" title="Fato oficial, inteligência e IA, sempre separados." copy="Cada camada da experiência deixa claro de onde veio a informação."/><div className="ref-transparency-grid"><Trace icon={FileSearch} title="Fato oficial" text="Texto e arquivos como publicados pela fonte."/><Trace icon={RadioTower} title="Inteligência TriBusca" text="Marcadores, versões e relevância calculados pela plataforma."/><Trace icon={Sparkles} title="Conteúdo gerado por IA" text="Leituras auxiliares sempre identificadas."/></div></div></section><Traceability/><PublicCta onAuth={onAuth}/></main> }

function TaxReformPage({onAuth}:{onAuth:OpenAuth}) { const [filter,setFilter]=useState('Todos');return <main><PageHero eyebrow="Reforma Tributária" title="A Reforma Tributária, organizada a partir da fonte oficial." copy="Legislação, regulamentação, notas técnicas e demais publicações oficiais reunidas a partir do Acervo da TriBusca."/><section className="ref-section"><div className="ref-container"><SectionTitle eyebrow="Linha do tempo" title="Publicação e vigência são datas diferentes." copy="Datas futuras aparecem apenas quando previstas em fonte oficial."/><div className="ref-reform-legend"><span>Publicação</span><span>Vigência</span><span>Marco previsto em lei</span></div><div className="ref-reform-timeline">{reformTimeline.map((item,index)=><article key={`${item.date}-${item.title}`}><div className="ref-timeline-axis"><span/><i/></div><div className="ref-timeline-content"><small>{item.date}</small><em>{item.kind}</em><strong>{item.title}</strong><p>{item.text}</p></div>{index===reformTimeline.length-1?null:null}</article>)}</div><p className="ref-legal-note">Conferir cada item com a fonte oficial antes de publicação definitiva.</p></div></section><section className="ref-section ref-soft-section"><div className="ref-container"><SectionTitle eyebrow="No Acervo" title="Publicações relacionadas" copy="Lista ilustrativa; a integração com o Acervo real permanece sujeita aos gates de exposição pública."/><div className="ref-filter-row">{['Todos','Legislação','Regulamentação','Notas técnicas','IBS','CBS','Imposto Seletivo'].map(x=><button key={x} className={filter===x?'active':''} onClick={()=>setFilter(x)} type="button">{x}</button>)}</div><div className="ref-related-list">{[['CGIBS','Resolução CGIBS nº 18/2026','15/09/2026'],['CGIBS','Resolução CGIBS nº 6/2026 — Regulamento do IBS','30/04/2026'],['Planalto','Lei Complementar nº 214/2025','2025']].map(([org,title,date])=><article key={title}><span>{org}</span><strong>{title}</strong><small>{date}</small></article>)}</div></div></section><PublicCta onAuth={onAuth}/></main> }

function PageHero({eyebrow,title,copy}:{eyebrow:string;title:string;copy:string}) { return <section className="ref-page-hero"><div className="ref-container"><span className="ref-kicker">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div></section> }
function SectionTitle({eyebrow,title,copy}:{eyebrow:string;title:string;copy:string}) { return <div className="ref-section-title"><span>{eyebrow}</span><h2>{title}</h2><p>{copy}</p></div> }
function statusClass(status:string){return status==='—'?'collection-pending-data':`collection-${status.toLowerCase().replaceAll(' ','-')}`}

function PublicCta({onAuth}:{onAuth:OpenAuth}) { return <section className="ref-public-cta"><div className="ref-container"><div><h2>Pare de procurar mudanças tributárias manualmente.</h2><p>7 dias para conhecer a TriBusca.</p></div><div><button className="ref-button ref-button-cyan" type="button" onClick={(event)=>onAuth('signup',event.currentTarget)}>Experimentar grátis</button><button className="ref-button ref-button-light" type="button" onClick={(event)=>onAuth('login',event.currentTarget)}>Entrar</button></div></div></section> }

function PublicFooter(){return <footer className="site-footer ref-footer"><div className="ref-container footer-wrap ref-footer-wrap"><img src="/brand/tribusca-logo-horizontal-dark.png" alt="TriBusca" className="footer-logo"/><p>Monitoramento e Inteligência Tributária</p><p className="footer-note">Termos de uso e Política de privacidade em elaboração · © 2026 TriBusca</p></div></footer>}