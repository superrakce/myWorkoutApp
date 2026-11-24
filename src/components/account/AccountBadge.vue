<script setup>
import {useI18n} from 'vue-i18n'
import {UserRound} from 'lucide-vue-next'
import {useAppStore} from '../../stores/app.js'
const app=useAppStore(),{t}=useI18n()
</script>
<template><RouterLink to="/settings" class="account-badge" :aria-label="t('syncAccount')"><UserRound :size="18"/><span>{{app.identity?(app.identity.name||app.identity.email):t('syncSignIn')}}</span></RouterLink></template>
<style scoped>.account-badge{display:flex;align-items:center;gap:6px;min-height:44px;padding:7px 10px;border-radius:8px;background:var(--color-primary-soft);font-size:12px;max-width:160px}.account-badge svg{flex-shrink:0}.account-badge span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media(max-width:760px){.account-badge{max-width:120px}}</style>
