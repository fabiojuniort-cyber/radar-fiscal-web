import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleHelp, Plus, Trash2 } from 'lucide-react'
import { fetchCatalogNavigation } from './catalog-api'
import type { ProductApiFetch } from './product-api'
import type { CollectionFilterDocument, CollectionFilterRule, CollectionFilterTerm, CollectionFilterMode, CollectionFilterStrength, CollectionFilterNewType } from './collection-filter-api'
import { FilterGrid } from './collection-filter-grid'
import { FilterDialog, rememberDialogTrigger } from './collection-filter-dialog'
import { excludedFilterSources, RULE_HEADERS, TERM_HEADERS, normalizeFilterText, decodeFilterCsv, downloadFilterCsv, mergeFilterRows, filterRuleKey, filterTermKey } from './collection-filter-csv'

type Draft = Omit<CollectionFilterDocument, 'id' | 'version' | 'revision' | 'status'>
type SetDraft = Dispatch<SetStateAction<Draft>>
export const FILTER_MODES: Record<CollectionFilterMode,string> = { KEEP_ALWAYS: 'Manter sempre', KEEP_IF_TAX_TERM: 'Manter só se tiver termo tributário', EXCLUDE_UNLESS_STRONG: 'Excluir, salvo termo forte', EXCLUDE_ALWAYS: 'Excluir sempre' }
const STRENGTHS: Record<CollectionFilterStrength,string> = { STRONG:'Forte', WEAK:'Fraco', NEGATIVE:'Negativo' }
export interface FilterOrigins { sources: Array<{ code: string; name: string }>; rules: CollectionFilterRule[]; allTypes: string[] }
type EditorProps = { draft: Draft; setDraft: SetDraft; origins: FilterOrigins; apiFetch: ProductApiFetch }
const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a,b) => a.localeCompare(b,'pt-BR'))
function useTypes(apiFetch: ProductApiFetch, origins: FilterOrigins, source: string) {
  const query = useQuery({ queryKey:['collection-filter','origin-types',source], queryFn:() => fetchCatalogNavigation(apiFetch, { groupBy:'actType', ...(source ? { source } : {}) }), retry:false, staleTime:30000, refetchInterval:60000 })
  return { types: unique([...origins.rules.filter(r => !source || r.sourceCode === source).map(r => r.canonicalType), ...(!source ? origins.allTypes : []), ...(query.data?.items ?? []).map(i => normalizeFilterText(i.value))]), error:query.isError }
}
function SourceSelect({ origins, value, onChange, label, optional=false }: { origins:FilterOrigins; value:string; onChange:(value:string)=>void; label:string; optional?:boolean }) {
  return <select aria-label={label} value={value} onChange={e=>onChange(e.target.value)} required={!optional}><option value="">{optional ? 'Todas as fontes' : 'Selecione a fonte'}</option>{origins.sources.map(s=><option key={s.code} value={s.code} disabled={excludedFilterSources.has(s.code)}>{s.name} ({s.code}){excludedFilterSources.has(s.code) ? ' — fora do escopo do filtro' : ''}</option>)}{value && !origins.sources.some(s=>s.code===value) && <option value={value}>{value}</option>}</select>
}
function TypeSelect({ types, value, onChange, label, optional=false }: { types:string[]; value:string; onChange:(value:string)=>void; label:string; optional?:boolean }) {
  return <select aria-label={label} value={value} onChange={e=>onChange(e.target.value)} required={!optional}><option value="">{optional ? 'Todos os tipos' : 'Selecione o tipo'}</option>{unique([...types, value]).map(t=><option key={t} value={t}>{t}</option>)}</select>
}

function ImportDialog({ kind, draft, setDraft, origins, apiFetch, onClose }: { kind:'rules'|'terms'; draft:Draft; setDraft:SetDraft; origins:FilterOrigins; apiFetch:ProductApiFetch; onClose:()=>void }) {
  const queryClient = useQueryClient()
  const [result,setResult] = useState<ReturnType<typeof decodeFilterCsv> | null>(null)
  const [error,setError] = useState(''); const [reading,setReading] = useState(false)
  const load = async (file:File) => {
    setError('');setResult(null);setReading(true)
    try {
      if(file.size > 2*1024*1024) throw new Error('Arquivo excede o limite de 2 MB.')
      if(!/\.csv$/i.test(file.name)) throw new Error('Selecione um arquivo CSV.')
      const text = await file.text()
      const navigation = await Promise.all(origins.sources.map(async source => {
        try { const data = await queryClient.fetchQuery({ queryKey:['collection-filter','origin-types',source.code], queryFn:()=>fetchCatalogNavigation(apiFetch,{groupBy:'actType',source:source.code}), staleTime:30000 }); return [source.code,(data.items ?? []).map(i=>normalizeFilterText(i.value))] as const }
        catch { return [source.code,[] as string[]] as const }
      }))
      const liveTypes = new Map(navigation)
      setResult(decodeFilterCsv(kind,text,origins.sources.map(s=>s.code),source=>unique([...origins.rules.filter(r=>!source || r.sourceCode===source).map(r=>r.canonicalType),...(source ? liveTypes.get(source) ?? [] : origins.allTypes)])))
    } catch(e) { setError(e instanceof Error ? e.message : 'Não foi possível ler o CSV.') } finally { setReading(false) }
  }
  const incoming = kind==='rules' ? result?.rules : result?.terms
  const replacements = result ? (kind==='rules' ? result.rules.filter(r=>draft.rules.some(old=>filterRuleKey(old)===filterRuleKey(r))).length : result.terms.filter(t=>draft.terms.some(old=>filterTermKey(old)===filterTermKey(t))).length) : 0
  return <FilterDialog title="Importar CSV" description="Use o arquivo exportado como modelo. A importação atualiza somente o rascunho local; salvar, simular e aprovar continuam necessários." onClose={onClose}>
    <input type="file" accept=".csv,text/csv" aria-label="Arquivo CSV" disabled={reading} onChange={e=>{const file=e.target.files?.[0]; if(file) void load(file)}} />
    {reading && <p role="status">Lendo arquivo…</p>}{error && <p className="cf-error" role="alert">{error}</p>}
    {incoming && <><p role="status">{incoming.length} registros válidos: {replacements} substituições e {incoming.length-replacements} inclusões. Registros ausentes do CSV serão preservados.</p><div className="cf-import-preview"><table aria-label="Prévia da importação"><thead><tr><th>Fonte</th><th>Tipo / termo</th></tr></thead><tbody>{incoming.slice(0,10).map((r,i)=><tr key={i}><td>{r.sourceCode || 'Todas'}</td><td>{'text' in r ? r.text : r.canonicalType}</td></tr>)}</tbody></table></div></>}
    <div className="cf-row-actions"><button type="button" onClick={onClose}>Cancelar</button><button type="button" disabled={!result || reading} onClick={()=>{if(!result)return;setDraft(current=>({...current,...(kind==='rules' ? {rules:mergeFilterRows(current.rules,result.rules,filterRuleKey)} : {terms:mergeFilterRows(current.terms,result.terms,filterTermKey)})}));onClose()}}>Aplicar ao rascunho</button></div>
  </FilterDialog>
}

export function TypesEditor({ draft,setDraft,origins,apiFetch }:EditorProps) {
  const [source,setSource] = useState(()=>origins.sources.some(s=>s.code==='dou')?'dou':origins.sources[0]?.code ?? '');const [section,setSection]=useState('DO1');const [type,setType]=useState('');const [mode,setMode]=useState<CollectionFilterMode>('KEEP_ALWAYS');const [alias,setAlias]=useState('');const [importing,setImporting]=useState(false);const [error,setError]=useState('')
  const {types,error:originError}=useTypes(apiFetch,origins,source)
  const add=(e:FormEvent)=>{e.preventDefault();setError('');if(!source||!type)return;const rule={sourceCode:source,section,canonicalType:type,mode,helpText:null};if(draft.rules.some(r=>filterRuleKey(r)===filterRuleKey(rule))){setError('Esta regra já existe. Edite o modo na tabela.');return}setDraft(c=>({...c,rules:[...c.rules,rule]}));setType('')}
  const rows=useMemo(()=>draft.rules.map((rule,index)=>({rule,index})),[draft.rules])
  return <section className="cf-card"><div className="cf-card-title"><div><h2>Tipos de ato</h2><p>Fonte, seção e tipo definem a regra. Edite o modo, filtre por coluna ou importe um CSV para o rascunho.</p></div></div>
    <form className="cf-inline-form" onSubmit={add}><SourceSelect origins={origins} value={source} label="Fonte do tipo" onChange={v=>{setSource(v);setType('')}}/><input aria-label="Seção do tipo" value={section} onChange={e=>setSection(e.target.value)} placeholder="Seção"/><TypeSelect types={types} value={type} label="Tipo canônico" onChange={setType}/><select aria-label="Modo do tipo" value={mode} onChange={e=>setMode(e.target.value as CollectionFilterMode)}>{Object.entries(FILTER_MODES).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button type="submit" disabled={!source||!type}><Plus size={15}/> Adicionar</button></form>
    {error && <p className="cf-error" role="alert">{error}</p>}{originError && <p className="cf-origin-note">Acervo indisponível para atualização dos tipos; exibindo os dados cadastrados na política e na fila.</p>}
    <FilterGrid title="Tipos de ato" rows={rows} columns={[
      {key:'source',label:'Fonte',value:r=>r.rule.sourceCode},{key:'section',label:'Seção',value:r=>r.rule.section},{key:'type',label:'Tipo',value:r=>r.rule.canonicalType},
      {key:'mode',label:'Modo',value:r=>FILTER_MODES[r.rule.mode],render:r=><select aria-label={`Modo ${r.rule.canonicalType}`} value={r.rule.mode} onChange={e=>setDraft(c=>({...c,rules:c.rules.map((rule,i)=>i===r.index?{...rule,mode:e.target.value as CollectionFilterMode}:rule)}))}>{Object.entries(FILTER_MODES).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>}
    ]} actions={r=><button type="button" className="cf-icon-button" aria-label={`Remover ${r.rule.canonicalType}`} onClick={()=>setDraft(c=>({...c,rules:c.rules.filter((_,i)=>i!==r.index)}))}><Trash2 size={15}/></button>} onExport={values=>downloadFilterCsv('tipos-coleta.csv',RULE_HEADERS,values.map(({rule:r})=>[r.sourceCode,r.section,r.canonicalType,r.mode,r.helpText||'']))} onImport={()=>setImporting(true)}/>
    <details className="cf-aliases"><summary>Variações de grafia ({draft.aliases.length})</summary><form className="cf-inline-form" onSubmit={e=>{e.preventDefault();if(!alias.trim()||!type)return;setDraft(c=>({...c,aliases:[...c.aliases,{sourceCode:source,section,alias:alias.trim(),canonicalType:type}]}));setAlias('')}}><SourceSelect origins={origins} value={source} label="Fonte do alias" onChange={v=>{setSource(v);setType('')}}/><input aria-label="Seção do alias" value={section} onChange={e=>setSection(e.target.value)}/><input aria-label="Grafia encontrada" placeholder="Grafia encontrada" value={alias} onChange={e=>setAlias(e.target.value)}/><TypeSelect types={types} value={type} label="Tipo canônico do alias" onChange={setType}/><button type="submit" disabled={!source||!type||!alias.trim()}>Adicionar alias</button></form><div className="cf-chip-list">{draft.aliases.map((a,i)=><span className="cf-chip" key={i}>{a.alias} → {a.canonicalType}<button type="button" aria-label={`Remover alias ${a.alias}`} onClick={()=>setDraft(c=>({...c,aliases:c.aliases.filter((_,n)=>n!==i)}))}>×</button></span>)}</div></details>
    {importing && <ImportDialog kind="rules" draft={draft} setDraft={setDraft} origins={origins} apiFetch={apiFetch} onClose={()=>setImporting(false)}/>}
  </section>
}

export function TermForm({apiFetch,origins,initial,submitLabel='Adicionar',onSubmit}:{apiFetch:ProductApiFetch;origins:FilterOrigins;initial?:Partial<CollectionFilterTerm>;submitLabel?:string;onSubmit:(term:CollectionFilterTerm)=>boolean|void}) {
  const [text,setText]=useState(initial?.text||'');const [strength,setStrength]=useState<CollectionFilterStrength>(initial?.strength||'WEAK');const [source,setSource]=useState(initial?.sourceCode||'');const [type,setType]=useState(initial?.canonicalType||'')
  const {types,error}=useTypes(apiFetch,origins,source)
  return <><form className="cf-inline-form cf-term-form" onSubmit={e=>{e.preventDefault();if(!text.trim())return;const accepted=onSubmit({...initial,text:text.trim(),strength,sourceCode:source||null,canonicalType:type||null,locationScope:initial?.locationScope||'ANY'});if(accepted!==false)setText('')}}><input required aria-label="Texto do termo" placeholder="Termo" value={text} onChange={e=>setText(e.target.value)}/><select aria-label="Força do termo" value={strength} onChange={e=>setStrength(e.target.value as CollectionFilterStrength)}>{Object.entries(STRENGTHS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><SourceSelect optional origins={origins} label="Fonte do termo" value={source} onChange={v=>{setSource(v);setType('')}}/><TypeSelect optional types={types} label="Tipo do termo" value={type} onChange={setType}/><button type="submit">{submitLabel}</button></form>{error && <p className="cf-origin-note">Exibindo os tipos cadastrados; atualização do Acervo indisponível.</p>}</>
}

export function TermsEditor(props:EditorProps) {
  const {draft,setDraft,origins}=props;const [importing,setImporting]=useState(false);const [editing,setEditing]=useState<number|null>(null);const [error,setError]=useState('')
  const add=(term:CollectionFilterTerm)=>{setError('');if(draft.terms.some(t=>filterTermKey(t)===filterTermKey(term))){setError('Este termo já existe neste escopo. Use Editar na tabela.');return false}setDraft(c=>({...c,terms:[...c.terms,term]}))}
  const rows=useMemo(()=>draft.terms.map((term,index)=>({term,index})),[draft.terms])
  return <section className="cf-card"><div className="cf-card-title"><div><h2>Termos tributários</h2><p>Forte preserva, fraco soma evidência e negativo neutraliza termos fracos próximos. Os termos são independentes da Taxonomia.</p></div></div><TermForm {...props} onSubmit={add}/>{error && <p className="cf-error" role="alert">{error}</p>}
    <FilterGrid title="Termos tributários" rows={rows} columns={[{key:'text',label:'Termo',value:r=>r.term.text},{key:'strength',label:'Força',value:r=>STRENGTHS[r.term.strength]},{key:'source',label:'Fonte',value:r=>r.term.sourceCode||'Todas as fontes'},{key:'section',label:'Seção',value:r=>r.term.section||'Todas'},{key:'type',label:'Tipo',value:r=>r.term.canonicalType||'Todos os tipos'},{key:'location',label:'Local',value:r=>r.term.locationScope||'ANY'}]} actions={r=><div className="cf-row-actions"><button type="button" aria-label={`Editar termo ${r.term.text}`} onClick={()=>{rememberDialogTrigger();setEditing(r.index);setError('')}}>Editar</button><button type="button" className="cf-icon-button" aria-label={`Remover termo ${r.term.text}`} onClick={()=>setDraft(c=>({...c,terms:c.terms.filter((_,i)=>i!==r.index)}))}><Trash2 size={15}/></button></div>} onExport={values=>downloadFilterCsv('termos-coleta.csv',TERM_HEADERS,values.map(({term:t})=>[t.text,t.strength,t.sourceCode||'',t.section||'',t.canonicalType||'',t.locationScope||'ANY']))} onImport={()=>setImporting(true)}/>
    <p className="cf-warning">CNPJ, processo e valor isolados não preservam um ato. Salvar o rascunho valida os termos; a política só muda após simulação e aprovação.</p>
    {importing && <ImportDialog kind="terms" draft={draft} setDraft={setDraft} origins={origins} apiFetch={props.apiFetch} onClose={()=>setImporting(false)}/>}
    {editing!==null && draft.terms[editing] && <FilterDialog title="Editar termo" description="A alteração permanece no rascunho até salvar, simular e aprovar." onClose={()=>setEditing(null)}><TermForm {...props} initial={draft.terms[editing]} submitLabel="Aplicar alteração" onSubmit={term=>{if(draft.terms.some((t,i)=>i!==editing && filterTermKey(t)===filterTermKey(term))){setError('Termo duplicado neste escopo.');return false}setDraft(c=>({...c,terms:c.terms.map((t,i)=>i===editing?term:t)}));setEditing(null)}}/>{error && <p className="cf-error" role="alert">{error}</p>}</FilterDialog>}
  </section>
}

export function NewTypeActions({ item, origins, mergeRules, apiFetch, onResolve, onTerm, pending, error }: { item:CollectionFilterNewType;origins:FilterOrigins;mergeRules:CollectionFilterRule[];apiFetch:ProductApiFetch;onResolve:(status:'RESOLVED'|'MERGED',type:string)=>Promise<void>;onTerm:(term:CollectionFilterTerm)=>void;pending:boolean;error:string|null }) {
  const [action,setAction]=useState<'help'|'classify'|'merge'|'term'|null>(null);const [canonical,setCanonical]=useState(item.normalized_type)
  const targets=unique(mergeRules.filter(r=>r.sourceCode===item.source_code && r.section===item.section && r.canonicalType!==item.normalized_type).map(r=>r.canonicalType))
  const open=(value:typeof action)=>{rememberDialogTrigger();setCanonical(value==='merge'?'':item.normalized_type);setAction(value)}
  const descriptions={help:'Entenda as ações disponíveis para este novo tipo.',classify:'Registra o nome canônico e conclui a revisão na fila. Para mudar a coleta, configure sua regra em Tipos, salve o rascunho, simule e aprove.',merge:'Registra a correspondência com um tipo já configurado nesta fonte e seção. Para aplicar a equivalência no filtro, cadastre também a variação de grafia no rascunho e aprove após simular.',term:'Adiciona uma palavra ou expressão ao rascunho, com a fonte e o tipo deste item. A política ativa continua igual até salvar, simular e aprovar.'}
  return <><div className="cf-row-actions"><button type="button" onClick={()=>open('classify')}>Classificar</button><button type="button" className="is-secondary-quiet" onClick={()=>open('merge')}>Mesclar</button><button type="button" className="is-secondary-quiet" onClick={()=>open('term')}>Criar termo</button><button type="button" className="is-secondary-quiet" aria-label={`Ajuda das ações de ${item.sample_raw_type}`} onClick={()=>open('help')}><CircleHelp size={17}/> Ajuda</button></div>
    {action && <FilterDialog title={{help:'Ajuda: ações de novos tipos',classify:'Classificar novo tipo',merge:'Mesclar novo tipo',term:'Criar termo tributário'}[action]} description={descriptions[action]} onClose={()=>setAction(null)}>
      {action==='help'?<dl className="cf-action-help"><dt>Classificar</dt><dd>Marca o item como revisado e registra seu nome canônico. Não publica uma regra de coleta.</dd><dt>Mesclar</dt><dd>Associa o registro da fila a um tipo existente da mesma fonte e seção. A equivalência de grafia no filtro precisa ser configurada em Tipos.</dd><dt>Criar termo</dt><dd>Abre o cadastro de um termo forte, fraco ou negativo no rascunho. Não encerra a revisão do tipo e não aprova a política.</dd></dl>:action==='term'?<TermForm apiFetch={apiFetch} origins={origins} initial={{sourceCode:item.source_code,canonicalType:item.normalized_type}} submitLabel="Adicionar ao rascunho" onSubmit={t=>{onTerm(t);setAction(null)}}/>:<form className="cf-modal-form" onSubmit={async e=>{e.preventDefault();if(!canonical || pending)return;try {await onResolve(action==='merge'?'MERGED':'RESOLVED',canonical);setAction(null)}catch{/* parent mutation displays error */}}}><p><strong>{item.sample_raw_type}</strong> · {item.source_code} · {item.section}</p><label>Tipo canônico<TypeSelect types={action==='merge'?targets:[item.normalized_type]} value={canonical} label={`Tipo canônico para ${item.sample_raw_type}`} onChange={setCanonical}/></label>{action==='merge' && !targets.length && <p>Cadastre primeiro um tipo de destino para esta fonte e seção.</p>}{error && <p className="cf-error" role="alert">{error}</p>}<div className="cf-row-actions"><button type="button" onClick={()=>setAction(null)}>Cancelar</button><button type="submit" disabled={pending||!canonical}>{pending?'Registrando…':'Confirmar '+(action==='merge'?'mesclagem':'classificação')}</button></div></form>}
    </FilterDialog>}
  </>
}
