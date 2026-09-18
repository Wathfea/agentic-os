<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import Section from '@/components/ui/Section.vue'
import Button from '@/components/ui/Button.vue'
import SystemMessage from '@/components/ui/SystemMessage.vue'
import HackTerminal from '@/components/HackTerminal.vue'
import { api, askCursor, GRAPH_QUERY_EXAMPLES } from '@/lib/api'

const question = ref('')
const queryMode = ref<'graph' | 'cursor'>('graph')
const scope = ref<'global' | 'project'>('global')
const projectId = ref('')
const result = ref('')
const terminalLines = ref<string[]>([])
const terminalActive = ref(false)

const projects = useQuery({ queryKey: ['projects'], queryFn: () => api.listProjects() })
const globalGraph = useQuery({ queryKey: ['global-graph'], queryFn: () => api.globalGraph() })

const canSubmit = computed(() => {
  if (!question.value.trim()) return false
  if (scope.value === 'project' && !projectId.value) return false
  if (queryMode.value === 'cursor' && scope.value !== 'project') return false
  return true
})

watch(queryMode, (mode) => {
  if (mode === 'cursor') scope.value = 'project'
})

watch(scope, (value) => {
  if (value === 'global') projectId.value = ''
})

const queryMutation = useMutation({
  mutationFn: async () => {
    result.value = ''
    terminalLines.value = []
    terminalActive.value = false

    if (queryMode.value === 'cursor') {
      terminalActive.value = true
      return askCursor(
        {
          question: question.value,
          scope: 'project',
          projectId: projectId.value,
        },
        (event) => {
          if (event.type === 'boot' || event.type === 'graph') {
            if (event.message) terminalLines.value.push(`> ${event.message.split('\n')[0]}`)
          }
          if (event.type === 'log' && event.message) {
            terminalLines.value.push(`> ${event.message}`)
          }
          if (event.type === 'delta' && event.delta) {
            result.value += event.delta
          }
          if (event.type === 'error' && event.message) {
            terminalLines.value.push(`ERROR: ${event.message}`)
          }
        },
      )
    }

    const data = await api.queryGraph({
      question: question.value,
      scope: scope.value,
      projectId: scope.value === 'project' ? projectId.value : undefined,
    })
    return data.result.output
  },
  onSuccess: (output) => {
    terminalActive.value = false
    if (queryMode.value === 'graph') {
      result.value = output
    } else if (!result.value) {
      result.value = output
    }
  },
  onError: (e: Error) => {
    terminalActive.value = false
    result.value = e.message
    terminalLines.value.push(`ERROR: ${e.message}`)
  },
})

function applyExample(example: string) {
  question.value = example
}
</script>

<template>
  <div class="space-y-6 max-w-5xl">
    <Section label="EXAMPLE QUERIES">
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="example in GRAPH_QUERY_EXAMPLES"
          :key="example"
          size="sm"
          variant="outline"
          :arrow="false"
          @click="applyExample(example)"
        >
          {{ example.length > 42 ? `${example.slice(0, 42)}…` : example }}
        </Button>
      </div>
    </Section>

    <Section id="/01" label="QUERY INTERFACE">
      <div class="space-y-4">
        <div class="flex flex-wrap gap-2">
          <Button
            size="sm"
            :variant="queryMode === 'graph' ? 'default' : 'outline'"
            :arrow="false"
            @click="queryMode = 'graph'"
          >
            GRAPH QUERY
          </Button>
          <Button
            size="sm"
            :variant="queryMode === 'cursor' ? 'default' : 'outline'"
            :arrow="false"
            @click="queryMode = 'cursor'"
          >
            CURSOR HEADLESS
          </Button>
        </div>

        <div v-if="queryMode === 'graph'" class="flex flex-wrap gap-6">
          <label class="cybr-radio">
            <input v-model="scope" type="radio" value="global" />
            GLOBAL
          </label>
          <label class="cybr-radio">
            <input v-model="scope" type="radio" value="project" />
            PROJECT
          </label>
        </div>

        <SystemMessage variant="default" class="text-micro">
          CURSOR ASK RUNS IN READ-ONLY MODE WITH GRAPH CONTEXT. PROJECT SCOPE REQUIRED.
        </SystemMessage>

        <select
          v-if="scope === 'project' || queryMode === 'cursor'"
          v-model="projectId"
          class="cybr-select"
        >
          <option value="" disabled>SELECT PROJECT</option>
          <option v-for="p in projects.data.value?.projects ?? []" :key="p.id" :value="p.id">
            {{ p.name }} ({{ p.alias }}) — {{ p.graphStatus }}
            {{ p.sourceType === 'github' ? ' [REMOTE]' : '' }}
          </option>
        </select>

        <input
          v-model="question"
          placeholder="ENTER QUERY"
          class="cybr-input"
          @keydown.enter="canSubmit && !queryMutation.isPending.value && queryMutation.mutate()"
        />

        <Button
          :disabled="!canSubmit || queryMutation.isPending.value"
          @click="queryMutation.mutate()"
        >
          {{ queryMode === 'cursor' ? 'ASK CURSOR' : 'QUERY GRAPH' }}
        </Button>
      </div>
    </Section>

    <Section v-if="terminalActive || terminalLines.length" label="AGENT TERMINAL">
      <HackTerminal :active="terminalActive" :lines="terminalLines" />
    </Section>

    <Section v-if="result" label="OUTPUT">
      <pre class="cybr-log max-h-none">{{ result }}</pre>
    </Section>

    <Section id="/02" label="GLOBAL REGISTRY">
      <pre class="font-body text-micro text-[var(--color-subtle)] whitespace-pre-wrap">{{
        globalGraph.data.value?.raw || 'LOADING...'
      }}</pre>
    </Section>
  </div>
</template>
