import {useState} from 'react'
import type {Establishment,ProductApiFetch} from './product-api'
export function correctionValues(unit:Establishment,legalName:string){return {legalName,businessLocationCode:unit.businessLocationCode,street:unit.street,streetNumber:unit.streetNumber,district:unit.district,complement:unit.complement,municipalityName:unit.municipalityName,municipalityIbgeCode:unit.municipalityIbgeCode,postalCode:unit.postalCode,uf:unit.uf}}
export function OnboardingCompanyData({unit,legalName,apiFetch,tenantId,companyId,locked,onSaved,onEditing}:{unit:Establishment;legalName:string;apiFetch:ProductApiFetch;tenantId:string;companyId:string;locked:boolean;onSaved:(name:string,unit:Establishment)=>void;onEditing:(editing:boolean)=>void}){
 const [editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [baseline,setBaseline]=useState(()=>correctionValues(unit,legalName)),[values,setValues]=useState(baseline)
 const begin=()=>{const v=correctionValues(unit,legalName);setBaseline(v);setValues(v);setEditing(true);onEditing(true);setError('')}
 const finish=()=>{setEditing(false);onEditing(false)}
 const save=async()=>{setBusy(true);setError('');try{
  const response=await apiFetch(`/api/v1/companies/${companyId}/establishments/${unit.id}/onboarding-data`,{method:'PATCH',headers:{'X-Tenant-Id':tenantId,'Content-Type':'application/json'},body:JSON.stringify({expected:baseline,values})});
  const result=await response.json();if(!response.ok)throw new Error(result.error);if(result.establishmentId!==unit.id)throw new Error('unexpected_unit');
  onSaved(result.legalName,{...unit,...result});finish()
 }catch(e){setError(e instanceof Error&&e.message==='registration_data_conflict'?'Os dados mudaram em outra tela. Feche e reabra para conferir antes de salvar.':'Não foi possível salvar a correção. Sua edição foi mantida.')}finally{setBusy(false)}}
 const input=(key:keyof typeof values,label:string,maxLength=200)=><label>{label}<input aria-label={label} maxLength={maxLength} value={values[key]??''} disabled={locked||busy} onChange={e=>setValues(v=>({...v,[key]:key==='legalName'?e.target.value:key==='uf'?e.target.value.toUpperCase():e.target.value||null}))}/></label>
 return <><div className="onb-company-grid" aria-label="Dados cadastrais">
  <div>{editing?input('legalName','Razão social'): <><span>Razão social</span><strong>{legalName}</strong></>}</div>
  <div><span>CNPJ</span><strong>{unit.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5')}</strong></div>
  <div>{editing?input('businessLocationCode','Local Negócio',80):<><span>Local Negócio</span><strong>{unit.businessLocationCode||'Não informado'}</strong></>}</div>
  <div><span>Unidade</span><strong>{unit.name}</strong></div>
  <div className="onb-address">{editing?<div className="onb-address-inputs">{input('street','Logradouro')}{input('streetNumber','Número',30)}{input('district','Bairro',160)}{input('complement','Complemento',160)}{input('municipalityName','Município',160)}{input('municipalityIbgeCode','Código IBGE',7)}{input('postalCode','CEP',8)}{input('uf','UF',2)}</div>:<><span>Endereço</span><strong>{[unit.street,unit.streetNumber,unit.complement,unit.district,unit.municipalityName,unit.uf,unit.postalCode].filter(Boolean).join(', ')||'Não informado'}</strong></>}</div>
  <div><span>Atividades desta unidade</span><strong>{unit.cnaes.length} CNAEs</strong></div>
  {editing&&<div className="onb-editor-actions onb-address"><button type="button" className="onb-primary" disabled={locked||busy||values.legalName.trim().length<2||!/^\d{8}$/.test(values.postalCode??'00000000')||!/^[A-Z]{2}$/.test(values.uf)} onClick={()=>void save()}>{busy?'Salvando…':'Salvar correção'}</button><button type="button" className="onb-secondary" disabled={busy} onClick={finish}>Cancelar correção</button></div>}
 </div>{!editing&&<button type="button" className="onb-link" disabled={locked} onClick={begin}>Corrigir algum dado</button>}{error&&<p role="alert">{error}</p>}</>
}
