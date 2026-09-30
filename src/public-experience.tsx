import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Menu,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type TouchEvent } from 'react'
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

const HOME_FEED = [
  { src: 'DOU', time: 'há 12 min', title: 'Exemplo de captura — substituir pelo feed real' },
  { src: 'CONFAZ', time: 'há 40 min', title: 'Exemplo de captura — substituir pelo feed real' },
  { src: 'SEFAZ-SP', time: 'há 1 h', title: 'Exemplo de captura — substituir pelo feed real' },
  { src: 'CGIBS', time: 'há 2 h', title: 'Exemplo de captura — substituir pelo feed real' },
] as const

const HOME_PRODUCTS = [
  { name: 'Acervo', description: 'Conteúdo oficial preservado, com busca por título, número, órgão, conteúdo, fonte, UF e período.', status: 'Disponível' },
  { name: 'Central de Monitoramento', description: 'Situação operacional de cada fonte oficial: última consulta, falhas e tempo de resposta.', status: 'Disponível' },
  { name: 'Sonar', description: 'Afinidade Alta, Média ou Baixa entre cada publicação e o Perfil Tributário, com os sinais encontrados.', status: 'Em desenvolvimento' },
  { name: 'Revela', description: 'Boletim diário com publicações de Alta afinidade e menções diretas à empresa.', status: 'Em desenvolvimento' },
  { name: 'Decodifica', description: 'O texto oficial explicado em linguagem clara, artigo por artigo, sob demanda.', status: 'Em desenvolvimento' },
  { name: 'Perfil Tributário', description: 'Contexto da empresa: CNPJ, regime, CNAEs, estabelecimentos, UFs e operações.', status: 'Em desenvolvimento' },
] as const

function HomePage({ onAuth }: { onAuth: OpenAuth }) {
  return <main className="ref-home-page">
    <section className="ref-hero ref-hero-home">
      <div className="ref-container ref-hero-grid">
        <div className="ref-hero-copy">
          <span className="ref-kicker">Monitoramento e Inteligência Tributária</span>
          <h1>
            Saiba o que mudou.<br />
            Entenda o que<br />
            importa.<br />
            <span>Cheque à fonte<br />oficial.</span>
          </h1>
          <p>A TriBusca acompanha fontes oficiais e organiza mudanças tributárias para sua empresa chegar mais rápido ao que merece atenção.</p>
          <div className="ref-hero-actions">
            <button className="ref-button ref-button-primary ref-home-primary" type="button" onClick={(event) => onAuth('signup', event.currentTarget)}>Experimentar grátis <ArrowRight size={17} /></button>
            <Link className="ref-button ref-button-hero-outline" to="/portfolio">Conhecer soluções</Link>
          </div>
          <small>7 dias para conhecer a TriBusca.</small>
        </div>
        <HomeFeedCard />
      </div>
    </section>

    <StateCarousel />
    <FederalHome />
    <PortfolioHome />
    <HomeDecodifica />
    <HomeHow />
    <HomeTraceability />
    <PublicCta onAuth={onAuth} showLogin />
  </main>
}

function HomeFeedCard() {
  return <aside className="ref-home-feed" aria-label="Agora no radar">
    <div className="ref-home-feed-head">
      <div><span>Agora no radar</span><strong>Últimas capturas reais</strong></div>
      <i aria-hidden="true" />
    </div>
    {HOME_FEED.map((item) => <div className="ref-home-feed-row" key={item.src}>
      <span>{item.src} · {item.time}</span>
      <strong>{item.title}</strong>
    </div>)}
  </aside>
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
  const stateStatus = toCoveragePresentation(findStateSource(sourceItems, current.uf), dataAvailable).status

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
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % states.length), STATE_CAROUSEL_AUTOPLAY_MS)
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
    if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current
    const touch = event.changedTouches[0]
    touchStartRef.current = null
    if (!start || !touch) return
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < STATE_CAROUSEL_SWIPE_THRESHOLD_PX || Math.abs(deltaX) <= Math.abs(deltaY)) return
    if (deltaX < 0) next()
    else previous()
  }

  const examplePublications = [
    { type: 'Decreto', date: '25 set', title: 'Altera o Regulamento do ICMS/' + current.uf + ' (exemplo)' },
    { type: 'Portaria SEFAZ', date: '24 set', title: 'Prazos de obrigações acessórias em ' + current.name + ' (exemplo)' },
    { type: 'Resolução', date: '22 set', title: 'Procedimentos para benefício fiscal (exemplo)' },
  ]

  return <section className="ref-home-section ref-state-section">
    <div className="ref-container">
      <div className="ref-home-section-heading"><span>Cobertura estadual</span><h2>Monitoramento tributário nos estados</h2></div>
      <div
        className="state-carousel ref-state-carousel"
        data-testid="state-carousel"
        onMouseEnter={() => setHoverPaused(true)}
        onMouseLeave={() => setHoverPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => { touchStartRef.current = null }}
      >
        <div className="ref-state-fallback"><span>Fotografia de {current.capital} · Wikimedia Commons</span></div>
        <img src={current.img} alt={current.place} className="state-photo" />
        <div className="state-overlay" />
        <span className="sr-only" data-testid="state-carousel-status" aria-live="polite">{stateStatus}</span>

        <div className="ref-state-identity">
          <strong data-uf={current.uf} aria-label={current.uf}></strong>
          <span>{current.name} · {current.capital}</span>
          <small>{current.place} · Foto: Wikimedia Commons</small>
        </div>

        <div className="ref-state-publications-card">
          <div className="ref-state-publications-card-head">
            <strong>Últimas publicações · {current.uf}</strong>
            <Link to="/cobertura">Ver todas →</Link>
          </div>
          {examplePublications.map((publication) => <div className="ref-state-publication-row" key={publication.type}>
            <span>{publication.type} · {publication.date}</span>
            <strong>{publication.title}</strong>
          </div>)}
        </div>

        <div className="ref-state-controls">
          <div className="ref-state-tabs" role="tablist" aria-label="Estados em destaque">
            {states.map((state, stateIndex) => <button key={state.uf} role="tab" type="button" aria-label={'Exibir ' + state.name} aria-selected={stateIndex === index} className={stateIndex === index ? 'active' : ''} onClick={() => setIndex(stateIndex)}>{state.uf}</button>)}
          </div>
          <i aria-hidden="true" />
          <button type="button" onClick={previous} aria-label="Estado anterior"><ArrowLeft size={16} /></button>
          <button type="button" onClick={togglePlayback} aria-label={manuallyPaused ? 'Reproduzir' : 'Pausar'}>{manuallyPaused ? '▶' : 'Ⅱ'}</button>
          <button type="button" onClick={next} aria-label="Próximo estado"><ArrowRight size={16} /></button>
        </div>
      </div>
      <p className="ref-state-carousel-footer" data-testid="state-carousel-position">{index + 1} / {states.length} · Fotografias reais do Wikimedia Commons, com autoria e licença na legenda.</p>
    </div>
  </section>
}

function FederalHome() {
  const query = useQuery({ queryKey:['public-sources-home'], queryFn:({signal})=>fetchPublicSources(undefined, signal), retry:false, staleTime:0, gcTime:0, refetchOnWindowFocus:false })
  const available = query.isSuccess && !query.isFetching
  const items = available ? query.data.items : []
  return <section className="ref-home-section ref-home-federal-section">
    <div className="ref-container ref-home-federal-layout">
      <div className="ref-home-federal-copy">
        <span>Cobertura Federal</span>
        <h2>O que está ativo fica claro.</h2>
        <p>A TriBusca diferencia uma fonte em produção de outra ainda em implantação. Nada é apresentado como cobertura produtiva antes de estar operacional.</p>
      </div>
      <div className="ref-home-federal-grid">{FEDERAL_COVERAGE.map((source) => {
        const data = toCoveragePresentation(findFederalSource(items, source.code), available)
        const status = query.isLoading || query.isFetching ? 'Verificando…' : data.status
        return <article key={source.code}><strong>{source.name}</strong><span className={'collection-status ref-status ' + statusClass(status)}>{status}</span></article>
      })}</div>
    </div>
  </section>
}

function PortfolioHome() {
  return <section className="ref-home-section ref-home-portfolio">
    <div className="ref-container">
      <div className="ref-home-portfolio-head">
        <div><span>Portfólio</span><h2>Uma plataforma, seis recursos.</h2></div>
        <p>Os recursos são partes da TriBusca, não produtos separados. O status de cada um é mostrado como está hoje.</p>
      </div>
      <Link className="ref-home-portfolio-link" to="/portfolio">Ver portfólio completo →</Link>
      <div className="ref-home-product-grid">
        {HOME_PRODUCTS.map((product) => <article className={product.status === 'Disponível' ? 'is-available' : ''} key={product.name}>
          <strong>{product.name}</strong>
          <p>{product.description}</p>
          <span className={product.status === 'Disponível' ? 'is-available' : ''}>{product.status}</span>
        </article>)}
      </div>
    </div>
  </section>
}

function HomeDecodifica() {
  const [index,setIndex] = useState(0)
  const ex=DECODIFICA_EXAMPLES[index]
  return <section className="ref-home-section ref-home-decodifica">
    <div className="ref-container">
      <div className="ref-home-decodifica-head">
        <div><span>Decodifica</span><h2>{index + 1}. {index === 0 ? 'Split payment — IBS e CBS' : ex.title}</h2></div>
        <div className="ref-home-decodifica-controls">
          <span>{index + 1} / {DECODIFICA_EXAMPLES.length}</span>
          <button type="button" aria-label="Exemplo anterior" onClick={() => setIndex((index - 1 + DECODIFICA_EXAMPLES.length) % DECODIFICA_EXAMPLES.length)}><ArrowLeft size={16} /></button>
          <button type="button" aria-label="Próximo exemplo" onClick={() => setIndex((index + 1) % DECODIFICA_EXAMPLES.length)}><ArrowRight size={16} /></button>
        </div>
      </div>
      <div className="ref-home-decodifica-pair">
        <article>
          <span>Texto oficial</span>
          <p>“{ex.official}”</p>
          <strong>{ex.source}{ex.source.includes('Planalto') ? '' : '. Planalto'}</strong>
        </article>
        <article>
          <span>Decodifica · Leitura auxiliar</span>
          <p>{ex.auxiliary}</p>
          <small>Gerada por IA. Não substitui o texto oficial.</small>
        </article>
      </div>
      <div className="ref-home-progress" aria-label="Exemplos Decodifica">{DECODIFICA_EXAMPLES.map((item,itemIndex)=><button key={item.title} type="button" aria-label={'Exibir exemplo ' + (itemIndex+1)} aria-current={itemIndex===index} className={itemIndex===index?'active':''} onClick={()=>setIndex(itemIndex)}/>)}</div>
    </div>
  </section>
}

function HomeHow() {
  const steps = [
    ['1','Captura oficial','Fontes oficiais consultadas automaticamente; texto, arquivos e hash preservados.'],
    ['2','Marcadores Tributários','Vocabulário controlado da TriBusca — nunca tags livres criadas pela IA.'],
    ['3','Relevância explicável','Cruzamento com o Perfil Tributário, dizendo por que cada norma foi priorizada.'],
  ] as const
  return <section className="ref-home-section ref-home-how">
    <div className="ref-container ref-home-how-layout">
      <div>
        <span className="ref-home-eyebrow">Como funciona</span>
        <h2>A legislação encontra a<br />empresa.</h2>
        <div className="ref-home-how-steps">
          {steps.map(([n,name,desc]) => <article key={n}><span>{n}</span><div><strong>{name}</strong><p>{desc}</p></div></article>)}
        </div>
      </div>
      <RelevancePanel />
    </div>
  </section>
}

function RelevancePanel() {
  return <div className="ref-relevance-panel">
    <small>Exemplo ilustrativo · classificação e relevância em desenvolvimento</small>
    <div><span>Publicação</span><strong>Convênio ICMS 100/97</strong><p>ICMS · Benefício Fiscal · Fertilizantes · Operações de saída</p></div>
    <div><span>Perfil</span><strong>Empresa exemplo</strong><p>Agronegócio · GO · Fertilizantes · Venda</p></div>
    <div className="is-priority"><span>Por que priorizar</span><strong>Possivelmente relevante</strong><p>✓ Trata de fertilizantes<br />✓ Envolve operação de venda<br />✓ Trata de ICMS<br />✓ A empresa possui estabelecimento em GO</p></div>
  </div>
}

function HomeTraceability() {
  const items = [
    ['Fonte oficial','Órgão e URL preservados'],
    ['Histórico','Coletas e alterações'],
    ['Versões','Conteúdo versionado'],
    ['Integridade','Arquivo e hash'],
  ] as const
  return <section className="ref-home-section ref-home-trace">
    <div className="ref-container">
      <div className="ref-home-section-heading"><span>Rastreabilidade</span><h2>Informação rastreável até a origem.</h2></div>
      <div className="ref-home-trace-grid">{items.map(([name,desc]) => <article key={name}><strong>{name}</strong><span>{desc}</span></article>)}</div>
    </div>
  </section>
}

function CoveragePage({ onAuth }: { onAuth: OpenAuth }) {
  const states=[...STATE_COVERAGE].sort((a,b)=>a.uf==='SP'?-1:b.uf==='SP'?1:a.name.localeCompare(b.name,'pt-BR'))
  const query=useQuery({queryKey:['public-sources'],queryFn:({signal})=>fetchPublicSources(undefined,signal),retry:false,staleTime:0,gcTime:0,refetchOnWindowFocus:false})
  const available=query.isSuccess&&!query.isFetching
  const items=available?query.data.items:[]
  const federalCodes: Record<string,string> = { dou:'DOU', confaz:'CONF', 'nfe-encat':'NF-e', sped:'SPED', cgibs:'CGIBS', 'rfb-normas':'RFB' }

  return <main className="ref-model-page">
    <PageHero eyebrow="Cobertura" title="Fontes oficiais acompanhadas, com saúde operacional visível." copy="A TriBusca diferencia uma fonte em produção de outra ainda em implantação. Nada é apresentado como cobertura produtiva antes de estar operacional." />
    <section className="ref-model-section">
      <div className="ref-container">
        {!available && !query.isLoading && <div className="ref-live-warning">Dados ao vivo indisponíveis no momento. Os campos sem informação aparecem como “—”.</div>}
        <div className="ref-model-heading"><span>Cobertura Federal</span><h2>O que está ativo fica claro.</h2></div>
        <div className="ref-coverage-rows">
          {FEDERAL_COVERAGE.map(source=>{
            const data=toCoveragePresentation(findFederalSource(items,source.code),available)
            return <CoverageRow key={source.code} code={federalCodes[source.code] ?? source.code.toUpperCase()} name={source.name} description={federalDescriptions[source.name]??'Fonte oficial monitorada.'} {...data} testId="federal-coverage-card"/>
          })}
        </div>

        <div className="ref-model-heading ref-coverage-state-heading">
          <span>Cobertura estadual</span>
          <h2>Monitoramento tributário nos estados</h2>
          <p>Diários oficiais estaduais entram um a um. São Paulo é o primeiro; os demais estados seguem em implantação.</p>
        </div>
        <div className="ref-coverage-rows">
          {states.map(state=>{
            const data=toCoveragePresentation(findStateSource(items,state.uf),available)
            return <CoverageRow key={state.uf} code={state.uf} name={state.name + ' / ' + state.uf} description={'Diário Oficial e atos estaduais de ' + state.name + '.'} {...data} testId="state-coverage-card"/>
          })}
        </div>
      </div>
    </section>

    <section className="ref-model-section ref-health-section">
      <div className="ref-container">
        <div className="ref-model-heading"><span>Saúde operacional</span><h2>Cada fonte mostra como está hoje.</h2></div>
        <div className="ref-health-cards">
          <Health name="Operacional" text="Consultada com sucesso no ciclo mais recente." tone="ok"/>
          <Health name="Instável" text="Respostas intermitentes ou parciais." tone="partial"/>
          <Health name="Indisponível" text="A fonte oficial não respondeu. Isso não significa ausência de publicações." tone="down"/>
          <Health name="Ainda não consultada" text="Fonte em implantação, sem coleta produtiva." tone="idle"/>
        </div>
      </div>
    </section>
    <PublicCta onAuth={onAuth} showLogin={false}/>
  </main>
}

function CoverageRow({code,name,description,status,lastSuccessAt,importedToday,totalPublications,testId}:{code:string;name:string;description:string;status:string;lastSuccessAt:string;importedToday:string;totalPublications:string;testId?:string}) {
  return <article className="coverage-card ref-coverage-row" data-testid={testId}>
    <div className="ref-coverage-source"><span>{code}</span><div><strong>{name}</strong><small>{description}</small></div></div>
    <div className="ref-coverage-cell"><small>Coleta</small><strong><i className={'ref-coverage-dot ' + coverageDotClass(status)} />{status}</strong></div>
    <div className="ref-coverage-cell"><small>Última atualização</small><strong data-value={lastSuccessAt}></strong></div>
    <div className="ref-coverage-cell"><small>Importadas hoje</small><b data-value={importedToday}></b></div>
    <div className="ref-coverage-cell"><small>Total no acervo</small><b data-value={totalPublications}></b></div>
    <span className={'collection-status sr-only ' + statusClass(status)}>Coleta {status}</span>
    <dl className="coverage-metrics sr-only"><div><dt>Última atualização</dt><dd>{lastSuccessAt}</dd></div><div><dt>Importadas hoje</dt><dd>{importedToday}</dd></div><div><dt>Total no acervo</dt><dd>{totalPublications}</dd></div></dl>
  </article>
}

function coverageDotClass(status:string) {
  if (status === 'Online') return 'is-online'
  if (status === 'Em validação') return 'is-partial'
  if (status === 'Indisponível') return 'is-down'
  return 'is-idle'
}

function Health({name,text,tone='ok'}:{name:string;text:string;tone?:'ok'|'partial'|'down'|'idle'}) {
  return <article><strong><i className={'ref-health-dot is-' + tone}/>{name}</strong><p>{text}</p></article>
}

function PortfolioPage({onAuth}:{onAuth:OpenAuth}) {
  const portfolioAnchors=[['acervo','Acervo'],['monitoramento','Central de Monitoramento'],['sonar','Sonar'],['revela','Revela'],['decodifica','Decodifica'],['perfil','Perfil Tributário']] as const
  return <main className="ref-model-page ref-portfolio-page">
    <PageHero eyebrow="Portfólio" title="Recursos da TriBusca para encontrar o que importa no meio do ruído." copy="Os recursos são partes da mesma plataforma, não produtos separados. Cada um mostra seu estado atual: nada é apresentado como disponível antes de estar operacional." />
    <nav className="ref-model-anchors" aria-label="Recursos do portfólio"><div className="ref-container">{portfolioAnchors.map(([id,label])=><a key={id} href={'#'+id}>{label}</a>)}</div></nav>

    <PortfolioFeature id="acervo" status="Disponível" eyebrow="Base de consulta" title="Acervo" description={<p>Consulta organizada ao conteúdo oficial coletado e preservado pela TriBusca: publicações, versões, origem oficial e metadados. A <b>Busca</b> é uma função do Acervo, com pesquisa por título, número, órgão, conteúdo, fonte, UF e período.</p>}>
      <AcervoMock />
    </PortfolioFeature>

    <PortfolioFeature id="monitoramento" status="Disponível" eyebrow="Saúde das fontes" title="Central de Monitoramento" description={<p>Mostra a situação operacional de cada fonte oficial: última consulta, tentativas, indisponibilidade e tempo de resposta. Falha de uma fonte não é tratada como ausência de publicações.</p>}>
      <CentralMock />
    </PortfolioFeature>

    <PortfolioFeature id="sonar" status="Em desenvolvimento" eyebrow="Afinidade tributária" title="Sonar" description={<><p>Cruza os Marcadores Tributários de cada publicação com o Perfil Tributário da empresa e de seus estabelecimentos. O resultado é classificado em <b>Alta, Média ou Baixa afinidade</b>, sempre com os sinais encontrados.</p><p>Uma publicação pode ter afinidade com uma filial e não com outra. Uma nova versão da publicação gera novo cálculo.</p></>}>
      <SonarDemo />
    </PortfolioFeature>

    <PortfolioFeature id="revela" status="Em desenvolvimento" eyebrow="Boletim diário" title="Revela" description={<><p>Atualização tributária diária personalizada. Reúne as publicações de <b>Alta afinidade</b> no Sonar e as que têm <b>menção direta</b> à empresa ou a seus estabelecimentos, como a citação do CNPJ.</p><p>Cada item informa por que entrou no boletim e leva à publicação na TriBusca.</p></>}>
      <RevelaMock />
    </PortfolioFeature>

    <section id="decodifica" className="ref-decoding-feature">
      <DecodificaDetail />
    </section>

    <PortfolioFeature id="perfil" status="Em desenvolvimento" eyebrow="Contexto da empresa" title="Perfil Tributário" description={<p>Organiza o contexto da empresa: CNPJ, regime, CNAEs, atividades, segmentos, estabelecimentos e UFs. Progressivamente, produtos, NCMs, operações, CFOPs, tributos e obrigações. Nada disso é exigido de uma vez no cadastro.</p>}>
      <div className="ref-profile-cloud">{['CNPJ','Regime','CNAEs','Estabelecimentos','UFs','Produtos','NCMs','Operações','CFOPs','Tributos'].map(x=><span key={x}>{x}</span>)}</div>
    </PortfolioFeature>

    <PublicCta onAuth={onAuth} showLogin={false}/>
  </main>
}

function PortfolioFeature({id,status,eyebrow,title,description,children}:{id:string;status:'Disponível'|'Em desenvolvimento';eyebrow:string;title:string;description:ReactNode;children:ReactNode}) {
  return <section id={id} className="ref-portfolio-feature ref-container">
    <div className="ref-portfolio-feature-copy">
      <span className={status === 'Disponível' ? 'ref-feature-status is-available' : 'ref-feature-status'}>{status}</span>
      <span className="ref-feature-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <div className="ref-feature-description">{description}</div>
    </div>
    <div className="ref-portfolio-feature-visual">{children}</div>
  </section>
}

function AcervoMock(){
  return <div className="ref-acervo-model">
    <div><span>Buscar no Acervo…</span><b>Buscar</b></div>
    <div>{['Título ▾','Número ▾','Órgão ▾','Conteúdo ▾','Fonte ▾','UF ▾','Período ▾'].map(x=><span key={x}>{x}</span>)}</div>
    <small>Exemplo ilustrativo da interface.</small>
  </div>
}

function CentralMock(){
  const items=[['ok','Operacional'],['partial','Instável'],['down','Indisponível'],['idle','Ainda não consultada']] as const
  return <div className="ref-central-model">{items.map(([tone,label])=><div key={label}><i className={'is-'+tone}/><strong>{label}</strong></div>)}<small>Estados de saúde exibidos para cada fonte.</small></div>
}

type RadarLevel = 'near' | 'medium' | 'far'
type RadarBlip = { level: RadarLevel; left: number; top: number; delay: number }

function randomRadarBlip(index:number): RadarBlip {
  const levels: RadarLevel[] = ['near','medium','far']
  const level = levels[Math.floor(Math.random()*levels.length)] ?? 'medium'
  const ranges: Record<RadarLevel,[number,number]> = { near:[8,22], medium:[25,34], far:[36,44] }
  const [min,max]=ranges[level]
  const radius=min+Math.random()*(max-min)
  const angle=Math.random()*Math.PI*2
  return { level, left:50+Math.cos(angle)*radius, top:50+Math.sin(angle)*radius, delay:2.7+index*3.1 }
}

function SonarDemo(){
  const blips=useMemo(()=>[0,1,2].map(randomRadarBlip),[])
  return <div className="ref-sonar-model">
    <div className="ref-live-radar" aria-label="Radar de afinidade ilustrativo">
      <span className="ref-radar-zone zone-far"/><span className="ref-radar-zone zone-medium"/><span className="ref-radar-zone zone-near"/>
      <span className="ref-live-radar-center"/>
      <span className="ref-live-radar-sweep"/>
      {blips.map((blip,index)=>{
        const style={
          '--blip-left': blip.left + '%',
          '--blip-top': blip.top + '%',
          '--blip-delay': blip.delay + 's',
        } as CSSProperties
        return <span key={index} className={'ref-live-radar-blip is-'+blip.level} style={style}/>
      })}
    </div>
    <div className="ref-sonar-legend">
      <span className="is-near">Alta · sinal próximo ao centro</span>
      <span className="is-medium">Média · distância intermediária</span>
      <span className="is-far">Baixa · sinal distante</span>
    </div>
    <div className="ref-sonar-signals"><b>Sinais encontrados</b><span>✓ Trata de ICMS<br/>✓ Envolve operação de venda<br/>✓ Estabelecimento em GO</span></div>
    <small>Exemplo ilustrativo.</small>
  </div>
}

function RevelaMock(){
  return <div className="ref-revela-model">
    <div className="ref-revela-head"><b>Revela · boletim de hoje</b><span>Empresa exemplo</span></div>
    <article><em className="is-high">Alta afinidade</em><strong>Convênio ICMS · benefício fiscal para fertilizantes</strong><span>Sinais: ICMS · fertilizantes · estabelecimento em GO</span></article>
    <article><em className="is-direct">Menção direta</em><strong>Publicação cita o CNPJ da filial GO-02</strong><span>Estabelecimento relacionado: GO-02</span></article>
    <small>Exemplo ilustrativo.</small>
  </div>
}

function DecodificaDetail(){
  const[index,setIndex]=useState(0)
  const ex=DECODIFICA_EXAMPLES[index]
  return <div className="ref-container ref-decoding-inner">
    <div className="ref-decoding-top">
      <div className="ref-decoding-copy">
        <span className="ref-feature-status">Em desenvolvimento</span>
        <span className="ref-feature-eyebrow">Linguagem clara</span>
        <h2>Decodifica</h2>
        <p>Explica o texto oficial em linguagem clara, artigo por artigo, sob demanda dentro da publicação. O custo aparece no próprio botão antes de acionar: 1 crédito para cada até 25.000 caracteres. Se a norma for alterada, a explicação anterior continua disponível, marcada como desatualizada.</p>
        <div className="ref-decoding-states"><span>Decodificar (4 créditos)</span><span>Traduzido</span><span>Desatualizado</span></div>
      </div>
      <div className="ref-decoding-controls"><span>{index+1} / {DECODIFICA_EXAMPLES.length}</span><button type="button" aria-label="Exemplo anterior" onClick={()=>setIndex((index-1+DECODIFICA_EXAMPLES.length)%DECODIFICA_EXAMPLES.length)}><ArrowLeft size={16}/></button><button type="button" aria-label="Próximo exemplo" onClick={()=>setIndex((index+1)%DECODIFICA_EXAMPLES.length)}><ArrowRight size={16}/></button></div>
    </div>
    <div className="ref-decoding-card">
      <h3>{index+1}. {index===0?'Split payment — IBS e CBS':ex.title}</h3>
      <div>
        <article><span>Texto oficial</span><p>“{ex.official}”</p><strong>{ex.source}{ex.source.includes('Planalto')?'':'. Planalto'}</strong></article>
        <article><span>Decodifica · Leitura auxiliar</span><p>{ex.auxiliary}</p><small>Gerada por IA. Não substitui o texto oficial.</small></article>
      </div>
    </div>
    <div className="ref-home-progress" aria-label="Exemplos Decodifica">{DECODIFICA_EXAMPLES.map((item,itemIndex)=><button key={item.title} type="button" aria-label={'Exibir exemplo '+(itemIndex+1)} aria-current={itemIndex===index} className={itemIndex===index?'active':''} onClick={()=>setIndex(itemIndex)}/>)}</div>
  </div>
}

function HowItWorksPage({onAuth}:{onAuth:OpenAuth}) {
  return <main className="ref-model-page">
    <PageHero eyebrow="Como funciona" title="A legislação encontra a empresa." copy="Da fonte oficial à relevância para a sua empresa, cada etapa preserva a origem e explica o porquê."/>
    <section className="ref-model-section">
      <div className="ref-container ref-how-grid">
        {howSteps.map(([n,name,desc])=><article key={n}><span>{n}</span><strong>{name}</strong><p>{desc}</p></article>)}
      </div>
    </section>
    <section className="ref-model-section">
      <div className="ref-container ref-how-relevance">
        <div><span>Relevância</span><h2>Por que priorizar</h2><p>Cada prioridade vem com os motivos verificáveis. A TriBusca prefere linguagem baseada em evidência e grau de certeza, como “Possível impacto identificado”.</p></div>
        <RelevancePanel/>
      </div>
    </section>
    <section className="ref-model-section">
      <div className="ref-container">
        <div className="ref-model-heading"><span>Transparência</span><h2>Fato oficial, inteligência e IA, sempre separados.</h2></div>
        <div className="ref-transparency-model">
          <article className="is-official"><strong>Fato oficial</strong><p>Texto e arquivos como publicados pela fonte, com órgão, URL e data.</p></article>
          <article className="is-tribusca"><strong>Inteligência TriBusca</strong><p>Marcadores, versões e relevância calculados pela plataforma, com motivos.</p></article>
          <article className="is-ai"><strong>Conteúdo gerado por IA</strong><p>Leituras auxiliares sempre identificadas. Não substituem o texto oficial.</p></article>
        </div>
      </div>
    </section>
    <HomeTraceability/>
    <PublicCta onAuth={onAuth} showLogin={false}/>
  </main>
}

function TaxReformPage({onAuth}:{onAuth:OpenAuth}) {
  const [filter,setFilter]=useState('Todos')
  const related=[['CGIBS','Resolução CGIBS nº 18/2026','15/09/2026'],['CGIBS','Resolução CGIBS nº 6/2026 — Regulamento do IBS','30/04/2026'],['CGIBS','Split Payment — OpenAPI v1.1.0','Documento técnico'],['CGIBS','DeRE v1.2.0 — leiautes e XSD','Documento técnico'],['Planalto','Lei Complementar nº 214/2025','2025']]
  return <main className="ref-model-page">
    <PageHero eyebrow="Reforma Tributária" title="A Reforma Tributária, organizada a partir da fonte oficial." copy="Legislação, regulamentação, notas técnicas e demais publicações oficiais da reforma reunidas a partir do Acervo da TriBusca, com uma linha do tempo que separa publicação, vigência e marcos."/>
    <section className="ref-model-section">
      <div className="ref-container">
        <div className="ref-model-heading"><span>Linha do tempo</span><h2>Publicação e vigência são datas diferentes.</h2></div>
        <div className="ref-reform-timeline-model">
          {reformTimeline.map((item)=><article key={item.date+'-'+item.title} className={item.kind==='Vigência'?'is-effective':item.kind==='Publicação'?'is-publication':'is-future'}>
            <i/>
            <div><span>{item.date}</span><em>{item.kind}</em></div>
            <strong>{item.title}</strong><p>{item.text}</p>
          </article>)}
        </div>
        <p className="ref-legal-note">Datas futuras aparecem apenas quando previstas em norma oficial. Conferir cada item com a fonte antes de publicar.</p>
      </div>
    </section>
    <section className="ref-model-section">
      <div className="ref-container">
        <div className="ref-model-heading"><span>No Acervo</span><h2>Publicações relacionadas</h2></div>
        <div className="ref-filter-row">{['Todos','Legislação','Regulamentação','Notas técnicas','IBS','CBS','Imposto Seletivo'].map(x=><button key={x} className={filter===x?'active':''} onClick={()=>setFilter(x)} type="button">{x}</button>)}</div>
        <div className="ref-related-model">{related.map(([org,title,date])=><article key={title}><span>{org}</span><strong>{title}</strong><small>{date}</small></article>)}</div>
        <p className="ref-legal-note">Lista ilustrativa com publicações já coletadas pelo conector CGIBS; ligar ao Acervo real.</p>
      </div>
    </section>
    <PublicCta onAuth={onAuth} showLogin={false}/>
  </main>
}

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
function statusClass(status:string){return status==='—'?'collection-pending-data':'collection-'+status.toLowerCase().replaceAll(' ','-').replaceAll('…','')}

function PublicCta({onAuth,showLogin=false}:{onAuth:OpenAuth;showLogin?:boolean}) {
  return <section className="ref-public-cta"><div className="ref-container"><div className="ref-public-cta-card">
    <h2>Pare de procurar mudanças tributárias manualmente.</h2>
    <div className="ref-cta-actions"><div><button className="ref-button ref-cta-primary" type="button" onClick={(event)=>onAuth('signup',event.currentTarget)}>Experimentar grátis</button>{showLogin?<button className="ref-button ref-cta-secondary" type="button" onClick={(event)=>onAuth('login',event.currentTarget)}>Entrar</button>:null}</div><p>7 dias para conhecer a TriBusca.</p></div>
  </div></div></section>
}

function PublicFooter(){return <footer className="site-footer ref-footer"><div className="ref-container ref-footer-wrap"><div><img src="/brand/tribusca-logo-horizontal-light.png" alt="TriBusca" className="footer-logo"/><p>Monitoramento e Inteligência Tributária</p></div><p className="footer-note"><Link to="/termos">Termos de uso</Link> · <Link to="/privacidade">Política de privacidade</Link> · © 2026 TriBusca</p></div></footer>}