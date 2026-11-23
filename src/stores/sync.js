import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAppStore } from './app.js'
import { googleIdentity, loadGoogleIdentity } from '../services/googleIdentity.js'
import { createDriveClient } from '../services/googleDrive.js'
import { conflicts, hasBusinessData } from '../services/syncGraph.js'
import { readWorkspace } from '../repositories/database.js'
export const useSyncStore=defineStore('sync',()=>{
  const app=useAppStore(),status=ref('syncLocal'),error=ref(''),busy=ref(false),authBusy=ref(false),
    googleReady=ref(false),online=ref(navigator.onLine),guestPreview=ref(null)
  const configured=googleIdentity.configured(),issues=computed(()=>conflicts(app.sync.events))
  let installed=false,timer,controller,generation=0,retries=0,recovering=false
  function cancel(){generation++;clearTimeout(timer);controller?.abort();busy.value=false}
  async function prepare(){
    if(!configured)return
    try{await loadGoogleIdentity();googleReady.value=true;error.value=''}catch(e){error.value=e.message}
  }
  function setError(e){
    const key=e.message
    error.value=key.startsWith('sync')?key:'syncRequestFailed'
    status.value=['syncNeedsAuth','syncDenied','syncAccountMismatch','syncPermission'].includes(key)?'syncNeedsAuth':
      key==='syncCloudMissing'?'syncCloudMissing':!online.value?'syncOffline':'syncFailed'
  }
  async function signIn(){
    if(authBusy.value)return
    authBusy.value=true;cancel();error.value=''
    try{
      const identity=await googleIdentity.authorize()
      await app.openAccount(identity)
      status.value=app.sync.reviewRequired?'syncRestoreReview':app.sync.enabled?'syncNeedsAuth':'syncLocal'
    }catch(e){setError(e)}finally{authBusy.value=false}
  }
  async function signOut(){
    cancel();googleIdentity.clear();authBusy.value=true
    try{await app.signOut();status.value='syncLocal';error.value='';guestPreview.value=null}
    catch(e){setError(e)}finally{authBusy.value=false}
  }
  async function connect(){
    if(!app.identity||authBusy.value)return
    authBusy.value=true;cancel();error.value=''
    try{
      await googleIdentity.authorize(true,app.identity.sub)
      app.sync.enabled=true;await app.persist()
      status.value=app.sync.reviewRequired?'syncRestoreReview':'syncPending'
    }catch(e){setError(e)}finally{authBusy.value=false}
    if(app.sync.enabled&&!error.value&&!app.sync.reviewRequired)await run()
  }
  async function disconnect(revoke=false){
    cancel()
    app.sync.enabled=false;await app.persist()
    if(revoke)try{await googleIdentity.revoke(app.identity.sub)}catch(e){setError(e);return}
    googleIdentity.clear();status.value='syncLocal';error.value=''
  }
  function schedule(delay=1800){
    clearTimeout(timer)
    if(!app.identity||!app.sync.enabled||app.sync.reviewRequired)return
    if(!online.value){status.value='syncOffline';return}
    if(busy.value)return
    status.value=issues.value.length?'syncConflict':'syncPending'
    timer=setTimeout(()=>run(),delay)
  }
  async function run({approveRestore=false,recover=false}={}){
    if(busy.value||!app.identity)return
    if(app.sync.reviewRequired&&!approveRestore){status.value='syncRestoreReview';return}
    if(!app.sync.enabled&&!approveRestore)return
    if(!online.value){status.value='syncOffline';return}
    const expected=app.scope,person=app.identity.sub,runGeneration=++generation
    busy.value=true;error.value='';status.value='syncWorking';clearTimeout(timer)
    controller=new AbortController()
    try{
      googleIdentity.access(person)
      if(approveRestore){app.sync.reviewRequired=false;app.sync.enabled=true}
      await app.persist()
      const drive=createDriveClient({getToken:()=>googleIdentity.access(person),signal:controller.signal})
      const apply=(events,uploaded,files)=>app.applyRemote(expected,events,uploaded,files,()=>runGeneration===generation)
      const first=await drive.download(app.sync.files,recover)
      if(runGeneration!==generation||expected!==app.scope)return
      await apply(first.events,[],first.files)
      if(recover){
        app.sync.pending=[...new Set([...app.sync.pending,...app.sync.events.map(e=>e.id)])]
        await app.persist()
      }
      const queued=[...app.sync.pending],uploadedFiles={}
      for(const id of queued){
        if(runGeneration!==generation||expected!==app.scope)return
        const event=app.sync.events.find(e=>e.id===id)
        if(!event)throw Error('syncCorrupt')
        const file=await drive.upload(event)
        uploadedFiles[file.id]=file.stamp
        if(runGeneration!==generation||expected!==app.scope)return
        await apply([],[id],{...app.sync.files,[file.id]:file.stamp})
      }
      const last=await drive.download(first.files)
      if(runGeneration!==generation||expected!==app.scope)return
      await apply(last.events,[],{...last.files,...uploadedFiles})
      status.value=issues.value.length?'syncConflict':app.sync.pending.length?'syncPending':'syncSynced'
      if(status.value==='syncSynced'){app.sync.lastSync=new Date().toISOString();await app.persist()}
      retries=0
    }catch(e){
      if(e.name==='AbortError'||runGeneration!==generation)return
      setError(e)
      if(['syncNetwork','syncTemporary','syncQuota'].includes(e.message)&&retries<5){
        const delay=[2000,5000,15000,30000,60000][retries++]
        timer=setTimeout(()=>run(),delay)
      }
    }finally{
      if(runGeneration===generation){
        busy.value=false
        if(status.value==='syncPending'&&app.sync.pending.length)schedule()
      }
    }
  }
  async function resolve(key,id){await app.resolveConflict(key,id);schedule(0)}
  async function previewGuest(){
    const guest=(await readWorkspace('guest'))?.data
    guestPreview.value=guest&&hasBusinessData(guest,{profile:{age:null,sex:'',ageDate:guest.profile.ageDate},settings:{timeZone:'Asia/Taipei',musicVolume:0.35,cueVolume:0.25},plans:[],sessions:[],meals:[],measurements:[],favorites:[],days:{},active:null})?guest:null
  }
  async function importGuest(){
    try{await app.importGuest(JSON.stringify(guestPreview.value));guestPreview.value=null;schedule(0)}catch(e){setError(e)}
  }
  async function clearLocal(){
    cancel();googleIdentity.clear()
    await app.reset();status.value='syncLocal';error.value=''
  }
  async function pauseForRestore(){cancel();app.sync.enabled=false;await app.persist()}
  async function deleteCloud(){
    if(!app.identity)return
    cancel();app.sync.enabled=false;await app.persist();busy.value=true;error.value=''
    try{
      const drive=createDriveClient({getToken:()=>googleIdentity.access(app.identity.sub)})
      await drive.deleteCloud()
      app.sync.files={};app.sync.lastSync=null;app.sync.reviewRequired=true
      await app.persist();status.value='syncCloudDeleted'
    }catch(e){setError(e)}finally{busy.value=false}
  }
  function init(){
    if(installed)return
    installed=true
    app.onSaved(()=>schedule())
    window.addEventListener('online',()=>{online.value=true;schedule(0)})
    window.addEventListener('offline',()=>{online.value=false;cancel();status.value=app.identity?'syncOffline':'syncLocal'})
    window.addEventListener('focus',()=>{if(app.sync.enabled)schedule(0)})
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&app.sync.enabled)schedule(0)})
  }
  return {status,error,busy,authBusy,googleReady,online,configured,issues,guestPreview,prepare,init,signIn,signOut,connect,
    disconnect,run,resolve,previewGuest,importGuest,clearLocal,pauseForRestore,deleteCloud}
})
