import {useCallback,useEffect,useRef,useState} from 'react'
import type {ProductApiFetch} from './product-api'
export const NEW_VERSION_MESSAGE='Há uma versão nova do TriFaros. Recarregue a página para continuar.'
const buildId=import.meta.env.VITE_APP_BUILD_ID ?? 'development'
export function useBuildVersionGuard(raw:ProductApiFetch){
 const [newVersion,setNewVersion]=useState(false)
 const changed=useRef(false),inflight=useRef<Promise<boolean>|null>(null)
 const announce=useCallback(()=>{changed.current=true;setNewVersion(true)},[])
 const check=useCallback(async()=>{
  if(changed.current)return true
  if(inflight.current)return inflight.current
  inflight.current=(async()=>{try{
   const response=await fetch('/build-version.json?check='+Date.now(),{cache:'no-store',headers:{Accept:'application/json'}})
   if(response.ok){const current=await response.json();if(typeof current.id==='string'&&current.id!==buildId){announce();return true}}
  }catch{/* A failed version probe is not proof of a deployment. */}return false})()
  try{return await inflight.current}finally{inflight.current=null}
 },[announce])
 useEffect(()=>{void check();const timer=setInterval(()=>void check(),60000);const focus=()=>{if(document.visibilityState==='visible')void check()};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus)}},[check])
 const apiFetch=useCallback<ProductApiFetch>(async(input,init)=>{
  const method=(init?.method??'GET').toUpperCase()
  if(!['GET','HEAD','OPTIONS'].includes(method)&&await check())throw new Error('app_version_changed')
  const response=await raw(input,init)
  if(response.status===409){try{const body=await response.clone().json();if(body.error==='profile_version_conflict')announce()}catch{/* Preserve the original response. */}}
  return response
 },[raw,check,announce])
 return {apiFetch,newVersion}
}
export function BuildVersionNotice({visible}:{visible:boolean}){
 if(!visible)return null
 return <aside role="alert" className="tp-version-notice"><strong>{NEW_VERSION_MESSAGE}</strong><p>As edições não salvas continuam nesta aba. Copie-as antes de recarregar.</p><button type="button" onClick={()=>window.location.reload()}>Recarregar página</button></aside>
}
