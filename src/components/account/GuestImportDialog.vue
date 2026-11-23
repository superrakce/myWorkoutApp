<script setup>
import {useI18n} from 'vue-i18n'
defineProps({data:Object,disabled:Boolean})
defineEmits(['confirm','cancel'])
const {t}=useI18n()
</script>
<template><div class="modal-overlay" @click.self="$emit('cancel')"><section class="modal compact" role="dialog" aria-modal="true" :aria-label="t('syncImportPreview')"><h2>{{t('syncImportPreview')}}</h2><template v-if="data"><p>{{t('syncImportHelp')}}</p><p v-for="key in ['plans','sessions','meals','measurements']" :key="key">{{t({plans:'plans',sessions:'history',meals:'nutrition',measurements:'body'}[key])}}: {{data[key].length}}</p><p>{{t('settings')}} · {{t('body')}}</p></template><p v-else>{{t('syncNoGuest')}}</p><div class="form-actions"><button @click="$emit('cancel')">{{t('cancel')}}</button><button v-if="data" class="button primary" :disabled="disabled" @click="$emit('confirm')">{{t('syncImportConfirm')}}</button></div></section></div></template>
