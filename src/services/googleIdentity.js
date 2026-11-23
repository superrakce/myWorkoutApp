import { accountSession } from './accountSession.js'
export const BASIC_SCOPE='openid email profile'
export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.appdata'
export const GOOGLE_CLIENT_ID=import.meta.env.VITE_GOOGLE_CLIENT_ID||''
let scriptPromise
export function loadGoogleIdentity(){
  if(globalThis.google?.accounts?.oauth2)return Promise.resolve()
  if(scriptPromise)return scriptPromise
  scriptPromise=new Promise((resolve,reject)=>{
    const existing=document.getElementById('google-identity-script')
    if(existing)existing.remove()
    const script=document.createElement('script')
    script.id='google-identity-script';script.src='https://accounts.google.com/gsi/client';script.async=true
    const timer=setTimeout(()=>{script.remove();scriptPromise=null;reject(Error('syncGoogleUnavailable'))},15000)
    script.onload=()=>{clearTimeout(timer);if(globalThis.google?.accounts?.oauth2)resolve();else{scriptPromise=null;reject(Error('syncGoogleUnavailable'))}}
    script.onerror=()=>{clearTimeout(timer);script.remove();scriptPromise=null;reject(Error('syncGoogleUnavailable'))}
    document.head.append(script)
  })
  return scriptPromise
}
export function createGoogleIdentity({clientId=GOOGLE_CLIENT_ID,getGoogle=()=>globalThis.google,fetcher=(...args)=>fetch(...args),now=()=>Date.now(),session=accountSession}={}){
  let credential=null,generation=0
  const configured=()=>/.+\.apps\.googleusercontent\.com$/.test(clientId)
  const clear=()=>{generation++;credential=null;session.clearAuthorization()}
  function authorize(drive=false,expectedSub=null){
    if(!configured())return Promise.reject(Error('syncNotConfigured'))
    const google=getGoogle()
    if(!google?.accounts?.oauth2)return Promise.reject(Error('syncGoogleUnavailable'))
    const current=++generation
    return new Promise((resolve,reject)=>{
      const client=google.accounts.oauth2.initTokenClient({
        client_id:clientId,scope:BASIC_SCOPE+(drive?' '+DRIVE_SCOPE:''),include_granted_scopes:false,
        callback:async response=>{
          try{
            if(current!==generation)throw Error('syncAccountChanged')
            if(response.error||!response.access_token)throw Error(response.error==='access_denied'?'syncDenied':'syncAuthFailed')
            if(drive&&!response.scope?.split(' ').includes(DRIVE_SCOPE))throw Error('syncDenied')
            const userResponse=await fetcher('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+response.access_token}})
            if(!userResponse.ok)throw Error('syncAuthFailed')
            const person=await userResponse.json()
            if(typeof person.sub!=='string'||!/^[a-zA-Z0-9_-]{1,256}$/.test(person.sub))throw Error('syncAuthFailed')
            if(expectedSub&&person.sub!==expectedSub)throw Error('syncAccountMismatch')
            if(current!==generation)throw Error('syncAccountChanged')
            credential={clientId,token:response.access_token,sub:person.sub,drive,expiresAt:now()+Number(response.expires_in||0)*1000}
            session.cacheAuthorization(credential)
            resolve({sub:person.sub,name:person.name||'',email:person.email||''})
          }catch(error){if(current===generation){credential=null;session.clearAuthorization()}reject(error)}
        },
        error_callback:()=>reject(Error('syncPopupClosed')),
      })
      client.requestAccessToken({prompt:drive?'consent':'select_account'})
    })
  }
  async function restore(expectedSub) {
    const saved=session.readAuthorization(now())
    if(!saved)return null
    if(saved.clientId!==clientId){session.clearAuthorization();return null}
    if(saved.sub!==expectedSub){session.clearAuthorization();throw Error('syncAccountMismatch')}
    const current=++generation
    try {
      const response=await fetcher('https://openidconnect.googleapis.com/v1/userinfo',{
        headers:{Authorization:'Bearer '+saved.token},signal:AbortSignal.timeout(15000),
      })
      if(current!==generation)throw Error('syncAccountChanged')
      if(!response.ok)throw Error('syncNeedsAuth')
      const person=await response.json()
      if(current!==generation)throw Error('syncAccountChanged')
      if(person.sub!==expectedSub)throw Error('syncAccountMismatch')
      if(saved.expiresAt-now()<30000)throw Error('syncNeedsAuth')
      credential=saved
      return {sub:person.sub,name:person.name||'',email:person.email||''}
    } catch(error) {
      if(current===generation) {
        credential=null
        if(['syncNeedsAuth','syncAccountMismatch'].includes(error.message))session.clearAuthorization()
      }
      throw error
    }
  }
  function access(sub,drive=true){
    if(!credential||credential.sub!==sub||drive&&!credential.drive||credential.expiresAt-now()<30000)throw Error('syncNeedsAuth')
    return credential.token
  }
  async function revoke(sub){
    const token=access(sub,false),google=getGoogle()
    await new Promise((resolve,reject)=>google.accounts.oauth2.revoke(token,result=>{
      if(result?.error)reject(Error('syncRevokeFailed'));else resolve()
    }))
    clear()
  }
  return {configured,authorize,restore,access,clear,revoke}
}
export const googleIdentity=createGoogleIdentity()
