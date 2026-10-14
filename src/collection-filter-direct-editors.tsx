import { useMemo, useState, type FormEvent } from 'react'
import { CircleHelp, Plus, Trash2 } from 'lucide-react'
import type { ProductApiFetch } from './product-api'
import type {
  CollectionFilterRule, CollectionFilterAlias, CollectionFilterTerm,
  CollectionFilterMode, CollectionFilterStrength, CollectionFilterNewType,
  CollectionFilterDirectRuleInput,
} from './collection-filter-api'
import { FilterGrid } from './collection-filter-grid'
import { FilterDialog, rememberDialogTrigger } from './collection-filter-dialog'
import {
  excludedFilterSources, RULE_HEADERS, TERM_HEADERS,
  downloadFilterCsv, normalizeFilterText, filterRuleKey, filterTermKey,
} from './collection-filter-csv'

export const FILTER_MODES: Record<CollectionFilterMode,string> = {
  KEEP_ALWAYS:'Manter sempre',
  KEEP_IF_TAX_TERM:'Manter só se tiver termo tributário',
  EXCLUDE_UNLESS_STRONG:'Excluir, salvo termo forte',
  EXCLUDE_ALWAYS:'Excluir sempre',
}
const STRENGTHS: Record<CollectionFilterStrength,string> =
  {STRONG:'Forte',WEAK:'Fraco',NEGATIVE:'Negativo'}
export interface FilterOrigins {
  sources:Array<{code:string;name:string}>
  rules:CollectionFilterRule[]
  allTypes:string[]
  actNames?:Array<{name:string;sourceCode:string;section:string;count:number}>
}
const unique=(arr:string[])=>[...new Set(arr.filter(Boolean))]
  .sort((a,b)=>a.localeCompare(b,'pt-BR'))
const reason=(error:unknown)=>error instanceof Error?error.message:'Não foi possível alterar a política ativa.'

function useTypes(_apiFetch:ProductApiFetch,origins:FilterOrigins,source:string) {
  return {
    types:unique([...origins.rules.filter(x=>!source||x.sourceCode===source).map(x=>x.actName??x.canonicalType),
      ...(origins.actNames??[]).filter(x=>!source||x.sourceCode===source).map(x=>x.name)]),
    error:origins.actNames===undefined,
  }
}
function SourceSelect({origins,value,onChange,label,optional=false}:{
  origins:FilterOrigins;value:string;onChange:(s:string)=>void;label:string;optional?:boolean
}) {
  return <select aria-label={label} value={value} required={!optional}
    onChange={e=>onChange(e.target.value)}>
    <option value="">{optional?'Todas as fontes':'Selecione a fonte'}</option>
    {origins.sources.filter(x=>!excludedFilterSources.has(x.code))
      .map(x=><option key={x.code} value={x.code}>{x.name}</option>)}
  </select>
}
function TypeSelect({types,value,onChange,label,optional=false}:{
  types:string[];value:string;onChange:(v:string)=>void;label:string;optional?:boolean
}) {
  return <select aria-label={label} required={!optional} value={value}
    onChange={e=>onChange(e.target.value)}>
    <option value="">{optional?'Todos os nomes':'Selecione o Nome do ato'}</option>
    {unique([...types,value]).map(v=><option value={v} key={v}>{v}</option>)}
  </select>
}

interface EditorProps {
  apiFetch:ProductApiFetch;origins:FilterOrigins
  rules:CollectionFilterRule[];aliases:CollectionFilterAlias[];terms:CollectionFilterTerm[]
  busy:boolean
  onKeep:(rule:CollectionFilterRule)=>Promise<void>
  onConfirm:(rule:CollectionFilterDirectRuleInput)=>void
  onRemoveRule:(rule:CollectionFilterRule)=>Promise<void>
  onAlias:(action:'ALIAS_PUT'|'ALIAS_DELETE',alias:CollectionFilterAlias)=>Promise<void>
  onTerm:(term:CollectionFilterTerm,old?:CollectionFilterTerm)=>Promise<void>
  onRemoveTerm:(term:CollectionFilterTerm)=>Promise<void>
}

export function TypesEditor(p:EditorProps) {
  const {rules,aliases,origins,apiFetch,busy}=p
  const [source,setSource]=useState('')
  const [section,setSection]=useState('')
  const [type,setType]=useState('')
  const [mode,setMode]=useState<CollectionFilterMode>('KEEP_ALWAYS')
  const [alias,setAlias]=useState('')
  const [error,setError]=useState('')
  const {types,error:originError}=useTypes(apiFetch,origins,source)
  const rows=useMemo(()=>rules.map((rule,index)=>({rule,index})),[rules])
  const onError=(e:unknown)=>setError(reason(e))
  const saveRule=async(rule:CollectionFilterRule)=>{
    setError('')
    try {
      if(!['dou','doe-sp'].includes(rule.sourceCode.toLowerCase())&&rule.mode!=='KEEP_ALWAYS') {
        setError('Para alterar uma regra que pode descartar publicações de outra fonte, é necessária a prévia dessa fonte.')
        return
      }
      if(rule.mode==='KEEP_ALWAYS') await p.onKeep(rule)
      else p.onConfirm(rule)
    } catch(e){onError(e)}
  }
  const add=async(e:FormEvent)=>{
    e.preventDefault()
    const rule:CollectionFilterRule={
      sourceCode:source,section,canonicalType:normalizeFilterText(type),mode,helpText:null}
    if(!source||!section.trim()||!type||excludedFilterSources.has(source))return
    if(rules.some(x=>filterRuleKey(x)===filterRuleKey(rule))) {
      setError('Esta regra já existe. Edite o modo na tabela.')
      return
    }
    await saveRule(rule)
    if(mode==='KEEP_ALWAYS')setType('')
  }
  return <section className="cf-card">
    <div className="cf-card-title"><div><h2>Nomes de ato</h2>
      <p>Fonte, seção e Nome do ato definem a regra. Adicione, edite o modo ou filtre por coluna; alterações são gravadas na política ativa.</p>
    </div></div>
    <form className="cf-inline-form" onSubmit={e=>{void add(e)}}>
      <SourceSelect origins={origins} label="Fonte do tipo" value={source}
        onChange={v=>{setSource(v);setType('')}}/>
      <input aria-label="Seção do tipo" placeholder="Seção" value={section}
        onChange={e=>setSection(e.target.value)}/>
      <TypeSelect types={types} value={type} label="Nome do ato" onChange={setType}/>
      <select aria-label="Modo do tipo" value={mode}
        onChange={e=>setMode(e.target.value as CollectionFilterMode)}>
        {Object.entries(FILTER_MODES).map(([v,l])=><option key={v} value={v}>{l}</option>)}
      </select>
      <button type="submit" disabled={busy||!source||!section.trim()||!type||
        excludedFilterSources.has(source)}><Plus size={15}/> Adicionar</button>
    </form>
    {error&&<p className="cf-error" role="alert">{error}</p>}
    {originError&&<p className="cf-origin-note">Acervo indisponível para atualização dos tipos; exibindo os dados cadastrados.</p>}
    <FilterGrid title="Nomes de ato" rows={rows} columns={[
      {key:'source',label:'Fonte',value:r=>r.rule.sourceCode},
      {key:'section',label:'Seção',value:r=>r.rule.section},
      {key:'type',label:'Nome do ato',value:r=>r.rule.actName??r.rule.canonicalType},
      {key:'mode',label:'Modo',value:r=>FILTER_MODES[r.rule.mode],
        render:r=><select aria-label={`Modo ${r.rule.canonicalType}`} value={r.rule.mode}
          disabled={busy} onChange={e=>{void saveRule({...r.rule,mode:e.target.value as CollectionFilterMode})}}>
          {Object.entries(FILTER_MODES).map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>},
    ]} actions={r=><button className="cf-icon-button" type="button"
      aria-label={`Remover ${r.rule.canonicalType}`} disabled={busy}
      onClick={()=>{setError('');void p.onRemoveRule(r.rule).catch(onError)}}>
      <Trash2 size={15}/>
    </button>} onExport={items=>downloadFilterCsv('tipos-coleta.csv',RULE_HEADERS,
      items.map(({rule:r})=>[r.sourceCode,r.section,r.canonicalType,r.mode,r.helpText||'']))}/>
    <details className="cf-aliases"><summary>Variações de grafia ({aliases.length})</summary>
      <form className="cf-inline-form" onSubmit={e=>{
        e.preventDefault()
        if(!alias.trim()||!type||!source||!section.trim())return
        void p.onAlias('ALIAS_PUT',{sourceCode:source,section,alias:normalizeFilterText(alias),
          canonicalType:type}).then(()=>setAlias('')).catch(onError)
      }}>
        <SourceSelect origins={origins} value={source} label="Fonte do alias" onChange={v=>{setSource(v);setType('')}}/>
        <input aria-label="Seção do alias" value={section} onChange={e=>setSection(e.target.value)}/>
        <input aria-label="Grafia encontrada" placeholder="Grafia encontrada" value={alias} onChange={e=>setAlias(e.target.value)}/>
        <TypeSelect types={types} value={type} label="Nome do ato do alias" onChange={setType}/>
        <button type="submit" disabled={busy||!alias.trim()||!type||!source||!section.trim()}>Adicionar alias</button>
      </form>
      <div className="cf-chip-list">{aliases.map((a,i)=><span className="cf-chip" key={i}>
        {a.actName??a.alias} → {a.targetActName??a.canonicalType}
        <button type="button" aria-label={`Remover alias ${a.alias}`}
          onClick={()=>{void p.onAlias('ALIAS_DELETE',a).catch(onError)}}>×</button>
      </span>)}</div>
    </details>
  </section>
}

export function TermForm({apiFetch,origins,initial,submitLabel='Adicionar',onSubmit}:{
  apiFetch:ProductApiFetch;origins:FilterOrigins;initial?:Partial<CollectionFilterTerm>;
  submitLabel?:string;onSubmit:(term:CollectionFilterTerm)=>Promise<boolean|void>
}) {
  const [text,setText]=useState(initial?.text??'')
  const [strength,setStrength]=useState<CollectionFilterStrength>(initial?.strength??'WEAK')
  const [source,setSource]=useState(initial?.sourceCode??'')
  const [type,setType]=useState(initial?.canonicalType??'')
  const [working,setWorking]=useState(false)
  const {types,error}=useTypes(apiFetch,origins,source)
  return <><form className="cf-inline-form cf-term-form" onSubmit={async e=>{
    e.preventDefault();if(!text.trim()||excludedFilterSources.has(source)||working)return
    setWorking(true)
    try {
      const result=await onSubmit({
        ...initial,text:text.trim(),strength,sourceCode:source||null,
        canonicalType:type||null,locationScope:initial?.locationScope||'ANY',
      })
      if(result!==false)setText('')
    } finally{setWorking(false)}
  }}>
    <input required aria-label="Texto do termo" placeholder="Termo" value={text}
      onChange={e=>setText(e.target.value)}/>
    <select aria-label="Força do termo" value={strength}
      onChange={e=>setStrength(e.target.value as CollectionFilterStrength)}>
      {Object.entries(STRENGTHS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
    </select>
    <SourceSelect origins={origins} optional label="Fonte do termo" value={source}
      onChange={v=>{setSource(v);setType('')}}/>
    <TypeSelect optional types={types} label="Nome do ato do termo" value={type} onChange={setType}/>
    <button type="submit" disabled={working||excludedFilterSources.has(source)}>{submitLabel}</button>
  </form>{error&&<p className="cf-origin-note">Exibindo tipos cadastrados; atualização do acervo indisponível.</p>}</>
}

export function TermsEditor(p:EditorProps) {
  const {terms,origins}=p
  const [editing,setEditing]=useState<number|null>(null)
  const [error,setError]=useState('')
  const onError=(e:unknown)=>setError(reason(e))
  const rows=useMemo(()=>terms.map((term,index)=>({term,index})),[terms])
  const add=async(term:CollectionFilterTerm)=>{
    setError('')
    if(terms.some(t=>filterTermKey(t)===filterTermKey(term))) {
      setError('Este termo já existe neste escopo. Use Editar na tabela.')
      return false
    }
    try{await p.onTerm(term);return true}catch(e){onError(e);return false}
  }
  return <section className="cf-card">
    <div className="cf-card-title"><div><h2>Termos tributários</h2>
      <p>Forte preserva, fraco soma evidência e negativo neutraliza termos fracos próximos. Os termos são independentes da Taxonomia.</p>
    </div></div>
    <TermForm apiFetch={p.apiFetch} origins={origins} onSubmit={add}/>
    {error&&<p className="cf-error" role="alert">{error}</p>}
    <FilterGrid title="Termos tributários" rows={rows} columns={[
      {key:'text',label:'Termo',value:r=>r.term.text},
      {key:'strength',label:'Força',value:r=>STRENGTHS[r.term.strength]},
      {key:'source',label:'Fonte',value:r=>r.term.sourceCode||'Todas as fontes'},
      {key:'section',label:'Seção',value:r=>r.term.section||'Todas'},
      {key:'type',label:'Nome do ato',value:r=>(r.term.actName??r.term.canonicalType)||'Todos os nomes'},
      {key:'location',label:'Local',value:r=>r.term.locationScope||'ANY'},
    ]} actions={r=><div className="cf-row-actions">
      <button type="button" aria-label={`Editar termo ${r.term.text}`} onClick={()=>{
        rememberDialogTrigger();setEditing(r.index);setError('')}}>Editar</button>
      <button type="button" className="cf-icon-button"
        aria-label={`Remover termo ${r.term.text}`}
        onClick={()=>{void p.onRemoveTerm(r.term).catch(onError)}}>
        <Trash2 size={15}/>
      </button>
    </div>} onExport={items=>downloadFilterCsv('termos-coleta.csv',TERM_HEADERS,
      items.map(({term:t})=>[t.text,t.strength,t.sourceCode||'',t.section||'',
        t.canonicalType||'',t.locationScope||'ANY']))}/>
    <p className="cf-warning">CNPJ, processo e valor isolados não preservam um ato. Alterações são gravadas diretamente na política ativa.</p>
    {editing!==null&&terms[editing]&&<FilterDialog title="Editar termo"
      description="A alteração será gravada diretamente na política ativa."
      onClose={()=>setEditing(null)}>
      <TermForm apiFetch={p.apiFetch} origins={origins} initial={terms[editing]}
        submitLabel="Aplicar alteração" onSubmit={async term=>{
          if(terms.some((t,i)=>i!==editing&&filterTermKey(t)===filterTermKey(term))) {
            setError('Termo duplicado neste escopo.');return false
          }
          try{await p.onTerm(term,terms[editing]);setEditing(null);return true}
          catch(e){onError(e);return false}
        }}/>
      {error&&<p className="cf-error" role="alert">{error}</p>}
    </FilterDialog>}
  </section>
}

export function NewTypeActions({item,origins,mergeRules,apiFetch,onClassify,onMerge,onTerm,pending,error}:{
  item:CollectionFilterNewType;origins:FilterOrigins;mergeRules:CollectionFilterRule[];
  apiFetch:ProductApiFetch;onClassify:(type:string)=>void;
  onMerge:(type:string)=>Promise<void>;onTerm:(term:CollectionFilterTerm)=>Promise<void>;
  pending:boolean;error:string|null
}) {
  const [action,setAction]=useState<'help'|'classify'|'merge'|'term'|null>(null)
  const [canonical,setCanonical]=useState(item.act_name||item.sample_raw_type||item.normalized_type)
  const targets=unique(mergeRules.filter(r=>r.sourceCode===item.source_code&&
    r.section===item.section&&r.canonicalType!==item.normalized_type).map(r=>r.canonicalType))
  const open=(v:typeof action)=>{
    rememberDialogTrigger();setCanonical(v==='merge'?'':item.act_name||item.sample_raw_type||item.normalized_type);setAction(v)
  }
  const descriptions={
    help:'Entenda as ações disponíveis para este novo tipo.',
    classify:'O Nome do ato vem do backend. A próxima janela solicita prévia antes de salvar sem excluir.',
    merge:'Registra a correspondência com um tipo já configurado nesta fonte e seção diretamente na política ativa.',
    term:'Adiciona uma palavra ou expressão diretamente à política ativa.',
  }
  return <><div className="cf-row-actions">
    <button type="button" onClick={()=>open('classify')}>Classificar</button>
    <button type="button" className="is-secondary-quiet" onClick={()=>open('merge')}>Mesclar</button>
    <button type="button" className="is-secondary-quiet" onClick={()=>open('term')}>Criar termo</button>
    <button type="button" className="is-secondary-quiet"
      aria-label={`Ajuda das ações de ${item.sample_raw_type}`}
      onClick={()=>open('help')}><CircleHelp size={17}/> Ajuda</button>
  </div>
  {action&&<FilterDialog title={{
    help:'Ajuda: ações de novos tipos',classify:'Classificar novo Nome do ato',
    merge:'Mesclar novo tipo',term:'Criar termo tributário',
  }[action]} description={descriptions[action]} onClose={()=>setAction(null)}>
    {action==='help'?<dl className="cf-action-help">
      <dt>Classificar</dt><dd>Configura a regra na política ativa; se descartar, exige prévia e confirmação em lotes.</dd>
      <dt>Mesclar</dt><dd>Associa a grafia ao Nome do ato de destino na política ativa.</dd>
      <dt>Criar termo</dt><dd>Salva um termo tributário na política ativa, sem encerrar a classificação do novo tipo.</dd>
    </dl>:action==='term'?<TermForm apiFetch={apiFetch} origins={origins}
      initial={{sourceCode:item.source_code,canonicalType:item.normalized_type}}
      submitLabel="Adicionar termo" onSubmit={async t=>{
        try{await onTerm(t);setAction(null);return true}catch{return false}
      }}/>:<form className="cf-modal-form" onSubmit={async e=>{
      e.preventDefault()
      if(!canonical||pending)return
      if(action==='classify'){setAction(null);onClassify(canonical);return}
      try{await onMerge(canonical);setAction(null)}catch{/* parent displays error */}
    }}>
      <p><strong>{item.sample_raw_type}</strong> · {item.source_code} · {item.section}</p>
      <label>Nome do ato
        {action==='merge'?<TypeSelect types={targets}
          value={canonical} label={'Nome do ato para '+item.sample_raw_type}
          onChange={setCanonical}/>:<input type="text" maxLength={300}
          aria-label={'Nome do ato para '+item.sample_raw_type}
          value={canonical} onChange={e=>setCanonical(e.target.value)}/>}
      </label>
      {action==='merge'&&!targets.length&&<p>Cadastre primeiro um tipo de destino para esta fonte e seção.</p>}
      {error&&<p className="cf-error" role="alert">{error}</p>}
      <div className="cf-row-actions"><button type="button"
        onClick={()=>setAction(null)}>Cancelar</button>
        <button type="submit" disabled={pending||!canonical||
          (action==='merge'&&!targets.length)}>
          {pending?'Registrando…':'Confirmar '+(action==='merge'?'mesclagem':'classificação')}
        </button>
      </div>
    </form>}
  </FilterDialog>}
  </>
}
