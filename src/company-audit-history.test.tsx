import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import {render,screen,cleanup} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {CompanyAuditHistory} from './company-audit-history'
afterEach(cleanup)
const setup=(fetcher:(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>)=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}})
 render(<QueryClientProvider client={client}><CompanyAuditHistory apiFetch={fetcher} tenantId="tenant-synthetic" /></QueryClientProvider>)
}
it('uses server-proven states, does not call a missing lookup deletion',async()=>{
 const api=vi.fn(async()=>new Response(JSON.stringify({items:[
  {id:'a',action:'COMPANY_UPDATED',occurredAt:'2026-10-19T00:00:00Z',companyState:'PRESENT',companyName:'Nome atual sintético'},
  {id:'b',action:'COMPANY_PURGED',occurredAt:'2026-10-19T00:00:00Z',companyState:'DELETED',companyName:null},
  {id:'c',action:'COMPANY_UPDATED',occurredAt:'2026-10-19T00:00:00Z',companyState:'UNAVAILABLE',companyName:null}
 ]}),{status:200}))
 setup(api)
 expect(await screen.findByText('Nome atual sintético')).toBeInTheDocument()
 expect(screen.getByText('Empresa excluída')).toBeInTheDocument()
 expect(screen.getByText('Indisponível')).toBeInTheDocument()
})
it('shows unavailable on HTTP failure instead of company deleted',async()=>{
 setup(async()=>new Response(null,{status:503}))
 expect(await screen.findByText('Indisponível')).toBeInTheDocument()
 expect(screen.queryByText('Empresa excluída')).not.toBeInTheDocument()
})
