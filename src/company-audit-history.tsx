import { useQuery } from '@tanstack/react-query'
import type { ProductApiFetch } from './product-api'

export type CompanyAuditItem={
 id:string;action:string;occurredAt:string;
 companyState:'PRESENT'|'DELETED'|'UNAVAILABLE';companyName:string|null
}
export function companyAuditLabel(item:CompanyAuditItem):string {
 if(item.companyState==='PRESENT' && item.companyName)return item.companyName
 return item.companyState==='DELETED'?'Empresa excluída':'Indisponível'
}
export function CompanyAuditHistory({apiFetch,tenantId}:{apiFetch:ProductApiFetch;tenantId:string}){
 const history=useQuery({
  queryKey:['company-audit-history',tenantId],
  queryFn:async()=>{
   const response=await apiFetch('/api/v1/company-audit-history',{headers:{'X-Tenant-Id':tenantId}})
   if(!response.ok)throw Error('audit_history_unavailable')
   const body=await response.json() as {items:CompanyAuditItem[]}
   return body.items
  },
 })
 return <section aria-label="Histórico de auditoria">
  <h3>Histórico de auditoria</h3>
  {history.isPending?<p>Carregando…</p>:history.isError?<p role="status">Indisponível</p>:
    !history.data?.length?<p>Nenhum evento registrado.</p>:
    <ul>{history.data.map(item=><li key={item.id}>
      <strong>{companyAuditLabel(item)}</strong>{' · '}
      {item.action==='COMPANY_PURGED'?'Exclusão definitiva':item.action==='COMPANY_CREATED'?'Cadastro':'Atualização'}
      {' · '}<time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString('pt-BR')}</time>
    </li>)}</ul>}
 </section>
}
