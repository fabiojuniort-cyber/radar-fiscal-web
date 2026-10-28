import type {Establishment} from './product-api'
export type IeDraft={baseline:string|null;value:string;source:string|null}
export function ieStatus(unit:Pick<Establishment,'stateRegistrationSource'|'stateRegistrationLookupStatus'>){
 return unit.stateRegistrationSource==='MANUAL'?'Informada manualmente, sem confirmação da SEFAZ':unit.stateRegistrationLookupStatus==='SUCCESS'?'Confirmada pela consulta estadual':unit.stateRegistrationLookupStatus==='NOT_FOUND'?'IE não localizada':unit.stateRegistrationLookupStatus==='NOT_SUPPORTED'?'Consulta estadual ainda não disponível para esta UF':'Consulta estadual indisponível'
}
export function OnboardingIeEditor({unit,draft,locked,onChange,onReset}:{unit:Establishment;draft:IeDraft;locked:boolean;onChange:(value:string)=>void;onReset:()=>void}){
 const dirty=(draft.value.trim()||null)!==draft.baseline
 return <fieldset disabled={locked}><legend>{unit.name} — {unit.uf}</legend><label>Inscrição Estadual — {unit.name}<input aria-label={'Inscrição Estadual — '+unit.name} maxLength={30} value={draft.value} onChange={e=>onChange(e.target.value)}/></label><p>{ieStatus({...unit,stateRegistrationSource:draft.source})}. A IE editada será salva como manual ao continuar.</p>{dirty&&<button type="button" onClick={onReset}>Descartar edição da IE</button>}</fieldset>
}
