<script setup>
import { computed, watch, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import {
  LayoutDashboard,
  Dumbbell,
  CalendarDays,
  ChartNoAxesCombined,
  Utensils,
  Activity,
  Settings,
  ShieldCheck,
  Ellipsis,
  X,
} from 'lucide-vue-next'
import AccountBadge from './components/account/AccountBadge.vue'
import { useSyncStore } from './stores/sync.js'
import { useAppStore } from './stores/app.js'
const sync = useSyncStore()
const store = useAppStore(),
  { t, locale } = useI18n(),
  route = useRoute(),
  more = ref(false)
const links = [
  ['/', 'overview', LayoutDashboard],
  ['/exercises', 'exercises', Dumbbell],
  ['/plans', 'plans', CalendarDays],
  ['/history', 'history', ChartNoAxesCombined],
  ['/nutrition', 'nutrition', Utensils],
  ['/body', 'body', Activity],
  ['/settings', 'settings', Settings],
]
const title = computed(() => links.find((l) => l[0] === route.path)?.[1] || 'player')
watch(
  locale,
  (l) => {
    try { localStorage.setItem('form-locale', l) } catch {}
    if(store.ready && store.data.settings.language!==l) store.data.settings.language=l
    document.documentElement.lang = l
  },
  { immediate: true },
)
watch(
  () => route.path,
  () => (more.value = false),
)
watch(()=>store.data.settings.language,l=>{if(['en','zh-TW'].includes(l))locale.value=l})
onMounted(async () => {await store.init();sync.init()})
</script>
<template>
  <aside class="sidebar">
    <RouterLink to="/" class="brand"
      ><span class="brand-mark">f<span>.</span></span
      >FORM</RouterLink
    >
    <nav>
      <RouterLink
        v-for="[path, key, icon] in links"
        :key="path"
        :to="path"
        :class="{ selected: route.path === path }"
        ><component :is="icon" :size="20" />{{ t(key)
        }}<span v-if="route.path === path" class="nav-dot"
      /></RouterLink>
    </nav>
    <div class="sidebar-note">
      <ShieldCheck :size="22" /><b>{{ t('localOnly') }}</b>
      <p>{{ t('local') }}</p>
    </div>
    <div class="sidebar-bottom">
      FORM <span>01 / {{ t('edition') }}</span>
    </div>
  </aside>
  <div class="workspace">
    <header class="topbar">
      <div class="mobile-brand">FORM<span>●</span></div>
      <span class="breadcrumb">{{ t(title) }}</span>
      <div class="top-actions">
        <span class="local-indicator"><i />{{ t(sync.status) }}</span
        ><button class="language" @click="locale = locale === 'en' ? 'zh-TW' : 'en'">
          {{ locale === 'en' ? '繁中' : 'EN' }}</button
        ><AccountBadge />
      </div>
    </header>
    <div v-if="store.error" class="alert error" role="alert">
      {{ t(store.error)
      }}<button @click="store.error = ''" :aria-label="t('close')">
        <X :size="18" />
      </button>
    </div>
    <div v-if="store.notice" class="alert" role="status">
      {{ t(store.notice)
      }}<button @click="store.notice = ''" :aria-label="t('close')">
        <X :size="18" />
      </button>
    </div>
    <main v-if="store.ready">
      <RouterView v-slot="{ Component }"
        ><KeepAlive :key="store.epoch" include="ExerciseLibrary"><component :is="Component" /></KeepAlive
      ></RouterView>
    </main>
    <main v-else class="loading">FORM ···</main>
    <footer class="page-footer">
      <span>FORM / {{ new Date().getFullYear() }}</span>
    </footer>
  </div>
  <nav class="mobile-nav">
    <RouterLink
      v-for="[path, key, icon] in links.slice(0, 4)"
      :key="path"
      :to="path"
      :class="{ selected: route.path === path }"
      ><component :is="icon" :size="21" /><span>{{ t(key) }}</span></RouterLink
    ><button @click="more = !more" :aria-expanded="more">
      <Ellipsis :size="22" /><span>{{ t('more') }}</span>
    </button>
  </nav>
  <div v-if="more" class="more-menu panel">
    <RouterLink v-for="[path, key, icon] in links.slice(4)" :key="path" :to="path"
      ><component :is="icon" :size="20" />{{ t(key) }}</RouterLink
    >
  </div>
</template>
