import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {BuildVersionNotice,NEW_VERSION_MESSAGE,useBuildVersionGuard} from './build-version'
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
function Host({raw}:{raw:typeof fetch}){
 const {apiFetch,newVersion}=useBuildVersionGuard(raw)
 return <><BuildVersionNotice visible={newVersion}/><input aria-label="Rascunho" defaultValue="Escolha não salva"/><button onClick={()=>void apiFetch('/profile',{method:'PUT'}).catch(()=>{})}>Salvar</button></>
}
it('a new build warns without reloading or losing the draft and blocks writes',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:'new-deployment'})))
 const raw=vi.fn(async()=>Response.json({ok:true}))
 render(<Host raw={raw}/>)
 expect(await screen.findByRole('alert')).toHaveTextContent(NEW_VERSION_MESSAGE)
 expect(screen.getByLabelText('Rascunho')).toHaveValue('Escolha não salva')
 fireEvent.click(screen.getByRole('button',{name:'Salvar'}));await waitFor(()=>expect(raw).not.toHaveBeenCalled())
})
it('a profile version conflict warns without exposing the API code or retrying',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:import.meta.env.VITE_APP_BUILD_ID??'development'})))
 const raw=vi.fn(async()=>Response.json({error:'profile_version_conflict'},{status:409}))
 render(<Host raw={raw}/>)
 fireEvent.click(screen.getByRole('button',{name:'Salvar'}))
 expect(await screen.findByRole('alert')).toHaveTextContent(NEW_VERSION_MESSAGE)
 expect(screen.queryByText('profile_version_conflict')).not.toBeInTheDocument()
 expect(raw).toHaveBeenCalledTimes(1)
 expect(screen.getByLabelText('Rascunho')).toHaveValue('Escolha não salva')
})
