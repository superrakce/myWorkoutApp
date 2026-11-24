import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from './i18n/index.js'
import App from './App.vue'
import Dashboard from './views/Dashboard.vue'
import Exercises from './views/Exercises.vue'
import Plans from './views/Plans.vue'
import History from './views/History.vue'
import Nutrition from './views/Nutrition.vue'
import Body from './views/Body.vue'
import Settings from './views/Settings.vue'
import Player from './views/Player.vue'
import './assets/main.css'
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Dashboard },
    { path: '/exercises', component: Exercises },
    { path: '/plans', component: Plans },
    { path: '/history', component: History },
    { path: '/nutrition', component: Nutrition },
    { path: '/body', component: Body },
    { path: '/settings', component: Settings },
    { path: '/player', component: Player },
  ],
  scrollBehavior: (to) => to.hash === '#measurement-form'
    ? { el: to.hash, top: 88 }
    : { top: 0 },
})
createApp(App).use(createPinia()).use(i18n).use(router).mount('#app')
