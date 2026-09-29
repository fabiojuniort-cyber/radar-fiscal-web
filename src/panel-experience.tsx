import {
  Building2,
  CalendarDays,
  ChevronDown,
  Landmark,
  LogOut,
  Search,
  Settings,
} from 'lucide-react'
import { FormEvent, type ReactNode, useState } from 'react'

import './panel-experience.css'

export type PanelMode = 'authenticated' | 'demo'

type PanelScreen =
  | 'inicio'
  | 'publicacoes'
  | 'acervo'
  | 'reforma'
  | 'central'
  | 'fontes'
  | 'empresas'
  | 'config'
  | 'assinatura'

type OrganizationTab = 'empresas' | 'estabelecimentos' | 'perfil'

export interface PanelMembership {
  tenantId: string
  tenantName: string
  role: string
}

export interface PanelIdentity {
  name: string
  email?: string
  memberships?: PanelMembership[]
}

interface PanelExperienceProps {
  mode: PanelMode
  identity: PanelIdentity
  onExit: () => void | Promise<void>
  exitError?: string | null
}

const tabs: Array<{ key: PanelScreen; label: string }> = [
  { key: 'inicio', label: 'Início' },
  { key: 'publicacoes', label: 'Publicações' },
  { key: 'acervo', label: 'Acervo' },
  { key: 'reforma', label: 'Reforma Tributária' },
  { key: 'central', label: 'Central de Monitoramento' },
  { key: 'fontes', label: 'Fontes Oficiais' },
  { key: 'empresas', label: 'Empresas' },
]

const metricLabels = [
  'Fontes previstas',
  'Fontes consultadas',
  'Fontes com erro',
  'Publicações capturadas',
  'Potencialmente relevantes',
  'Pendentes de análise',
]

const demoPublications = [
  {
    level: 'alta',
    levelLabel: 'Alta afinidade',
    orgao: 'CONFAZ',
    date: '25/09',
    ref: 'Convênio ICMS nº 26/2026',
    title: 'Altera o Convênio ICMS 100/97, que reduz a base de cálculo do ICMS nas saídas dos insumos agropecuários.',
    signal: 'Produto: fertilizantes · Operação: saída interestadual · Tributo: ICMS',
    tags: 'Matriz · Rio Verde/GO · Alta',
  },
  {
    level: 'alta',
    levelLabel: 'Alta afinidade',
    orgao: 'Governo de Goiás',
    date: '24/09',
    ref: 'Decreto nº 10.412/2026',
    title: 'Altera o Regulamento do ICMS de Goiás para conceder crédito outorgado nas saídas internas de fertilizantes.',
    signal: 'UF: GO · Produto: fertilizantes · Atividade: industrialização',
    tags: 'Matriz · Rio Verde/GO · Alta',
  },
  {
    level: 'media',
    levelLabel: 'Média afinidade',
    orgao: 'Portal Nacional NF-e',
    date: '22/09',
    ref: 'Nota Técnica 2026.003',
    title: 'Atualiza as regras de validação dos grupos de IBS, CBS e IS na NF-e e na NFC-e.',
    signal: 'Documento fiscal: NF-e · Reforma: IBS/CBS',
    tags: 'Todos os estabelecimentos · Média',
  },
]

const demoMentions = [
  {
    orgao: 'SEFAZ-MT',
    date: '26/09',
    ref: 'Portaria SEFAZ nº 1.187/2026',
    title: 'Credencia contribuintes ao regime especial de recolhimento do ICMS nas operações com insumos agropecuários.',
    detail: 'CNPJ exato do estabelecimento citado no Anexo Único.',
  },
]

const demoVigencias = [
  { day: '01/10', year: '2026', ref: 'Convênio ICMS nº 26/2026', rel: 'em 3 dias' },
  { day: '01/10', year: '2026', ref: 'Decreto nº 10.412/2026', rel: 'em 3 dias' },
  { day: '03/11', year: '2026', ref: 'Nota Técnica 2026.003', rel: 'em 36 dias' },
  { day: '01/01', year: '2027', ref: 'IN RFB nº 2.301/2026', rel: 'em 95 dias' },
]

const demoSources = [
  { name: 'DOU', state: 'ok', label: 'Coleta concluída', when: 'Concluída às 07:42' },
  { name: 'DOE-SP', state: 'ok', label: 'Coleta concluída', when: 'Concluída às 07:18' },
  { name: 'DOE-GO', state: 'none', label: 'Concluída, sem publicações hoje', when: 'Concluída às 07:05' },
  { name: 'DOE-MT', state: 'down', label: 'Fonte indisponível', when: 'Última tentativa às 07:30' },
  { name: 'CONFAZ', state: 'partial', label: 'Sucesso parcial', when: 'Concluída às 06:55' },
  { name: 'Portal NF-e', state: 'ok', label: 'Coleta concluída', when: 'Concluída às 06:40' },
]

const officialSources = [
  ['DOU', 'Federal', 'Atos federais · Seções 1 e 2'],
  ['Receita Federal · Normas', 'Federal', 'Instruções normativas e soluções de consulta'],
  ['CONFAZ', 'Nacional', 'Convênios, ajustes e protocolos ICMS'],
  ['Portal NF-e / ENCAT', 'Nacional', 'Notas técnicas NF-e/NFC-e'],
  ['SPED', 'Federal', 'Publicações e documentação dos projetos SPED'],
  ['DOE-SP', 'Estadual · SP', 'Atos da SEFAZ-SP e do Executivo'],
  ['DOE-GO', 'Estadual · GO', 'Atos da SEFAZ-GO e do Executivo'],
  ['DOE-MT', 'Estadual · MT', 'Atos da SEFAZ-MT e do Executivo'],
]

const reformPhases = [
  ['2023', 'Emenda constitucional', 'Concluído', 'A Reforma Tributária do consumo é aprovada e cria IBS, CBS e Imposto Seletivo.'],
  ['2025', 'Regulamentação', 'Concluído', 'A legislação complementar define as regras estruturais dos novos tributos e da transição.'],
  ['2026', 'Ano de teste', 'Em andamento', 'Documentos fiscais e sistemas entram na etapa de adaptação e validação operacional de IBS/CBS.'],
  ['2027', 'CBS integral e início do IS', 'Próximo marco', 'A transição avança com a CBS e os marcos legais previstos para 2027.'],
  ['2029–2032', 'Transição do ICMS e do ISS', 'Previsto em lei', 'Redução gradual de ICMS/ISS e crescimento correspondente do IBS.'],
  ['2033', 'Modelo integral', 'Previsto em lei', 'Conclusão da transição para o novo modelo de tributação do consumo.'],
]

const todayLabel = () => {
  const value = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function initials(name: string) {
  const values = name.trim().split(/\s+/).filter(Boolean)
  if (values.length === 0) return 'TB'
  if (values.length === 1) return values[0].slice(0, 2).toUpperCase()
  return `${values[0][0]}${values[values.length - 1][0]}`.toUpperCase()
}

function firstName(name: string) {
  const clean = name.trim()
  if (!clean) return 'você'
  if (clean.includes('@')) return clean.split('@')[0] || 'você'
  return clean.split(/\s+/)[0] || 'você'
}

function SectionHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) {
  return <div className="tp-section-heading">
    {eyebrow && <span className="tp-eyebrow">{eyebrow}</span>}
    <h1>{title}</h1>
    <p>{description}</p>
  </div>
}

function EmptyRealData({ children }: { children?: ReactNode }) {
  return <div className="tp-empty-state">
    <span className="tp-empty-mark">—</span>
    <div>
      <strong>Integração em implantação</strong>
      <p>{children ?? 'Esta superfície já segue o novo layout, mas ainda não consulta dados privados sem contrato de API aprovado.'}</p>
    </div>
  </div>
}

function AffinityMark({ level }: { level: 'alta' | 'media' | 'baixa' }) {
  return <span className={`tp-affinity tp-affinity-${level}`} aria-hidden="true"><span /><i /></span>
}

function PublicationList({ demo, compact = false }: { demo: boolean; compact?: boolean }) {
  if (!demo) return <EmptyRealData>As publicações privadas serão exibidas aqui quando o contrato autenticado correspondente estiver disponível.</EmptyRealData>
  return <div className="tp-list-card">
    {demoPublications.map((publication) => <button className="tp-publication-row" type="button" key={publication.ref}>
      <AffinityMark level={publication.level as 'alta' | 'media' | 'baixa'} />
      <span className="tp-publication-copy">
        <span className="tp-publication-meta"><b className={`tp-level-${publication.level}`}>{publication.levelLabel}</b><span>{publication.orgao} · {publication.date}</span></span>
        <strong>{publication.ref}{compact ? '' : `: ${publication.title}`}</strong>
        {!compact && <><span className="tp-publication-title">{publication.title}</span><span className="tp-publication-signal">Sinal encontrado: {publication.signal}</span></>}
        <span className="tp-publication-tags">{publication.tags}</span>
      </span>
    </button>)}
  </div>
}

export function PanelExperience({ mode, identity, onExit, exitError }: PanelExperienceProps) {
  const demo = mode === 'demo'
  const [screen, setScreen] = useState<PanelScreen>('inicio')
  const [query, setQuery] = useState('')
  const [companyMenu, setCompanyMenu] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [orgTab, setOrgTab] = useState<OrganizationTab>('empresas')

  const membership = identity.memberships?.[0]
  const tenantName = demo ? 'Cerrado Insumos Agrícolas S.A.' : membership?.tenantName ?? 'Conta TriBusca'
  const tenantRole = demo ? 'Administradora da conta' : membership?.role ?? 'Usuário'
  const displayName = demo ? 'Ana Ribeiro' : identity.name || identity.email || 'Usuário TriBusca'
  const displayEmail = demo ? 'ana.ribeiro@empresa.com.br' : identity.email ?? '—'
  const establishment = demo ? 'Matriz · Rio Verde/GO' : 'Estabelecimento não selecionado'
  const metricValue = demo ? '—' : '—'

  const navScreen = screen === 'config' || screen === 'assinatura' ? null : screen

  const go = (next: PanelScreen) => {
    setScreen(next)
    setCompanyMenu(false)
    setUserMenu(false)
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    setScreen('acervo')
  }

  return <div className="tp-app" data-panel-mode={mode}>
    <header className="tp-header">
      <div className="tp-header-primary">
        <img src="/brand/tribusca-logo-horizontal-light.png" alt="TriBusca" className="tp-logo" />

        <div className="tp-pop-wrap">
          <button className="tp-company-button" type="button" aria-expanded={companyMenu} onClick={() => { setCompanyMenu((value) => !value); setUserMenu(false) }}>
            <span className="tp-company-copy"><small>{demo ? 'Empresa em demonstração' : 'Conta em análise'}</small><strong>{tenantName}</strong><span>{establishment}</span></span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          {companyMenu && <div className="tp-popover tp-company-popover">
            <span className="tp-pop-label">{demo ? 'Estabelecimento em análise' : 'Acesso autenticado'}</span>
            {demo ? <>
              <button type="button" className="is-selected"><b>Matriz · Rio Verde/GO</b><span>12.345.678/0001-95</span></button>
              <button type="button"><b>Filial · Rondonópolis/MT</b><span>12.345.678/0002-76</span></button>
              <button type="button"><b>Filial · São Paulo/SP</b><span>12.345.678/0003-57</span></button>
            </> : <button type="button" className="is-selected"><b>{tenantName}</b><span>{tenantRole}</span></button>}
          </div>}
        </div>

        <form className="tp-global-search" onSubmit={submitSearch}>
          <Search size={17} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no Acervo: título, número, órgão" aria-label="Buscar no Acervo" />
        </form>

        <span className="tp-account-pill">{demo ? 'Teste grátis · 5 dias restantes' : 'Conta autenticada'}</span>
        {demo && <span className="tp-demo-pill">Modo demonstração</span>}

        <div className="tp-pop-wrap tp-user-wrap">
          <button className="tp-user-button" type="button" aria-label="Menu do usuário" aria-expanded={userMenu} onClick={() => { setUserMenu((value) => !value); setCompanyMenu(false) }}>
            <span>{initials(displayName)}</span><ChevronDown size={14} aria-hidden="true" />
          </button>
          {userMenu && <div className="tp-popover tp-user-popover">
            <div className="tp-user-summary"><strong>{displayName}</strong><span>{displayEmail}</span><small>{tenantRole}</small></div>
            <div className="tp-credit-summary"><small>Créditos Decodifica</small><span><b>{demo ? '12' : '—'}</b> disponíveis</span><em>{demo ? 'Renovam em 01/10/2026, sem acumular.' : 'Saldo será exibido quando houver contrato aprovado.'}</em></div>
            <div className="tp-subscription-summary"><span><small>Assinatura</small><b>{demo ? 'Teste grátis' : '—'}</b></span><button type="button" onClick={() => go('assinatura')}>{demo ? 'Ver plano' : 'Abrir'}</button></div>
            <div className="tp-user-actions">
              <button type="button" onClick={() => go('assinatura')}><CalendarDays size={16} /> Assinatura e pagamento</button>
              <button type="button" onClick={() => go('config')}><Settings size={16} /> Configurações</button>
              <button type="button" onClick={() => void onExit()}><LogOut size={16} /> {demo ? 'Sair da demonstração' : 'Sair'}</button>
            </div>
          </div>}
        </div>
      </div>

      <nav className="tp-tabs" aria-label={demo ? 'Navegação do painel demonstrativo' : 'Navegação do painel'}>
        {tabs.map((tab) => <button key={tab.key} type="button" aria-current={navScreen === tab.key ? 'page' : undefined} onClick={() => go(tab.key)}>{tab.label}</button>)}
      </nav>
    </header>

    {demo && <div className="tp-demo-notice">Dados exibidos nesta área são demonstrativos.</div>}
    {exitError && <div className="tp-error-banner" role="alert">{exitError}</div>}

    <main className={`tp-main tp-main-${screen}`}>
      {screen === 'inicio' && <>
        <div className="tp-welcome-row">
          <div><span>{demo ? 'Segunda-feira, 28 de setembro de 2026' : todayLabel()}</span><h1>Bom dia, {firstName(displayName)}.</h1><p>{demo ? 'O Sonar encontrou sinais relevantes para o perfil selecionado. Veja o que merece atenção agora.' : 'Seu painel autenticado já usa o novo formato do TriBusca. Dados privados aparecem apenas quando houver integração aprovada para cada módulo.'}</p></div>
        </div>

        <form className="tp-search-hero" onSubmit={submitSearch}>
          <span className="tp-hero-label">Acervo · Busca</span>
          <div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: crédito outorgado fertilizantes GO" aria-label="Consulta rápida no Acervo" /><button type="submit">Buscar</button></div>
          <div className="tp-quick-searches">{['ICMS', 'IBS/CBS', 'NF-e', 'Agronegócio'].map((item) => <button type="button" key={item} onClick={() => { setQuery(item); setScreen('acervo') }}>{item}</button>)}</div>
        </form>

        <section className="tp-metrics" aria-label={demo ? 'Indicadores demonstrativos' : 'Indicadores do painel'}>
          {metricLabels.map((label) => <article key={label}><span>{label}</span><strong>{metricValue}</strong><small>{demo ? 'Demonstração' : 'Aguardando integração'}</small></article>)}
        </section>

        <div className="tp-home-grid">
          <div className="tp-home-primary">
            {demo && <section className="tp-direct-mention">
              <div><strong>Menções diretas</strong><span>CNPJ exato citado em publicação oficial</span></div>
              {demoMentions.map((mention) => <button type="button" key={mention.ref}><small>{mention.orgao} · {mention.date}</small><strong>{mention.ref}: {mention.title}</strong><span>{mention.detail}</span></button>)}
            </section>}
            <section className="tp-panel-card">
              <div className="tp-card-head"><span><b>Alta afinidade</b><small>Sonar · Inteligência TriBusca · {establishment}</small></span><button type="button" onClick={() => go('publicacoes')}>Ver todas →</button></div>
              <PublicationList demo={demo} compact />
            </section>
          </div>

          <aside className="tp-home-rail">
            <section className="tp-panel-card tp-rail-card">
              <div className="tp-card-head"><span><b>Revela · boletim de hoje</b><small>{demo ? '28/09/2026 · enviado às 08h · 3 itens' : 'Boletim autenticado'}</small></span></div>
              {demo ? <div className="tp-rail-list">
                <button type="button"><em className="tp-level-alta">MENÇÃO DIRETA</em><b>Portaria SEFAZ nº 1.187/2026</b><span>Filial · Rondonópolis/MT</span></button>
                <button type="button"><em className="tp-level-alta">ALTA AFINIDADE</em><b>Convênio ICMS nº 26/2026</b><span>Matriz · Rio Verde/GO</span></button>
                <button type="button"><em className="tp-level-alta">ALTA AFINIDADE</em><b>Decreto nº 10.412/2026</b><span>Matriz · Rio Verde/GO</span></button>
              </div> : <EmptyRealData />}
              <p className="tp-card-footnote">Média afinidade não entra no boletim.</p>
            </section>

            <section className="tp-panel-card tp-rail-card">
              <div className="tp-card-head"><span><b>Próximas vigências</b><small>Datas extraídas do texto oficial</small></span></div>
              {demo ? <div className="tp-vigencias">{demoVigencias.map((vigencia) => <button type="button" key={vigencia.ref}><span><b>{vigencia.day}</b><small>{vigencia.year}</small></span><i><strong>{vigencia.ref}</strong><small>Início de vigência · {vigencia.rel}</small></i></button>)}</div> : <EmptyRealData />}
            </section>

            <section className="tp-panel-card tp-rail-card">
              <div className="tp-card-head"><span><b>Saúde das fontes</b><small>Central de Monitoramento · hoje</small></span><button type="button" onClick={() => go('central')}>Abrir →</button></div>
              {demo ? <SourceHealth compact /> : <EmptyRealData>O status operacional das fontes privadas não é simulado no painel autenticado.</EmptyRealData>}
              <p className="tp-card-footnote">Falha de fonte não significa ausência de publicações.</p>
            </section>
          </aside>
        </div>
      </>}

      {screen === 'publicacoes' && <>
        <SectionHeading eyebrow="Sonar · Inteligência TriBusca" title="Publicações" description="Acompanhe publicações e sinais de afinidade por estabelecimento." />
        <div className="tp-filterbar"><button className="is-active" type="button">Todas</button><button type="button">Alta afinidade</button><button type="button">Média afinidade</button><button type="button">Menção direta</button><span>{demo ? '3 resultados demonstrativos' : '— resultados'}</span></div>
        <PublicationList demo={demo} />
      </>}

      {screen === 'acervo' && <>
        <SectionHeading eyebrow="Base oficial organizada" title="Acervo" description="Busque por título, número, órgão, tema ou referência oficial." />
        <form className="tp-acervo-search" onSubmit={submitSearch}><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Título, número, órgão ou assunto" aria-label="Pesquisar no Acervo" /><button type="submit">Buscar</button></form>
        <div className="tp-acervo-layout"><aside className="tp-filter-panel"><b>Filtros</b><label>Esfera<select defaultValue="todas"><option value="todas">Todas</option><option>Federal</option><option>Estadual</option></select></label><label>Tributo<select defaultValue="todos"><option value="todos">Todos</option><option>ICMS</option><option>IBS/CBS</option></select></label><label>Tipo de ato<select defaultValue="todos"><option value="todos">Todos</option><option>Convênio</option><option>Decreto</option><option>Nota Técnica</option></select></label></aside><section>{demo ? <PublicationList demo /> : <EmptyRealData>O Acervo autenticado será preenchido pela API do produto quando o contrato correspondente estiver liberado.</EmptyRealData>}</section></div>
      </>}

      {screen === 'reforma' && <>
        <SectionHeading eyebrow="Linha do tempo" title="Reforma Tributária" description="Marcos legais e operacionais organizados por fase." />
        <div className="tp-reform-timeline">{reformPhases.map(([period, title, status, description], index) => <article key={period} className={index === 2 ? 'is-current' : ''}><div className="tp-timeline-marker"><span /><i /></div><div className="tp-timeline-card"><header><span><small>{period}</small><strong>{title}</strong></span><em>{status}</em></header><p>{description}</p>{index === 2 && <div className="tp-timeline-docs"><span>Resolução CGIBS nº 6/2026</span><span>Nota Técnica 2026.003</span><span>IN RFB nº 2.301/2026</span></div>}</div></article>)}</div>
      </>}

      {screen === 'central' && <>
        <SectionHeading eyebrow="Saúde operacional" title="Central de Monitoramento" description="Diferencie fonte consultada sem resultado de fonte indisponível, falha de coleta ou processamento." />
        {demo ? <div className="tp-monitor-grid"><div className="tp-monitor-summary"><article><span>Fontes monitoradas</span><strong>8</strong></article><article><span>Concluídas</span><strong>5</strong></article><article><span>Com atenção</span><strong>2</strong></article><article><span>Não consultadas</span><strong>1</strong></article></div><SourceHealth /></div> : <EmptyRealData>O monitoramento real não é inferido pelo frontend. Quando a API autenticada existir, esta tela receberá os estados de coleta diretamente do backend.</EmptyRealData>}
      </>}

      {screen === 'fontes' && <>
        <SectionHeading eyebrow="Cobertura legislativa" title="Fontes Oficiais" description="Catálogo das fontes acompanhadas pelo TriBusca e da abrangência prevista." />
        <div className="tp-source-catalog">{officialSources.map(([name, sphere, scope]) => <article key={name}><span className="tp-source-icon"><Landmark size={18} /></span><div><strong>{name}</strong><span>{sphere}</span><p>{scope}</p></div><em>{demo ? (name === 'SPED' ? 'Em implantação' : 'Em produção') : 'Configuração do produto'}</em></article>)}</div>
      </>}

      {screen === 'empresas' && <>
        <SectionHeading eyebrow="Organização" title="Empresas" description="Estrutura empresarial e contexto usado pelo Perfil Tributário." />
        <div className="tp-org-tabs" role="tablist" aria-label="Organização"><button role="tab" aria-selected={orgTab === 'empresas'} onClick={() => setOrgTab('empresas')} type="button">Empresas</button><button role="tab" aria-selected={orgTab === 'estabelecimentos'} onClick={() => setOrgTab('estabelecimentos')} type="button">Estabelecimentos</button><button role="tab" aria-selected={orgTab === 'perfil'} onClick={() => setOrgTab('perfil')} type="button">Perfil Tributário</button></div>
        {orgTab === 'empresas' && <div className="tp-company-cards">{demo ? <article className="is-primary"><div><Building2 size={22} /><span><strong>Cerrado Insumos Agrícolas S.A.</strong><small>12.345.678/0001-95 · Lucro Real</small></span></div><dl><div><dt>Estabelecimentos</dt><dd>3</dd></div><div><dt>Perfil tributário</dt><dd>Parcial</dd></div></dl><button type="button" onClick={() => setOrgTab('estabelecimentos')}>Abrir empresa →</button></article> : <article className="is-primary"><div><Building2 size={22} /><span><strong>{tenantName}</strong><small>{tenantRole}</small></span></div><dl><div><dt>CNPJ</dt><dd>—</dd></div><div><dt>Estabelecimentos</dt><dd>—</dd></div></dl><button type="button" onClick={() => setOrgTab('estabelecimentos')}>Abrir empresa →</button></article>}</div>}
        {orgTab === 'estabelecimentos' && (demo ? <div className="tp-establishment-table"><div className="tp-table-head"><span>Unidade</span><span>CNPJ</span><span>UF</span><span>Perfil</span></div>{[['Matriz · Rio Verde','12.345.678/0001-95','GO','Parcial'],['Filial · Rondonópolis','12.345.678/0002-76','MT','Completo'],['Filial · São Paulo','12.345.678/0003-57','SP','Não iniciado']].map((row) => <div className="tp-table-row" key={row[1]}>{row.map((item) => <span key={item}>{item}</span>)}</div>)}</div> : <EmptyRealData>Estabelecimentos reais não são inventados a partir do tenant. Eles aparecerão quando houver API aprovada.</EmptyRealData>)}
        {orgTab === 'perfil' && <div className="tp-profile-grid">{['Regime tributário','Segmento','Tributos','Atividades','Produtos','Operações','Documentos fiscais','Obrigações acessórias'].map((item) => <article key={item}><span>{item}</span><strong>{demo ? (item === 'Regime tributário' ? 'Lucro Real' : 'Configurado') : '—'}</strong><small>{demo ? 'Dados demonstrativos' : 'Aguardando integração'}</small></article>)}</div>}
      </>}

      {screen === 'config' && <>
        <SectionHeading eyebrow="Conta" title="Configurações" description="Preferências de conta, usuários e comunicações." />
        <div className="tp-settings-grid"><section className="tp-panel-card"><div className="tp-card-head"><span><b>Conta</b><small>Identificação principal</small></span></div><div className="tp-settings-body"><label>Nome do usuário<strong>{displayName}</strong></label><label>E-mail<strong>{displayEmail}</strong></label><label>Conta<strong>{tenantName}</strong></label><label>Papel<strong>{tenantRole}</strong></label></div></section><section className="tp-panel-card"><div className="tp-card-head"><span><b>Comunicações</b><small>Revela e alertas</small></span></div><div className="tp-settings-body"><label>Boletim Revela<strong>{demo ? 'Ativo · 08h' : '—'}</strong></label><label>Alertas operacionais<strong>{demo ? 'Ativos' : '—'}</strong></label><p>{demo ? 'Preferências demonstrativas.' : 'Preferências reais não são alteradas sem endpoint aprovado.'}</p></div></section></div>
      </>}

      {screen === 'assinatura' && <>
        <SectionHeading eyebrow="Conta" title="Assinatura e pagamento" description="Plano, forma de pagamento, faturas e créditos extras da conta." />
        <div className="tp-warning-note">Planos, preços e quantidades de créditos permanecem sem definição comercial final nesta interface.</div>
        <div className="tp-plan-card"><div><small>Plano atual</small><strong>{demo ? 'Teste grátis' : '—'}</strong><span>{demo ? '5 dias restantes · sem cartão' : 'Dados de assinatura ainda não integrados.'}</span></div><button type="button">{demo ? 'Conhecer planos' : 'Em desenvolvimento'}</button></div>
        <div className="tp-settings-grid"><section className="tp-panel-card"><div className="tp-card-head"><span><b>Forma de pagamento</b><small>Conta</small></span></div><div className="tp-settings-body"><p>{demo ? 'Nenhuma forma de pagamento cadastrada. O teste não exige cartão.' : '—'}</p></div></section><section className="tp-panel-card"><div className="tp-card-head"><span><b>Faturas</b><small>Histórico</small></span></div><div className="tp-settings-body"><p>Nenhuma fatura ainda.</p></div></section></div>
      </>}
    </main>
  </div>
}

function SourceHealth({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? 'tp-source-health is-compact' : 'tp-source-health'}>
    {demoSources.map((source) => <div className={`tp-source-health-row is-${source.state}`} key={source.name}>
      <span className="tp-source-dot" /><strong>{source.name}</strong><span><b>{source.label}</b><small>{source.when}</small></span>{!compact && <em>{source.state === 'down' ? 'Atenção' : source.state === 'partial' ? 'Parcial' : 'Operacional'}</em>}
    </div>)}
  </div>
}