import {
  ArrowRight,
  BellRing,
  BookOpen,
  CalendarClock,
  Check,
  FileSearch,
  Landmark,
  Layers3,
  RadioTower,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'

const productItems = [
  {
    name: 'Sonar',
    descriptor: 'Afinidade Tributária',
    icon: RadioTower,
    text: 'Cruza os sinais da publicação com o perfil tributário da empresa e dos estabelecimentos para indicar Alta, Média ou Baixa afinidade.',
  },
  {
    name: 'Revela',
    descriptor: 'Boletim inteligente',
    icon: BellRing,
    text: 'Entrega diariamente publicações de Alta afinidade do Sonar e menções diretas à empresa ou aos estabelecimentos.',
  },
  {
    name: 'Decodifica',
    descriptor: 'Linguagem clara',
    icon: Sparkles,
    text: 'Explica a base legal em linguagem mais clara, sob demanda, mantendo o texto oficial como referência principal.',
  },
  {
    name: 'Acervo',
    descriptor: 'Base oficial organizada',
    icon: BookOpen,
    text: 'Centraliza publicações, versões, fontes e marcadores. A Busca faz parte da própria experiência do Acervo.',
  },
]

function App() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/reforma-tributaria" element={<TaxReformPage />} />
      </Routes>
      <SiteFooter />
    </div>
  )
}

function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <Link to="/" className="brand-link" aria-label="TriBusca — página inicial">
          <img src="/brand/tribusca-icon.png" alt="TriBusca" className="brand-icon" />
        </Link>
        <nav aria-label="Navegação principal" className="nav-links">
          <NavLink to="/">Início</NavLink>
          <NavLink to="/portfolio">Portfólio</NavLink>
          <NavLink to="/reforma-tributaria">Reforma Tributária</NavLink>
        </nav>
        <a className="btn btn-small" href="#experimentar">
          Experimentar grátis
        </a>
      </div>
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
              O TriBusca organiza publicações oficiais, preserva rastreabilidade e prepara uma camada de
              inteligência para aproximar cada mudança tributária do contexto real da sua empresa.
            </p>
            <div className="hero-actions">
              <Link className="btn" to="/portfolio">
                Conhecer o portfólio <ArrowRight size={18} />
              </Link>
              <Link className="btn btn-secondary" to="/reforma-tributaria">
                Acompanhar Reforma Tributária
              </Link>
            </div>
            <p className="availability-note">
              Recursos apresentados nesta página estão em desenvolvimento e serão liberados conforme o
              roadmap do produto.
            </p>
          </div>
          <SonarPreview />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Encontre o que importa no meio do ruído"
            title="Uma base oficial. Diferentes formas de chegar ao que merece atenção."
            copy="O produto foi desenhado para separar coleta, afinidade, compreensão e entrega — sem misturar fato oficial com inteligência ou IA."
          />
          <div className="feature-grid">
            {productItems.map((item) => (
              <article className="feature-card" key={item.name}>
                <div className="icon-box"><item.icon size={24} /></div>
                <div className="feature-title-row">
                  <h3>{item.name}</h3>
                  <span className="status-chip">Em desenvolvimento</span>
                </div>
                <p className="feature-descriptor">{item.descriptor}</p>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
          <div className="section-cta">
            <Link to="/portfolio" className="text-link">
              Ver como cada recurso funciona <ArrowRight size={17} />
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
              O TriBusca não substitui a publicação oficial. Cada camada de inteligência deve permanecer
              ligada à origem, à versão e ao histórico correspondente.
            </p>
          </div>
          <div className="trust-list">
            <TrustItem icon={Landmark} title="Origem oficial" text="Referência e URL preservadas." />
            <TrustItem icon={Layers3} title="Histórico" text="Versões e mudanças sem apagar o passado." />
            <TrustItem icon={ShieldCheck} title="Separação clara" text="Fato oficial, inteligência TriBusca e IA identificados." />
          </div>
        </div>
      </section>

      <section className="section reform-home">
        <div className="container split-card">
          <div>
            <span className="eyebrow">Página temática</span>
            <h2>Reforma Tributária em uma visão organizada e cronológica.</h2>
            <p>
              Legislação, regulamentação, notas técnicas, publicações, vigências e faseamento reunidos em
              uma página dedicada — como recorte do Acervo, não como um produto separado.
            </p>
            <Link to="/reforma-tributaria" className="btn btn-secondary">
              Ver página da Reforma <ArrowRight size={18} />
            </Link>
          </div>
          <div className="timeline-mini" aria-hidden="true">
            <span className="timeline-line" />
            {['Publicação', 'Regulamentação', 'Vigência', 'Faseamento'].map((label, index) => (
              <div className="timeline-mini-item" key={label}>
                <span className="timeline-dot">{index + 1}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="experimentar" className="section cta-section">
        <div className="container cta-box">
          <div>
            <span className="eyebrow eyebrow-light">TriBusca</span>
            <h2>7 dias para conhecer o TriBusca.</h2>
            <p>O trial de 7 dias está definido para o lançamento. A disponibilidade será anunciada quando a experiência estiver pronta.</p>
          </div>
          <button className="btn btn-light" type="button" disabled title="Disponível no lançamento">
            Experimentar grátis
          </button>
        </div>
      </section>
    </main>
  )
}

function PortfolioPage() {
  return (
    <main>
      <PageHero
        eyebrow="Portfólio"
        title="Ferramentas diferentes para perguntas diferentes."
        copy="O TriBusca mantém o Acervo como base e adiciona inteligência onde ela realmente gera valor — sem criar nomes para funções que já são autoexplicativas."
      />
      <section className="section">
        <div className="container portfolio-stack">
          <ProductDetail
            icon={RadioTower}
            name="Sonar"
            descriptor="Afinidade Tributária"
            statement="Descubra quão próxima uma publicação está do perfil tributário da sua empresa."
          >
            <div className="product-demo">
              <SonarVisual compact level="high" />
              <div>
                <span className="affinity affinity-high">Alta afinidade</span>
                <p className="muted">Sinal próximo ao seu perfil tributário.</p>
                <strong>5 sinais encontrados</strong>
                <div className="signal-list">
                  {['Goiás', 'ICMS', 'Fertilizantes', 'NCM 3105', 'Produtor rural'].map((signal) => (
                    <span key={signal}>{signal}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="sonar-scale" aria-label="Escala visual de afinidade do Sonar">
              <SonarState level="high" label="Alta afinidade" description="Sinal próximo" />
              <SonarState level="medium" label="Média afinidade" description="Distância intermediária" />
              <SonarState level="low" label="Baixa afinidade" description="Sinal distante" />
            </div>
            <p className="fine-print">Alta, Média e Baixa continuam sendo os níveis funcionais. A proximidade é linguagem visual e nunca substitui o rótulo textual.</p>
          </ProductDetail>

          <ProductDetail
            icon={BellRing}
            name="Revela"
            descriptor="Boletim inteligente"
            statement="Todos os dias, o que merece atenção para a sua empresa."
          >
            <div className="revela-demo">
              <div className="bullet-card">
                <span className="reason-badge reason-mention">Menção direta</span>
                <strong>Empresa ou estabelecimento citado na publicação</strong>
                <p>Citação objetiva identificada, com destaque próprio no boletim.</p>
              </div>
              <div className="bullet-card">
                <span className="reason-badge reason-affinity">Alta afinidade</span>
                <strong>Publicação próxima ao seu perfil tributário</strong>
                <p>Selecionada pelo Sonar a partir dos sinais encontrados.</p>
              </div>
              <CheckLine text="O Revela reúne diariamente os itens prioritários desde o boletim anterior." />
              <CheckLine text="O motivo de inclusão fica visível e cada item leva à publicação no TriBusca." />
            </div>
          </ProductDetail>

          <ProductDetail
            icon={Sparkles}
            name="Decodifica"
            descriptor="Linguagem clara"
            statement="Entenda textos normativos complexos sem perder a referência oficial."
          >
            <div className="decodifica-demo">
              <div>
                <span className="micro-label">Estados do acionamento</span>
                <div className="decodifica-states">
                  <button className="demo-button" type="button">Decodificar (4 créditos)</button>
                  <button className="demo-button demo-button-muted" type="button" disabled>Traduzido</button>
                  <div className="obsolete-state">
                    <span>Tradução desatualizada</span>
                    <button className="demo-button" type="button">Decodificar (4 créditos)</button>
                  </div>
                </div>
              </div>
              <div className="credit-box">
                <div className="credit-heading">
                  <strong>1 crédito = até 25 mil caracteres</strong>
                  <span className="help-dot" title="Mínimo de 1 crédito. Cada nova faixa de até 25 mil caracteres adiciona 1 crédito." aria-label="Ajuda sobre cálculo de créditos">?</span>
                </div>
                <p>Mínimo de 1 crédito e arredondamento para cima por faixa adicional.</p>
                <p>Se a norma mudar, a nova tradução considera o conteúdo completo da versão vigente.</p>
              </div>
            </div>
            <p className="fine-print">O resultado é gerado sob demanda. O texto oficial permanece como referência e uma tradução anterior continua disponível, marcada como desatualizada quando a norma muda.</p>
          </ProductDetail>

          <ProductDetail
            icon={BookOpen}
            name="Acervo"
            descriptor="Base oficial organizada"
            statement="O lugar para consultar, pesquisar e navegar pelo histórico capturado pelo TriBusca."
          >
            <div className="bullet-panel">
              <CheckLine text="Busca é função do próprio Acervo." />
              <CheckLine text="Filtros por marcadores e metadados disponíveis." />
              <CheckLine text="Origem oficial, versões e histórico preservados." />
            </div>
          </ProductDetail>
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
        copy="Esta página será uma visão temática do Acervo: legislação, regulamentação, notas técnicas, publicações, vigências e faseamento — sempre ligados à fonte oficial."
      />

      <section className="section">
        <div className="container">
          <div className="data-card-grid">
            <DataCard icon={Landmark} title="Legislação" text="Leis, emendas e atos normativos relacionados à Reforma Tributária." />
            <DataCard icon={BookOpen} title="Regulamentação" text="Regulamentos e atos complementares organizados por tema." />
            <DataCard icon={FileSearch} title="Notas técnicas" text="Notas técnicas e documentos operacionais capturados nas fontes oficiais." />
            <DataCard icon={Search} title="Acervo da Reforma" text="Pesquisa e filtros dentro do recorte temático, sem duplicar o Acervo geral." />
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          <SectionHeading
            eyebrow="Linha do tempo"
            title="Publicação, vigência e faseamento não são a mesma coisa."
            copy="A timeline foi desenhada para deixar claro o que foi publicado, quando começa a produzir efeitos e como cada fase se encaixa no cronograma oficial."
          />
          <div className="timeline-card">
            <TimelineRow icon={FileSearch} type="Publicação" text="Entrada de uma nova norma, regulamentação ou nota técnica no Acervo." />
            <TimelineRow icon={CalendarClock} type="Vigência" text="Data em que uma regra começa a produzir efeitos, quando informada pela fonte oficial." />
            <TimelineRow icon={Layers3} type="Marco" text="Etapas de implementação e faseamento sustentadas por base normativa ou oficial." />
          </div>
          <div className="source-note">
            <ShieldCheck size={20} />
            <p>
              A estrutura visual já está preparada. Os eventos e datas reais só devem aparecer quando
              estiverem sustentados por publicação oficial integrada ao Acervo.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

function PageHero({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <section className="page-hero">
      <div className="container narrow">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
    </section>
  )
}

function ProductDetail({
  icon: Icon,
  name,
  descriptor,
  statement,
  children,
}: {
  icon: typeof RadioTower
  name: string
  descriptor: string
  statement: string
  children: React.ReactNode
}) {
  return (
    <article className="product-detail">
      <div className="product-copy">
        <div className="icon-box"><Icon size={24} /></div>
        <span className="status-chip">Em desenvolvimento</span>
        <h2>{name}</h2>
        <p className="feature-descriptor">{descriptor}</p>
        <p className="product-statement">{statement}</p>
      </div>
      <div className="product-content">{children}</div>
    </article>
  )
}

function SonarPreview() {
  return (
    <div className="sonar-preview-card">
      <div className="sonar-heading">
        <div>
          <span className="micro-label">Sonar</span>
          <strong>Afinidade Tributária</strong>
        </div>
        <span className="affinity affinity-high">Alta afinidade</span>
      </div>
      <SonarVisual level="high" />
      <div className="sonar-copy">
        <strong>Sinal próximo ao seu perfil tributário</strong>
        <p>Os marcadores explicam por que uma publicação foi aproximada do centro.</p>
      </div>
      <div className="signal-list">
        {['GO', 'ICMS', 'Fertilizantes', 'NCM'].map((signal) => <span key={signal}>{signal}</span>)}
      </div>
    </div>
  )
}

type SonarLevel = 'high' | 'medium' | 'low'

const sonarLevelText: Record<SonarLevel, string> = {
  high: 'Alta afinidade: sinal próximo ao centro',
  medium: 'Média afinidade: sinal em distância intermediária',
  low: 'Baixa afinidade: sinal distante do centro',
}

function SonarVisual({ compact = false, level = 'high' }: { compact?: boolean; level?: SonarLevel }) {
  return (
    <div
      className={`sonar sonar-${level}${compact ? ' sonar-compact' : ''}`}
      role="img"
      aria-label={`Representação visual de ${sonarLevelText[level]}`}
    >
      <div className="sonar-ring ring-1" />
      <div className="sonar-ring ring-2" />
      <div className="sonar-ring ring-3" />
      <div className="sonar-cross sonar-cross-x" />
      <div className="sonar-cross sonar-cross-y" />
      <div className="sonar-sweep" />
      <div className="sonar-center" />
      <div className="sonar-ping" />
    </div>
  )
}

function SonarState({
  level,
  label,
  description,
}: {
  level: SonarLevel
  label: string
  description: string
}) {
  return (
    <div className="sonar-state">
      <SonarVisual compact level={level} />
      <div>
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
    </div>
  )
}

function TrustItem({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return (
    <div className="trust-item">
      <Icon size={22} />
      <div><strong>{title}</strong><span>{text}</span></div>
    </div>
  )
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="section-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  )
}

function CheckLine({ text }: { text: string }) {
  return <div className="check-line"><span><Check size={16} /></span><p>{text}</p></div>
}

function DataCard({ icon: Icon, title, text }: { icon: typeof BookOpen; title: string; text: string }) {
  return (
    <article className="data-card">
      <div className="icon-box"><Icon size={23} /></div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  )
}

function TimelineRow({ icon: Icon, type, text }: { icon: typeof CalendarClock; type: string; text: string }) {
  return (
    <div className="timeline-row">
      <div className="timeline-icon"><Icon size={20} /></div>
      <div><strong>{type}</strong><p>{text}</p></div>
    </div>
  )
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-wrap">
        <img src="/brand/tribusca-icon.png" alt="TriBusca" className="footer-icon" />
        <p>Monitoramento e Inteligência Tributária · Brasil</p>
        <p className="footer-note">Produto em desenvolvimento.</p>
      </div>
    </footer>
  )
}

export default App
