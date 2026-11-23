<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download, Upload, ShieldCheck } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'
import { validateBackup } from '../repositories/database.js'
const store = useAppStore(),
  { t, locale } = useI18n(),
  preview = ref(null),
  message = ref(''),
  backedUp = ref(false)
function download(content, name, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function backup() {
  download(
    JSON.stringify(store.backup(), null, 2),
    'form-backup-' + new Date().toISOString().slice(0, 10) + '.json',
  )
  message.value = 'downloaded'
  backedUp.value = true
}
async function file(e) {
  try {
    if (e.target.files[0].size > 20 * 1024 * 1024) throw Error()
    const b = JSON.parse(await e.target.files[0].text())
    validateBackup(b)
    preview.value = b
    backedUp.value = false
    message.value = ''
  } catch {
    message.value = 'invalidBackup'
  }
  e.target.value = ''
}
async function restore() {
  try {
    await store.restore(preview.value)
    preview.value = null
    message.value = 'saved'
  } catch {
    message.value = 'invalidBackup'
  }
}
function csv() {
  const quote = (v) =>
    '"' +
    String(v ?? '')
      .replace(/"/g, '""')
      .replace(/^[=+@-]/, "'$&") +
    '"'
  const rows = [
    ['type', 'date', 'name', 'actual', 'unit', 'kcal'],
    ...store.data.sessions.flatMap((s) =>
      s.logs.map((l) => [
        'workout',
        l.completedAt,
        l.exercise.name[locale.value],
        l.actual,
        l.mode,
        '',
      ]),
    ),
    ...store.data.meals.map((m) => ['meal', m.date, m.name, '', '', m.kcal]),
  ]
  download(
    '\uFEFF' + rows.map((row) => row.map(quote).join(',')).join('\r\n'),
    'form-records.csv',
    'text/csv;charset=utf-8',
  )
}
async function clear() {
  if (confirm(t('eraseConfirm'))) {
    await store.reset()
    message.value = 'saved'
  }
}
function zone(e) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: e.target.value })
    store.data.settings.timeZone = e.target.value
  } catch {
    message.value = 'invalid'
  }
}
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">{{ t('settingsEyebrow') }}</p>
      <h1>{{ t('settings') }}</h1>
    </div>
  </div>
  <div class="settings-grid">
    <section class="panel">
      <h2>{{ t('language') }}</h2>
      <label
        >{{ t('language')
        }}<select v-model="locale">
          <option value="en">English</option>
          <option value="zh-TW">繁體中文</option>
        </select></label
      ><label
        >{{ t('timezone')
        }}<select :value="store.data.settings.timeZone" @change="zone">
          <option
            v-for="z in [
              'Asia/Taipei',
              'Asia/Tokyo',
              'UTC',
              'America/New_York',
              'America/Los_Angeles',
              'Europe/London',
            ]"
            :key="z"
          >
            {{ z }}
          </option>
        </select></label
      >
      <p class="small muted">{{ t('timezoneHint') }}</p>
    </section>
    <section class="panel">
      <ShieldCheck class="blue" :size="30" />
      <h2>{{ t('data') }}</h2>
      <p class="muted">{{ t('storageHint') }}</p>
      <div class="stack-actions">
        <button class="button primary" @click="backup">
          <Download :size="18" />{{ t('export') }}</button
        ><button class="button soft" @click="csv">{{ t('csv') }}</button
        ><label class="button soft upload"
          ><Upload :size="18" />{{ t('restore')
          }}<input type="file" accept="application/json,.json" @change="file" /></label
        ><button class="button danger" @click="clear">{{ t('erase') }}</button>
      </div>
    </section>
    <section class="panel full">
      <h2>{{ t('sources') }}</h2>
      <p>{{ t('sourcesText') }}</p>
      <a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noreferrer"
        >Mifflin–St Jeor (1990)</a
      >
      <p class="small muted">
        FORM SVG · original · project-owned · v1 · 2026-11 · placeholder / unreviewed
      </p>
    </section>
  </div>
  <p v-if="message" class="alert" role="status">{{ t(message) }}</p>
  <div v-if="preview" class="modal-overlay" @click.self="preview = null">
    <section class="modal compact" role="dialog" aria-modal="true" :aria-label="t('backupPreview')">
      <h2>{{ t('backupPreview') }}</h2>
      <p v-for="k in ['plans', 'sessions', 'meals', 'measurements']" :key="k">
        {{
          t(
            {
              plans: 'plans',
              sessions: 'sessions',
              meals: 'nutrition',
              measurements: 'measurementHistory',
            }[k],
          )
        }}: {{ preview.data[k].length }}
      </p>
      <p class="callout">{{ t('backupFirst') }}</p>
      <button class="button soft" @click="backup">{{ t('export') }}</button>
      <div class="form-actions">
        <button @click="preview = null">{{ t('cancel') }}</button><button
          class="button primary"
          :disabled="!backedUp"
          @click="restore"
        >
          {{ t('restoreConfirm') }}
        </button>
      </div>
    </section>
  </div>
</template>
