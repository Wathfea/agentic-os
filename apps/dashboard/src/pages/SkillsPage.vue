<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import Section from '@/components/ui/Section.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { api, type Skill } from '@/lib/api'

const queryClient = useQueryClient()
const tab = ref<'all' | 'seed' | 'global' | 'project'>('all')
const selectedId = ref<string | null>(null)
const editorContent = ref('')
const newName = ref('')
const newDescription = ref('')

const skills = useQuery({ queryKey: ['skills'], queryFn: () => api.listSkills() })

const filtered = computed(() => {
  const list = skills.data.value?.skills ?? []
  if (tab.value === 'all') return list
  return list.filter((s) => s.source === tab.value)
})

const selectedSkill = computed(() => filtered.value.find((s) => s.id === selectedId.value) ?? null)

const loadSkill = useMutation({
  mutationFn: (id: string) => api.getSkill(id),
  onSuccess: (data) => {
    selectedId.value = data.skill.id
    editorContent.value = data.content
  },
})

const saveSkill = useMutation({
  mutationFn: () => api.saveSkill(selectedId.value!, editorContent.value),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skills'] }),
})

const createSkill = useMutation({
  mutationFn: () => api.createSkill({ name: newName.value, description: newDescription.value }),
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['skills'] })
    newName.value = ''
    newDescription.value = ''
    loadSkill.mutate(data.skill.id)
  },
})

const deleteSkill = useMutation({
  mutationFn: (id: string) => api.deleteSkill(id),
  onSuccess: () => {
    selectedId.value = null
    editorContent.value = ''
    queryClient.invalidateQueries({ queryKey: ['skills'] })
  },
})

const syncSkills = useMutation({
  mutationFn: () => api.syncSkills(),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skills'] }),
})

function sourceBadge(skill: Skill) {
  if (skill.source === 'seed') return 'info'
  if (skill.source === 'global') return 'info'
  return 'muted'
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      code="//SKL_00"
      title="SKILLS"
      description="Seed skills sync to ~/.cursor/skills/ from the control plane."
    />

    <div class="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Section id="/01" label="CATALOG">
        <div class="mb-4 flex items-center justify-between gap-2">
          <span class="text-micro text-[var(--color-dim)]">{{ filtered.length }} ENTRIES</span>
          <Button size="sm" variant="outline" :arrow="false" :disabled="syncSkills.isPending.value" @click="syncSkills.mutate()">
            SYNC SEED
          </Button>
        </div>
        <div class="mb-4 flex flex-wrap gap-1">
          <Button
            v-for="t in ['all', 'seed', 'global', 'project']"
            :key="t"
            size="sm"
            :variant="tab === t ? 'default' : 'outline'"
            :arrow="false"
            @click="tab = t as typeof tab"
          >
            {{ t.toUpperCase() }}
          </Button>
        </div>
        <div class="space-y-1 max-h-[60vh] overflow-auto">
          <button
            v-for="skill in filtered"
            :key="skill.id"
            :class="[
              'w-full text-left cybr-list-item',
              selectedId === skill.id ? 'cybr-list-item-active' : '',
            ]"
            @click="loadSkill.mutate(skill.id)"
          >
            <div class="flex items-center gap-2">
              <span class="cybr-content-title truncate font-display font-medium">{{ skill.name }}</span>
              <Badge :variant="sourceBadge(skill)">{{ skill.source }}</Badge>
            </div>
            <p class="mt-1 truncate text-micro text-[var(--color-dim)]">{{ skill.description }}</p>
          </button>
        </div>
      </Section>

      <div class="space-y-6">
        <Section v-if="selectedSkill" id="/02" label="EDITOR">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 class="cybr-content-title font-display font-medium">{{ selectedSkill.name }}</h3>
              <p class="mt-1 font-body text-micro text-[var(--color-dim)]">{{ selectedSkill.path }}</p>
            </div>
            <div class="flex gap-2">
              <Button
                v-if="selectedSkill.writable"
                size="sm"
                :arrow="false"
                :disabled="saveSkill.isPending.value"
                @click="saveSkill.mutate()"
              >
                SAVE
              </Button>
              <Button
                v-if="selectedSkill.source === 'seed'"
                size="sm"
                variant="destructive"
                :arrow="false"
                @click="deleteSkill.mutate(selectedSkill.id)"
              >
                DELETE
              </Button>
            </div>
          </div>
          <textarea
            v-model="editorContent"
            :readonly="!selectedSkill.writable"
            class="cybr-textarea"
          />
        </Section>

        <Section v-else id="/02" label="CREATE NODE">
          <div class="space-y-3">
            <input v-model="newName" placeholder="SKILL NAME" class="cybr-input" />
            <input
              v-model="newDescription"
              placeholder="TRIGGER PHRASES"
              class="cybr-input"
            />
            <Button :disabled="!newName.trim()" @click="createSkill.mutate()">CREATE IN SEED-SKILLS</Button>
          </div>
        </Section>
      </div>
    </div>
  </div>
</template>
