import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'
import ProjectsPage from '@/pages/ProjectsPage.vue'
import SkillsPage from '@/pages/SkillsPage.vue'
import BrainPage from '@/pages/BrainPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/projects', component: ProjectsPage },
    { path: '/graph', redirect: '/projects' },
    { path: '/brain', component: BrainPage },
    { path: '/skills', component: SkillsPage },
  ],
})
