import { accountSession } from '../services/accountSession.js'
import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import { resolveExercise, visibleExercises, validateExercise } from '../services/exerciseLibrary.js'
import { readWorkspace, writeWorkspace, validateBackup } from '../repositories/database.js'
import { clone, localDate, uid } from '../services/domain.js'
import { emptySync, capture, mergeRemote, materialize, resolveVersion, importRecords } from '../services/syncGraph.js'
export const freshData=()=>({
  profile:{age:null,sex:'',ageDate:localDate()},
  settings:{timeZone:'Asia/Taipei',musicVolume:0.35,cueVolume:0.25},
  plans:[],sessions:[],meals:[],measurements:[],exerciseLibrary:[],favorites:[],days:{},active:null,
})
export const useAppStore=defineStore('app',()=>{
  const data=ref(freshData()),ready=ref(false),error=ref(''),
    scope=ref('guest'),identity=ref(null),sync=ref(emptySync()),epoch=ref(0)
  const exercises=computed(()=>visibleExercises(data.value.exerciseLibrary||[]))
  const findExercise=id=>resolveExercise(id,data.value.exerciseLibrary||[])
  async function saveExercise(exercise) {
    const value=clone(exercise)
    if(!validateExercise(value))throw Error('invalidExercise')
    const previous=findExercise(value.id)
    if(previous)for(const p of data.value.plans)for(const i of p.items)
      if(i.exerciseId===value.id&&!i.exercise)i.exercise=clone(previous)
    data.value.exerciseLibrary ||= []
    const index=data.value.exerciseLibrary.findIndex(e=>e.id===value.id)
    if(index<0)data.value.exerciseLibrary.push(value);else data.value.exerciseLibrary[index]=value
    await persist()
  }
  async function removeExercise(id) {
    const e=findExercise(id)
    if(!e)return
    for(const p of data.value.plans)for(const i of p.items)
      if(i.exerciseId===id&&!i.exercise)i.exercise=clone(e)
    await saveExercise({...clone(e),deleted:true})
    data.value.favorites=data.value.favorites.filter(value=>value!==id)
    await persist()
  }
  let saving=Promise.resolve(),timer,baseline=clone(data.value)
  const revisions={guest:0}
  const listeners=new Set()
  function checked(value){return validateBackup({schemaVersion:1,data:value})}
  function workspace(){return {data:clone(data.value),sync:clone(sync.value)}}
  async function init(){
    try{
      const remembered=accountSession.readAccount()
      const initialScope=remembered?'google:'+remembered.sub:'guest'
      const stored=await readWorkspace(initialScope)
      if(stored){data.value=checked(stored.data);sync.value=stored.sync||emptySync();revisions[initialScope]=stored.revision||0}
      scope.value=initialScope;identity.value=remembered
      if(data.value.active&&!['completed','aborted'].includes(data.value.active.status)){
        data.value.active.status='paused'
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
    saving=saving.catch(()=>{}).then(()=>writeWorkspace(savedScope,snapshot,revisions[savedScope]||0)).then(revision=>{
      revisions[savedScope]=revision
      if(changed&&savedScope===scope.value)for(const fn of listeners)fn()
    }).catch(e=>{error.value=e.message==='syncLocalChanged'?'syncLocalChanged':'storageError';throw e})
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
    revisions[nextScope]=stored?.revision||0
    ready.value=false;epoch.value++;scope.value=nextScope;identity.value=person
    data.value=next;sync.value=stored?.sync||emptySync()
    if(data.value.active&&!['completed','aborted'].includes(data.value.active.status))data.value.active.status='paused'
    accountSession.rememberAccount(person)
    baseline=clone(data.value);ready.value=true
  }
  function updateIdentity(person){
    if(!identity.value || identity.value.sub!==person.sub)return
    identity.value={sub:person.sub,name:person.name||'',email:person.email||''}
    accountSession.rememberAccount(identity.value)
  }
  async function openAccount(person){await switchWorkspace('google:'+person.sub,{sub:person.sub,name:person.name||'',email:person.email||''})}
  async function signOut(){accountSession.rememberAccount(null);await switchWorkspace('guest')}
  function savePlan(p){
    const value=clone(p);value.items=value.items.map(i=>({...i,exercise:clone(i.exercise||findExercise(i.exerciseId))}));value.updatedAt=new Date().toISOString();value.id||=uid()
    const i=data.value.plans.findIndex(x=>x.id===value.id)
    if(i<0)data.value.plans.push(value);else data.value.plans[i]=value
    return value.id
  }
  function toggleFavorite(id){const i=data.value.favorites.indexOf(id);if(i<0)data.value.favorites.push(id);else data.value.favorites.splice(i,1)}
  function backup(){return {schemaVersion:1,dataVersion:'2026-11-v1',mappingVersion:1,exportedAt:new Date().toISOString(),data:clone(data.value)}}
  async function restore(b){
    const expected=scope.value
    const restored=clone(checked(b.data))
    if(b.schemaVersion!==1)throw Error('invalidBackup')
    if(restored.active&&!['completed','aborted'].includes(restored.active.status))restored.active.status='paused'
    await saving.catch(()=>{})
    if(scope.value!==expected)throw Error('syncAccountChanged')
    if(scope.value!=='guest'){sync.value.enabled=false;sync.value.reviewRequired=true}
    data.value=restored;await persist()
  }
  async function reset(){
    const expected=scope.value
    await persist()
    if(scope.value!==expected)throw Error('syncAccountChanged')
    const next=freshData(),meta=emptySync()
    revisions[expected]=await writeWorkspace(expected,{data:next,sync:meta},revisions[expected]||0)
    if(scope.value!==expected)throw Error('syncAccountChanged')
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
    const expectedScope=scope.value
    if(scope.value==='guest')return
    const guest=(await readWorkspace('guest'))?.data
    if(scope.value!==expectedScope)throw Error('syncAccountChanged')
    if(!guest)return
    if(expected&&JSON.stringify(guest)!==expected)throw Error('syncGuestChanged')
    const result=importRecords(sync.value,data.value,checked(guest),freshData())
    checked(result.data)
    ready.value=false;data.value=result.data;sync.value=result.sync;baseline=clone(data.value);ready.value=true;await persist()
    for(const fn of listeners)fn()
  }
  const onSaved=fn=>{listeners.add(fn);return()=>listeners.delete(fn)}
  return {exercises,findExercise,saveExercise,removeExercise,data,ready,error,scope,identity,sync,epoch,init,persist,savePlan,toggleFavorite,backup,restore,reset,
    openAccount,signOut,updateIdentity,applyRemote,resolveConflict,importGuest,onSaved}
})
