import type { Component } from 'vue'
import { Brain, Folders, LayoutDashboard, Sparkles } from 'lucide-vue-next'

export type OrbitItem = {
  id: string
  to: string
  label: string
  icon: Component
}

export const ORBIT_ITEMS: OrbitItem[] = [
  { id: 'home', to: '/', label: 'Status', icon: LayoutDashboard },
  { id: 'projects', to: '/projects', label: 'Projects', icon: Folders },
  { id: 'brain', to: '/brain', label: 'Brain', icon: Brain },
  { id: 'skills', to: '/skills', label: 'Skills', icon: Sparkles },
]
