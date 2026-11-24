<script setup>
import {useI18n} from 'vue-i18n'
import {findExercise} from '../../data/catalog.js'
defineProps({issues:{type:Array,required:true},disabled:Boolean})
defineEmits(['resolve'])
const {t,locale}=useI18n()
const groups={exerciseLibrary:'exercises',plans:'plans',sessions:'history',meals:'nutrition',measurements:'body',days:'date',profile:'body',settings:'settings',favorites:'favorites'}
function describe(event){
  if(event.deleted)return t('syncDeleted')
  const v=event.value,key=event.key.split('/')[0]
  if(key==='exerciseLibrary')return [v.name?.en,v.name?.['zh-TW'],t(v.type),t(v.difficulty),t(v.mode==='time'?'seconds':'reps'),t('primary')+': '+(v.primary||[]).map(p=>t('labels.'+p)).join(', '),t('secondary')+': '+(v.secondary||[]).map(p=>t('labels.'+p)).join(', '),t('equipment')+': '+(v.equipment||[]).map(p=>t('labels.'+p)).join(', '),(v.aliases||[]).join(', '),...(v.steps?.en||[]),...(v.steps?.['zh-TW']||[]),v.deleted?t('syncDeleted'):''].filter(Boolean).join('\n')
  if(key==='plans')return [v.name,v.description,...(v.items||[]).map(i=>(findExercise(i.exerciseId)?.name[locale.value]||i.exerciseId)+' · '+i.target+' '+t(i.mode==='time'?'seconds':'reps')+' · '+i.weight+' kg'),t('countSets',{count:v.sets},v.sets),t(v.mode),...['prepare','setRest','transitionRest','roundRest','cooldown'].map(k=>t(k)+': '+v[k])].filter(Boolean).join('\n')
  if(key==='sessions')return [v.snapshot?.name,v.startedAt,t(v.status),...(v.logs||[]).map(l=>(l.exercise?.name[locale.value]||l.exerciseId)+' · '+l.actual+' '+t(l.mode==='time'?'seconds':'reps')+' · '+l.weight+' kg · '+t(l.status==='completed'?'completed':'partial')),v.notes].filter(Boolean).join('\n')
  if(key==='meals')return [v.name,v.date,t(v.meal),v.kcal+' kcal',...['protein','carbs','fat'].filter(k=>v[k]!=null).map(k=>t(k)+': '+v[k])].join('\n')
  if(key==='measurements')return [v.measuredAt,...Object.entries({weight:'bodyWeight',height:'height',bodyFat:'bodyFat',muscle:'muscle',skeletal:'skeletal',waist:'waist',rmr:'measuredRmr'}).filter(([k])=>v[k]!=null).map(([k,label])=>t(label)+': '+v[k]),v.device,v.notes].filter(Boolean).join('\n')
  if(key==='favorites')return v.map(id=>findExercise(id)?.name[locale.value]||id).join(', ')||t('noData')
  if(key==='settings')return [t('language')+': '+(v.language||'—'),t('timezone')+': '+v.timeZone,t('musicVolume')+': '+v.musicVolume,t('cueVolume')+': '+v.cueVolume].join('\n')
  if(key==='profile')return [t('age')+': '+(v.age??'—'),t('ageDate')+': '+v.ageDate,t('sex')+': '+t(v.sex||'unspecified')].join('\n')
  return Object.entries(v).map(([k,value])=>t(k)+': '+t(value?'confirmed':'unconfirmed')).join('\n')
}
</script>
<template><section v-if="issues.length" class="sync-conflicts"><h3>{{t('syncConflicts')}}</h3><p>{{t('syncConflictHelp')}}</p><article v-for="issue in issues" :key="issue.key" class="sync-conflict"><h4>{{t(groups[issue.key.split('/')[0]])}}</h4><div class="sync-versions"><section v-for="(version,i) in issue.versions" :key="version.id"><b>{{t('syncVersion',{number:i+1})}}</b><p class="sync-content">{{describe(version)}}</p><button class="button soft" :disabled="disabled" @click="$emit('resolve',{key:issue.key,id:version.id})">{{t('syncChooseVersion')}}</button></section></div></article></section></template>
<style scoped>
.sync-conflict{border-top:1px solid var(--color-border);margin-top:18px;padding-top:8px}.sync-versions{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}.sync-versions>section{padding:15px;background:var(--color-background);border-radius:8px;min-width:0}.sync-content{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;max-height:300px;overflow:auto;margin-top:10px}
</style>
