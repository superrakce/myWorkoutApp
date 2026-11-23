import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { readWorkspace, writeWorkspace, validateBackup } from '../repositories/database.js'
import { clone, localDate, uid } from '../services/domain.js'
import { emptySync, capture, mergeRemote, materialize, resolveVersion, importRecords } from '../services/syncGraph.js'
export const freshData=()=>({
  profile:{age:null,sex:'',ageDate:localDate()},
  settings:{timeZone:'Asia/Taipei',musicVolume:0.35,cueVolume:0.25},
  plans:[],sessions:[],meals:[],measurements:[],favorites:[],days:{},active:null,
})
export const useAppStore=defineStore('app',()=>{
  const data=ref(freshData()),ready=ref(false),error=ref(''),notice=ref(''),
    scope=ref('guest'),identity=ref(null),sync=ref(emptySync()),epoch=ref(0)
  let saving=Promise.resolve(),timer,baseline=clone(data.value)
  const listeners=new Set()
  function checked(value){return validateBackup({schemaVersion:1,data:value})}
  function workspace(){return {data:clone(data.value),sync:clone(sync.value)}}
  async function init(){
    try{
      const stored=await readWorkspace()
      if(stored){data.value=checked(stored.data);sync.value=stored.sync||emptySync()}
      if(data.value.active&&!['completed','aborted'].includes(data.value.active.status)){
        data.value.active.status='paused';notice.value='restored'
      }
      baseline=clone(data.value)
    }catch{error.value='storageError'}
    ready.value=true
  }
  function persist(){
    clearTimeout(timer)
    const savedScope=scope.value,oldPending=sync.value.pending.length
    if(savedScope!=='guest')sync.value=capture(sync.value,baseline,data.value)
    baseline=clone(data.value)
    const snapshot=workspace(),changed=sync.value.pending.length>oldPending
    saving=saving.catch(()=>{}).then(()=>writeWorkspace(savedScope,snapshot)).then(()=>{
      if(changed&&savedScope===scope.value)for(const fn of listeners)fn()
    }).catch(()=>{error.value='storageError';throw Error('storageError')})
    return saving
  }
  watch(data,()=>{
    if(!ready.value)return
    if(!data.value.active||['ready','paused','completed','aborted'].includes(data.value.active.status))persist().catch(()=>{})
    else{clearTimeout(timer);timer=setTimeout(()=>persist().catch(()=>{}),500)}
  },{deep:true,flush:'sync'})
  async function switchWorkspace(nextScope,person=null){
    if(data.value.active&&!['completed','aborted'].includes(data.value.active.status))data.value.active.status='paused'
    await persist()
    const stored=await readWorkspace(nextScope)
    const next=stored?checked(stored.data):freshData()
    ready.value=false;epoch.value++;scope.value=nextScope;identity.value=person
    data.value=next;sync.value=stored?.sync||emptySync()
    if(data.value.active&&!['completed','aborted'].includes(data.value.active.status))data.value.active.status='paused'
    baseline=clone(data.value);ready.value=true
  }
  async function openAccount(person){await switchWorkspace('google:'+person.sub,{sub:person.sub,name:person.name||'',email:person.email||''})}
  async function signOut(){await switchWorkspace('guest')}
  function savePlan(p){
    const value=clone(p);value.updatedAt=new Date().toISOString();value.id||=uid()
    const i=data.value.plans.findIndex(x=>x.id===value.id)
    if(i<0)data.value.plans.push(value);else data.value.plans[i]=value
    return value.id
  }
  function toggleFavorite(id){const i=data.value.favorites.indexOf(id);if(i<0)data.value.favorites.push(id);else data.value.favorites.splice(i,1)}
  function backup(){return {schemaVersion:1,dataVersion:'2026-11-v1',mappingVersion:1,exportedAt:new Date().toISOString(),data:clone(data.value)}}
  async function restore(b){
    const restored=clone(checked(b.data))
    if(b.schemaVersion!==1)throw Error('invalidBackup')
    if(restored.active&&!['completed','aborted'].includes(restored.active.status))restored.active.status='paused'
    await saving.catch(()=>{})
    if(scope.value!=='guest'){sync.value.enabled=false;sync.value.reviewRequired=true}
    data.value=restored;await persist()
  }
  async function reset(){
    await persist()
    const next=freshData(),meta=emptySync()
    await writeWorkspace(scope.value,{data:next,sync:meta})
    ready.value=false;data.value=next;sync.value=meta;baseline=clone(next);ready.value=true
  }
  async function applyRemote(expectedScope,events,uploaded,files,isCurrent=()=>true){
    await saving
    if(scope.value!==expectedScope||!isCurrent())throw Error('syncAccountChanged')
    const result=mergeRemote(sync.value,data.value,events,uploaded,files)
    checked(result.data)
    ready.value=false;sync.value=result.sync;data.value=result.data;baseline=clone(data.value);ready.value=true
    await persist()
  }
  async function resolveConflict(key,id){
    const next=resolveVersion(sync.value,key,id),result=materialize(next.events,data.value)
    checked(result)
    ready.value=false;sync.value=next;data.value=result;baseline=clone(result);ready.value=true;await persist()
  }
  async function importGuest(expected){
    if(scope.value==='guest')return
    const guest=(await readWorkspace('guest'))?.data
    if(!guest)return
    if(expected&&JSON.stringify(guest)!==expected)throw Error('syncGuestChanged')
    const result=importRecords(sync.value,data.value,checked(guest),freshData())
    checked(result.data)
    ready.value=false;data.value=result.data;sync.value=result.sync;baseline=clone(data.value);ready.value=true;await persist()
    for(const fn of listeners)fn()
  }
  const onSaved=fn=>{listeners.add(fn);return()=>listeners.delete(fn)}
  return {data,ready,error,notice,scope,identity,sync,epoch,init,persist,savePlan,toggleFavorite,backup,restore,reset,
    openAccount,signOut,applyRemote,resolveConflict,importGuest,onSaved}
})
