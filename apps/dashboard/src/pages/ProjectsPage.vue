<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import Section from '@/components/ui/Section.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import SystemMessage from '@/components/ui/SystemMessage.vue'
import BuildOverlay from '@/components/BuildOverlay.vue'
import GraphViewer from '@/components/GraphViewer.vue'
import GraphQueryPanel from '@/components/GraphQueryPanel.vue'
import { api, SCHEDULE_OPTIONS, formatTokens, formatUsd, subscribeJobEvents, type GraphJob, type Project } from '@/lib/api'

const queryClient = useQueryClient()
const githubUrl = ref('')
const githubBranch = ref('')
const viewingGraphId = ref<string | null>(null)
const actionError = ref('')
const bulkStatus = ref('')
const buildOverlay = ref({
  open: false,
  projectName: '',
  projectId: '',
  jobId: null as string | null,
  phase: 'starting' as 'starting' | 'running' | 'done' | 'error',
  errorMessage: '',
  logs: '',
})

let unsubscribeJob: (() => void) | null = null

const candidates = useQuery({ queryKey: ['candidates'], queryFn: () => api.scanCode() })
const projects = useQuery({ queryKey: ['projects'], queryFn: () => api.listProjects(), refetchInterval: 8000 })
const jobs = useQuery({
  queryKey: ['jobs'],
  queryFn: () => api.listJobs(),
  refetchInterval: () =>
    buildOverlay.value.open || projects.data.value?.projects.some((p) => p.graphStatus === 'building' || p.graphStatus === 'pending')
      ? 2000
      : 15000,
})

function shortError(message: string): string {
  const runtimeMatch = message.match(/RuntimeError: (.+)/)
  if (runtimeMatch) return runtimeMatch[1]!
  const lines = message.trim().split('\n').filter(Boolean)
  return lines[lines.length - 1] ?? message
}

function openBuildOverlay(projectName: string, projectId = '') {
  buildOverlay.value = {
    open: true,
    projectName,
    projectId,
    jobId: null,
    phase: 'starting',
    errorMessage: '',
    logs: '',
  }
}

function closeBuildOverlay() {
  buildOverlay.value.open = false
  unsubscribeJob?.()
  unsubscribeJob = null
}

function projectLastJob(projectId: string): GraphJob | undefined {
  return jobs.data.value?.jobs.find((job) => job.projectId === projectId)
}

function projectErrorSummary(project: Project): string {
  const job = projectLastJob(project.id)
  if (job?.errorMessage) return shortError(job.errorMessage)
  return 'Build failed — open log for details'
}

function showProjectError(project: Project) {
  const job = projectLastJob(project.id)
  openBuildOverlay(project.name, project.id)
  buildOverlay.value.jobId = job?.id ?? null
  buildOverlay.value.phase = 'error'
  buildOverlay.value.logs = job?.logTail ?? ''
  buildOverlay.value.errorMessage = job?.errorMessage ? shortError(job.errorMessage) : 'Build failed'
}

function trackJob(jobId: string, projectName: string, projectId: string) {
  openBuildOverlay(projectName, projectId)
  buildOverlay.value.jobId = jobId
  buildOverlay.value.phase = 'running'
  unsubscribeJob?.()
  unsubscribeJob = subscribeJobEvents(jobId, (event) => {
    if (event.message) {
      buildOverlay.value.logs += event.message + '\n'
      if (event.type === 'error') {
        buildOverlay.value.phase = 'error'
        buildOverlay.value.errorMessage = shortError(event.message)
      }
    }
    if (event.type === 'done') {
      buildOverlay.value.phase = 'done'
    }
    if (event.type === 'done' || event.type === 'error') {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['savings'] })
    }
  })
}

onBeforeUnmount(() => {
  unsubscribeJob?.()
})

const addMutation = useMutation({
  mutationFn: (path: string) => api.addProject({ path }),
  onMutate: (path) => {
    actionError.value = ''
    openBuildOverlay(path.split('/').pop() ?? 'PROJECT')
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    queryClient.invalidateQueries({ queryKey: ['candidates'] })
    trackJob(data.jobId, data.project.name, data.project.id)
  },
  onError: (e: Error) => {
    actionError.value = e.message
    buildOverlay.value.phase = 'error'
    buildOverlay.value.errorMessage = e.message
    buildOverlay.value.logs += `ERROR: ${e.message}\n`
  },
})

const cloneMutation = useMutation({
  mutationFn: () =>
    api.cloneProject({
      url: githubUrl.value.trim(),
      branch: githubBranch.value.trim() || undefined,
    }),
  onMutate: () => {
    actionError.value = ''
    openBuildOverlay(githubUrl.value.trim() || 'GITHUB REPO')
  },
  onSuccess: (data) => {
    githubUrl.value = ''
    githubBranch.value = ''
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    queryClient.invalidateQueries({ queryKey: ['candidates'] })
    viewingGraphId.value = data.project.id
    trackJob(data.jobId, data.project.name, data.project.id)
  },
  onError: (e: Error) => {
    actionError.value = e.message
    buildOverlay.value.phase = 'error'
    buildOverlay.value.errorMessage = e.message
    buildOverlay.value.logs += `ERROR: ${e.message}\n`
  },
})

const rebuildMutation = useMutation({
  mutationFn: ({ id, mode }: { id: string; mode: 'full' | 'update' }) => api.rebuildGraph(id, mode),
  onMutate: ({ id }) => {
    const project = projects.data.value?.projects.find((entry) => entry.id === id)
    openBuildOverlay(project?.name ?? 'PROJECT', id)
  },
  onSuccess: (data) => {
    const project = projects.data.value?.projects.find((entry) => entry.id === data.job.projectId)
    trackJob(data.job.id, project?.name ?? 'PROJECT', data.job.projectId)
  },
  onError: (e: Error) => {
    buildOverlay.value.phase = 'error'
    buildOverlay.value.errorMessage = e.message
    buildOverlay.value.logs += `ERROR: ${e.message}\n`
  },
})

const rebuildAllMutation = useMutation({
  mutationFn: (mode: 'full' | 'update') => api.rebuildAllGraphs(mode),
  onMutate: () => {
    actionError.value = ''
    bulkStatus.value = ''
  },
  onSuccess: (data) => {
    const skipped =
      data.skippedCount > 0 ? ` · SKIPPED ${data.skippedCount} (busy)` : ''
    bulkStatus.value = `QUEUED ${data.queuedCount}${skipped}`
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    queryClient.invalidateQueries({ queryKey: ['jobs'] })
    queryClient.invalidateQueries({ queryKey: ['savings'] })
  },
  onError: (e: Error) => {
    actionError.value = e.message
  },
})

const removeMutation = useMutation({
  mutationFn: (id: string) => api.removeProject(id),
  onSuccess: (_, id) => {
    if (viewingGraphId.value === id) viewingGraphId.value = null
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    queryClient.invalidateQueries({ queryKey: ['candidates'] })
    queryClient.invalidateQueries({ queryKey: ['savings'] })
  },
})

const patchMutation = useMutation({
  mutationFn: ({
    id,
    patch,
  }: {
    id: string
    patch: { autoRebuild?: boolean; rebuildIntervalHours?: number | null }
  }) => api.patchProject(id, patch),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
})

function statusVariant(status: string) {
  if (status === 'ready') return 'info'
  if (status === 'error') return 'error'
  if (status === 'building') return 'warning'
  return 'muted'
}

function toggleGraph(project: Project) {
  viewingGraphId.value = viewingGraphId.value === project.id ? null : project.id
}

function scheduleLabel(hours: number | null) {
  return SCHEDULE_OPTIONS.find((option) => option.value === hours)?.label ?? 'OFF'
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      code="//PRJ_00"
      title="PROJECTS"
      description="Clone GitHub repos, register local folders, and build Graphify graphs."
    />

    <SystemMessage v-if="actionError" variant="error">ERROR: {{ actionError }}</SystemMessage>

    <SystemMessage v-if="bulkStatus" variant="action">{{ bulkStatus }}</SystemMessage>

    <Section label="GITHUB GRAPH IMPORT">
      <div class="grid gap-3 md:grid-cols-[1fr_160px_auto]">
        <input
          v-model="githubUrl"
          placeholder="HTTPS://GITHUB.COM/OWNER/REPO"
          class="cybr-input"
        />
        <input v-model="githubBranch" placeholder="BRANCH (OPTIONAL)" class="cybr-input" />
        <Button
          :disabled="!githubUrl.trim() || cloneMutation.isPending.value"
          @click="cloneMutation.mutate()"
        >
          BUILD GRAPH
        </Button>
      </div>
      <SystemMessage variant="default" class="text-micro">
        SHALLOW CLONE RUNS IN TEMP STORAGE ONLY. SOURCE REPO IS DELETED AFTER graphify-out IS PERSISTED.
      </SystemMessage>
    </Section>

    <GraphQueryPanel />

    <div class="flex flex-col gap-6 xl:flex-row xl:items-start">
      <Section id="/01" label="BROWSE ~/CODE" class="w-full xl:w-80 xl:shrink-0">
        <div class="space-y-2 max-h-[70vh] overflow-auto">
          <div v-for="item in candidates.data.value?.candidates ?? []" :key="item.path" class="cybr-list-item">
            <div class="flex items-center justify-between gap-2">
              <span class="cybr-content-title font-display font-medium">{{ item.name }}</span>
              <Badge v-if="item.registered" variant="muted">REGISTERED</Badge>
            </div>
            <div class="mt-2 flex flex-wrap gap-1">
              <Badge v-if="item.isGit" variant="muted">GIT</Badge>
              <Badge v-if="item.hasPackageJson" variant="muted">NPM</Badge>
              <Badge v-if="item.hasPyproject" variant="muted">PYTHON</Badge>
            </div>
            <Button
              v-if="!item.registered"
              class="mt-3 w-full"
              size="sm"
              :disabled="addMutation.isPending.value"
              @click="addMutation.mutate(item.path)"
            >
              ADD + BUILD
            </Button>
          </div>
        </div>
      </Section>

      <Section id="/02" label="REGISTERED NODES" class="min-w-0 flex-1">
          <div v-if="!projects.data.value?.projects.length">
            <SystemMessage variant="default">NO PROJECTS REGISTERED.</SystemMessage>
          </div>

          <div v-else class="space-y-4">
            <div class="flex flex-wrap gap-2">
              <Button
                size="sm"
                :arrow="false"
                :disabled="rebuildAllMutation.isPending.value"
                @click="rebuildAllMutation.mutate('full')"
              >
                REBUILD ALL (FULL)
              </Button>
              <Button
                size="sm"
                variant="outline"
                :arrow="false"
                :disabled="rebuildAllMutation.isPending.value"
                @click="rebuildAllMutation.mutate('update')"
              >
                REBUILD ALL (UPDATE)
              </Button>
            </div>
            <div
              v-for="project in projects.data.value?.projects ?? []"
              :key="project.id"
              class="cybr-list-item overflow-hidden p-0"
            >
              <div class="p-4">
                <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="cybr-content-title font-display font-medium">{{ project.name }}</h3>
                    <Badge :variant="statusVariant(project.graphStatus)">{{ project.graphStatus }}</Badge>
                    <Badge v-if="project.sourceType === 'github'" variant="info">GITHUB</Badge>
                  </div>
                  <p class="mt-1 truncate font-body text-micro text-[var(--color-dim)]">
                    {{ project.sourceType === 'github' ? project.githubUrl : project.path }}
                  </p>
                  <div
                    v-if="project.graphStatus === 'error'"
                    class="mt-3 flex flex-wrap items-center gap-3 border border-[var(--color-danger)] px-3 py-2"
                  >
                    <p class="text-small text-[var(--color-danger)]">{{ projectErrorSummary(project) }}</p>
                    <Button size="sm" variant="outline" :arrow="false" @click="showProjectError(project)">
                      VIEW LOG
                    </Button>
                    <Button
                      size="sm"
                      :arrow="false"
                      @click="rebuildMutation.mutate({ id: project.id, mode: 'full' })"
                    >
                      RETRY
                    </Button>
                  </div>
                  <p
                    v-else-if="project.graphStatus === 'building' || project.graphStatus === 'pending'"
                    class="mt-2 text-small text-[var(--color-subtle)]"
                  >
                    <span class="text-[var(--color-dim)]">&gt;</span> Graph build in progress...
                  </p>
                  <p class="mt-2 text-small text-[var(--color-subtle)]">
                    Alias <span class="text-[var(--color-white)]">{{ project.alias }}</span>
                    · {{ project.graphNodeCount }} nodes
                    <span v-if="project.lastBuiltAt">
                      · BUILT {{ new Date(project.lastBuiltAt).toLocaleString() }}
                    </span>
                  </p>
                  <p class="mt-2 text-micro text-[var(--color-dim)]">
                    SAVED {{ formatTokens(project.totalTokensSaved) }} TOK ({{ formatUsd(project.totalCostSavedUsd) }})
                    · USED {{ formatTokens(project.totalTokensUsed) }} TOK ({{ formatUsd(project.totalCostUsedUsd) }})
                  </p>

                  <div class="mt-4 flex flex-wrap items-center gap-3">
                    <label v-if="project.sourceType === 'local'" class="cybr-radio">
                      <input
                        type="checkbox"
                        :checked="project.autoRebuild"
                        @change="
                          patchMutation.mutate({
                            id: project.id,
                            patch: { autoRebuild: ($event.target as HTMLInputElement).checked },
                          })
                        "
                      />
                      AUTO WATCH
                    </label>
                    <div class="flex flex-wrap gap-1">
                      <Button
                        v-for="option in SCHEDULE_OPTIONS"
                        :key="String(option.value)"
                        size="sm"
                        :variant="project.rebuildIntervalHours === option.value ? 'default' : 'outline'"
                        :arrow="false"
                        @click="
                          patchMutation.mutate({
                            id: project.id,
                            patch: { rebuildIntervalHours: option.value },
                          })
                        "
                      >
                        {{ option.label }}
                      </Button>
                    </div>
                    <span class="text-micro text-[var(--color-dim)]">
                      {{ project.sourceType === 'github' ? 'REMOTE REBUILD' : 'SCHED' }}:
                      {{ scheduleLabel(project.rebuildIntervalHours) }}
                    </span>
                  </div>
                </div>

                <div class="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    :arrow="false"
                    @click="rebuildMutation.mutate({ id: project.id, mode: project.sourceType === 'github' ? 'full' : 'update' })"
                  >
                    {{ project.sourceType === 'github' ? 'REFETCH' : 'UPDATE' }}
                  </Button>
                  <Button size="sm" :arrow="false" @click="rebuildMutation.mutate({ id: project.id, mode: 'full' })">
                    REBUILD
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    :arrow="false"
                    :disabled="project.graphStatus !== 'ready'"
                    @click="toggleGraph(project)"
                  >
                    {{ viewingGraphId === project.id ? 'HIDE GRAPH' : 'VIEW GRAPH' }}
                  </Button>
                  <Button size="sm" variant="destructive" :arrow="false" @click="removeMutation.mutate(project.id)">
                    REMOVE
                  </Button>
                </div>
              </div>
              </div>

              <GraphViewer
                v-if="viewingGraphId === project.id && project.graphStatus === 'ready'"
                embedded
                :project-id="project.id"
              />
            </div>
          </div>
        </Section>
    </div>

    <BuildOverlay
      :open="buildOverlay.open"
      :project-name="buildOverlay.projectName"
      :phase="buildOverlay.phase"
      :error-message="buildOverlay.errorMessage"
      :logs="buildOverlay.logs"
      @close="closeBuildOverlay"
    />
  </div>
</template>
