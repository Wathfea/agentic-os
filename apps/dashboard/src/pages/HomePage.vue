<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { CircleHelp, Moon, Play, Plus, Sparkles } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import DockPanel from '@/components/DockPanel.vue'
import SystemMessage from '@/components/ui/SystemMessage.vue'
import CommandSphere from '@/components/CommandSphere.vue'
import { api, formatBriefingTime } from '@/lib/api'
import {
  REMOTE_ZONES,
  clockHands,
  formatHero,
  formatZone,
  googleCalendarUrl,
  upcomingEvents,
  yearQuarters,
} from '@/lib/calendar'
import { ORBIT_ITEMS } from '@/lib/orbit'
import { useDockLayout } from '@/lib/useDockLayout'

const queryClient = useQueryClient()
const { layout, hidden, labels, close, open, raise, move, resize } = useDockLayout()
const now = ref(new Date())
let clockTimer: ReturnType<typeof setInterval> | undefined
const connectError = ref<string | null>(null)
const connectPending = ref(false)
const disconnectPending = ref(false)
const refreshPending = ref(false)
const flashMessage = ref<string | null>(null)
const autoRefreshAttempted = ref(false)
const mixError = ref<string | null>(null)
const mixBusy = ref(false)
const telegramToken = ref('')
const telegramChatId = ref('')
const telegramHelpOpen = ref(false)
const mixCron = ref('30 7 * * *')
const sourceUrl = ref('')

const projects = useQuery({ queryKey: ['projects'], queryFn: () => api.listProjects() })
const skills = useQuery({ queryKey: ['skills'], queryFn: () => api.listSkills() })
const morningMix = useQuery({
  queryKey: ['mix'],
  queryFn: () => api.mixStatus(),
  refetchInterval: 30000,
})
const briefing = useQuery({
  queryKey: ['briefing-status'],
  queryFn: () => api.briefingStatus(),
  refetchInterval: 30000,
})
const calendarFeed = useQuery({
  queryKey: ['briefing-calendar'],
  queryFn: () => api.briefingCalendar(),
  refetchInterval: 5 * 60 * 1000,
  enabled: computed(() => briefing.data.value?.briefing.connection.status === 'connected'),
})

const briefingData = computed(() => briefing.data.value?.briefing)
const briefingConnection = computed(() => briefingData.value?.connection)
const briefingState = computed(() => briefingData.value?.briefing)
const actionItems = computed(() => briefingData.value?.actionItems ?? [])
const summaryLines = computed(() => briefingState.value?.summary ?? [])

const sortedActionItems = computed(() => {
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
  return [...actionItems.value].sort((a, b) => {
    const pa = priorityOrder[a.priority ?? ''] ?? 1
    const pb = priorityOrder[b.priority ?? ''] ?? 1
    if (pa !== pb) return pa - pb
    if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    if (a.dueAt) return -1
    if (b.dueAt) return 1
    return 0
  })
})

const flaggedItems = computed(() => sortedActionItems.value.slice(0, 3))

const isBriefingStale = computed(() => {
  const status = briefingState.value?.status
  return status === 'stale' || status === 'fetch_failed' || status === 'summarization_failed'
})

const connectionLabel = computed(() => {
  const status = briefingConnection.value?.status ?? 'disconnected'
  if (status === 'connected') return briefingConnection.value?.email ?? 'CONNECTED'
  if (status === 'expired') return 'EXPIRED'
  return 'DISCONNECTED'
})

const operatorLine = computed(() => {
  const email = briefingConnection.value?.status === 'connected' ? briefingConnection.value.email : null
  const ready = projects.data.value?.projects.find((p) => p.graphStatus === 'ready')
  if (email && ready) return `${email}  |  ${ready.name}`
  if (email) return email
  if (ready) return ready.name
  return 'Control plane'
})

const graphProjectId = computed(
  () => projects.data.value?.projects.find((p) => p.graphStatus === 'ready')?.id ?? '',
)

const canConnect = computed(
  () => briefingConnection.value?.googleConfigured && briefingConnection.value?.status !== 'connected',
)

const canDisconnect = computed(
  () =>
    briefingConnection.value?.status === 'connected' || briefingConnection.value?.status === 'expired',
)

const canRefresh = computed(
  () => briefingConnection.value?.status === 'connected' && !refreshPending.value && !briefingState.value?.refreshing,
)

const emailCount = computed(() => actionItems.value.length || summaryLines.value.length)

const calendarHero = computed(() => formatHero(now.value))
const calendarHands = computed(() => clockHands(now.value))
const calendarZones = computed(() =>
  REMOTE_ZONES.map((zone) => formatZone(now.value, zone.label, zone.timeZone)),
)
const calendarQuarters = computed(() => yearQuarters(now.value))
const calendarEvents = computed(() =>
  upcomingEvents(
    calendarFeed.data.value?.calendarEvents ?? briefingData.value?.calendarEvents ?? [],
    now.value,
  ),
)
const calendarHref = computed(() => googleCalendarUrl(calendarEvents.value[0]?.link))

const mix = computed(() => {
  const items = actionItems.value
  const high = items.filter((i) => i.priority === 'high').length
  const mail = items.filter((i) => i.sourceType === 'gmail_thread').length
  const cal = items.filter((i) => i.sourceType === 'calendar_event').length
  const other = Math.max(summaryLines.value.length, items.length - high)
  const segs = [
    { id: 'high', label: 'HIGH', value: high, color: '#f26b1a' },
    { id: 'mail', label: 'MAIL', value: mail, color: '#d9d9d9' },
    { id: 'cal', label: 'CAL', value: cal, color: '#8a8a8a' },
    { id: 'other', label: 'OTHER', value: other, color: '#3d3d3d' },
  ]
  const total = segs.reduce((sum, s) => sum + s.value, 0)
  return { segs, total }
})

const deckSkills = computed(() => (skills.data.value?.skills ?? []).slice(0, 4))

const mixOverview = computed(() => morningMix.data.value?.mix)
const mixSources = computed(() => mixOverview.value?.sources ?? [])

watch(
  () => mixOverview.value?.mix.cron,
  (cron) => {
    if (cron) mixCron.value = cron
  },
)

watch(
  () => mixOverview.value?.telegram.chatId,
  (chatId) => {
    if (chatId && !mixOverview.value?.telegram.connected) return
    if (chatId) telegramChatId.value = chatId
  },
)

async function refreshMix() {
  await queryClient.invalidateQueries({ queryKey: ['mix'] })
}

async function withMix(fn: () => Promise<unknown>): Promise<boolean> {
  mixBusy.value = true
  mixError.value = null
  try {
    await fn()
    await refreshMix()
    return true
  } catch (err) {
    mixError.value = err instanceof Error ? err.message : 'Mix request failed'
    return false
  } finally {
    mixBusy.value = false
  }
}

async function saveTelegram() {
  const ok = await withMix(() =>
    api.saveTelegram({ botToken: telegramToken.value.trim(), chatId: telegramChatId.value.trim() }),
  )
  if (ok) telegramToken.value = ''
}

async function addSource() {
  const url = sourceUrl.value.trim()
  if (!url) return
  const ok = await withMix(() => api.addMixSource(url))
  if (ok) sourceUrl.value = ''
}

function formatNextRun(unix: number | null) {
  if (!unix) return '--:--'
  return new Date(unix * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatAgo(value: string | null) {
  if (!value) return ''
  const ms = Date.now() - new Date(value).getTime()
  if (Number.isNaN(ms)) return ''
  const mins = Math.max(1, Math.floor(ms / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function readBriefingFlashFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const result = params.get('briefing')
  if (!result) return

  if (result === 'connected') {
    flashMessage.value = 'Google Workspace connected.'
  } else if (result === 'error') {
    const reason = params.get('reason') ?? 'unknown'
    flashMessage.value = `Google connection failed: ${reason}`
  }

  params.delete('briefing')
  params.delete('reason')
  const next = params.toString()
  const nextUrl = next ? `${window.location.pathname}?${next}` : window.location.pathname
  window.history.replaceState({}, '', nextUrl)
}

async function connectGoogle() {
  connectError.value = null
  connectPending.value = true
  try {
    const { connect } = await api.briefingConnect()
    window.location.href = connect.authUrl
  } catch (err) {
    connectError.value = err instanceof Error ? err.message : 'Connect failed'
  } finally {
    connectPending.value = false
  }
}

async function disconnectGoogle() {
  disconnectPending.value = true
  try {
    await api.briefingDisconnect()
    await queryClient.invalidateQueries({ queryKey: ['briefing-status'] })
    flashMessage.value = 'Google Workspace disconnected.'
  } catch (err) {
    connectError.value = err instanceof Error ? err.message : 'Disconnect failed'
  } finally {
    disconnectPending.value = false
  }
}

async function refreshBriefing(force = false) {
  if (!force && refreshPending.value) return
  refreshPending.value = true
  connectError.value = null
  try {
    await api.briefingRefresh()
    await queryClient.invalidateQueries({ queryKey: ['briefing-status'] })
  } catch (err) {
    connectError.value = err instanceof Error ? err.message : 'Briefing refresh failed'
    await queryClient.invalidateQueries({ queryKey: ['briefing-status'] })
  } finally {
    refreshPending.value = false
  }
}

async function dismissActionItem(id: string) {
  await api.briefingDismissActionItem(id)
  await queryClient.invalidateQueries({ queryKey: ['briefing-status'] })
}

async function doneActionItem(id: string) {
  await api.briefingDoneActionItem(id)
  await queryClient.invalidateQueries({ queryKey: ['briefing-status'] })
}

watch(
  briefingData,
  (data) => {
    if (!data || autoRefreshAttempted.value || refreshPending.value) return
    if (data.connection.status !== 'connected') return
    if (!data.stale && data.briefing.summary.length > 0) return
    autoRefreshAttempted.value = true
    refreshBriefing()
  },
  { immediate: true },
)

onMounted(() => {
  readBriefingFlashFromUrl()
  if (flashMessage.value?.includes('connected')) {
    queryClient.invalidateQueries({ queryKey: ['briefing-status'] })
  }
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})
</script>

<template>
  <div class="command-home">
    <CommandSphere :project-id="graphProjectId" :subtitle="operatorLine" :items="ORBIT_ITEMS" />

    <div v-if="hidden.length" class="command-panel-tray">
      <button
        v-for="id in hidden"
        :key="id"
        type="button"
        class="command-panel-tray__btn"
        @click="open(id)"
      >
        <Plus :size="11" :stroke-width="2" />
        {{ labels[id] }}
      </button>
    </div>

    <DockPanel
      v-if="layout.calendar.open"
      :label="labels.calendar"
      :x="layout.calendar.x"
      :y="layout.calendar.y"
      :w="layout.calendar.w"
      :h="layout.calendar.h"
      :z="layout.calendar.z"
      @close="close('calendar')"
      @raise="raise('calendar')"
      @move="(x, y) => move('calendar', x, y)"
      @resize="(w, h) => resize('calendar', w, h)"
    >
      <section class="rail-block cal-block">
        <header class="rail-head">
          <span class="rail-meta">today</span>
          <a class="cal-open" :href="calendarHref" target="_blank" rel="noreferrer">Open cal</a>
        </header>

        <div class="cal-hero">
          <svg class="cal-face" viewBox="0 0 72 72" aria-hidden="true">
            <circle cx="36" cy="36" r="33" />
            <line
              class="cal-hand cal-hand--hour"
              x1="36"
              y1="36"
              x2="36"
              y2="18"
              :style="{ transform: `rotate(${calendarHands.hourDeg}deg)` }"
            />
            <line
              class="cal-hand cal-hand--minute"
              x1="36"
              y1="36"
              x2="36"
              y2="12"
              :style="{ transform: `rotate(${calendarHands.minuteDeg}deg)` }"
            />
            <line
              class="cal-hand cal-hand--second"
              x1="36"
              y1="36"
              x2="36"
              y2="10"
              :style="{ transform: `rotate(${calendarHands.secondDeg}deg)` }"
            />
            <circle cx="36" cy="36" r="3" class="cal-face__hub" />
          </svg>
          <div class="cal-hero__copy">
            <p class="cal-week">{{ calendarHero.weekLabel }} <span>| {{ calendarHero.dateLabel }}</span></p>
            <p class="cal-time">{{ calendarHero.timeLabel }}</p>
            <p class="cal-zone">{{ calendarHero.zoneLabel }}</p>
          </div>
        </div>

        <div class="cal-zones">
          <div v-for="zone in calendarZones" :key="zone.id" class="cal-zone-card">
            <span class="cal-zone-card__label">
              {{ zone.label }}
              <Moon v-if="zone.night" :size="11" :stroke-width="1.8" />
            </span>
            <strong>{{ zone.time }}</strong>
            <em>({{ zone.day }})</em>
          </div>
        </div>

        <div class="cal-year">
          <div v-for="quarter in calendarQuarters" :key="quarter.id" class="cal-year__row">
            <span>{{ quarter.id }}</span>
            <ol>
              <li
                v-for="week in quarter.weeks"
                :key="week.week"
                :class="`cal-dot cal-dot--${week.state}`"
              />
            </ol>
          </div>
        </div>

        <p class="mix-label">What's next</p>
        <ul v-if="calendarEvents.length" class="cal-next">
          <li v-for="event in calendarEvents" :key="event.id">
            <a v-if="event.link" :href="event.link" target="_blank" rel="noreferrer">{{ event.title }}</a>
            <span v-else>{{ event.title }}</span>
            <time>{{ event.time }}</time>
          </li>
        </ul>
        <p v-else class="rail-empty">{{ connectionLabel === 'DISCONNECTED' ? 'Connect Google' : 'No upcoming events' }}</p>
      </section>
    </DockPanel>

    <DockPanel
      v-if="layout.email.open"
      :label="labels.email"
      :x="layout.email.x"
      :y="layout.email.y"
      :w="layout.email.w"
      :h="layout.email.h"
      :z="layout.email.z"
      @close="close('email')"
      @raise="raise('email')"
      @move="(x, y) => move('email', x, y)"
      @resize="(w, h) => resize('email', w, h)"
    >
      <section class="rail-block">
        <header class="rail-head">
          <span class="rail-meta">Synced {{ formatAgo(briefingState?.lastUpdatedAt ?? null) || '—' }} ago</span>
        </header>

        <div class="email-hero">
          <span class="email-count">{{ emailCount || '—' }}</span>
          <span class="email-count-label">{{ actionItems.length ? 'open items' : 'past 24h' }}</span>
        </div>

        <SystemMessage v-if="flashMessage" variant="success">{{ flashMessage }}</SystemMessage>
        <SystemMessage v-if="connectError" variant="error">{{ connectError }}</SystemMessage>
        <SystemMessage
          v-else-if="briefingState?.statusMessage"
          :variant="isBriefingStale ? 'action' : 'default'"
        >
          {{ briefingState.statusMessage }}
        </SystemMessage>

        <div class="rail-actions">
          <Button
            v-if="canRefresh"
            size="sm"
            :variant="isBriefingStale ? 'default' : 'outline'"
            :arrow="false"
            :disabled="refreshPending || briefingState?.refreshing"
            @click="refreshBriefing(true)"
          >
            {{ refreshPending || briefingState?.refreshing ? 'REFRESHING...' : 'REFRESH' }}
          </Button>
          <Button v-if="canConnect" size="sm" :arrow="false" :disabled="connectPending" @click="connectGoogle">
            {{ connectPending ? 'CONNECTING...' : 'CONNECT GOOGLE' }}
          </Button>
          <Button
            v-if="canDisconnect"
            size="sm"
            variant="outline"
            :arrow="false"
            :disabled="disconnectPending"
            @click="disconnectGoogle"
          >
            {{ disconnectPending ? 'DISCONNECTING...' : 'DISCONNECT' }}
          </Button>
        </div>

        <p v-if="flaggedItems.length" class="flag-label">Flagged · needs you</p>
        <ul v-if="flaggedItems.length" class="flag-list">
          <li v-for="item in flaggedItems" :key="item.id" class="flag-row">
            <span class="flag-mark" :class="item.priority === 'high' ? 'flag-mark--hot' : ''" />
            <span class="flag-title">{{ item.title }}</span>
            <span class="flag-age">{{ formatAgo(item.dueAt ?? briefingState?.lastUpdatedAt ?? null) }}</span>
            <span class="flag-acts">
              <button type="button" @click="doneActionItem(item.id)">Done</button>
              <button type="button" @click="dismissActionItem(item.id)">Skip</button>
            </span>
          </li>
        </ul>
        <p v-else class="rail-empty">{{ connectionLabel }}</p>

        <p class="mix-label">Today's mix</p>
        <div class="mix-track" aria-hidden="true">
          <span
            v-for="seg in mix.segs"
            :key="seg.id"
            class="mix-seg"
            :style="{ flexGrow: mix.total ? seg.value : 1, background: seg.color }"
          />
        </div>
        <div class="mix-legend">
          <span v-for="seg in mix.segs" :key="seg.id">
            <i :style="{ background: seg.color }" />
            {{ seg.value }} {{ seg.label }}
          </span>
        </div>

        <p v-if="briefingConnection?.email" class="sync-line">
          <span class="sync-dot" />
          Synced {{ formatBriefingTime(briefingState?.lastUpdatedAt ?? null) }} · {{ briefingConnection.email }}
        </p>
      </section>
    </DockPanel>

    <DockPanel
      v-if="layout.skills.open"
      :label="labels.skills"
      :x="layout.skills.x"
      :y="layout.skills.y"
      :w="layout.skills.w"
      :h="layout.skills.h"
      :z="layout.skills.z"
      @close="close('skills')"
      @raise="raise('skills')"
      @move="(x, y) => move('skills', x, y)"
      @resize="(w, h) => resize('skills', w, h)"
    >
      <section class="rail-block">
        <header class="rail-head">
          <RouterLink to="/skills" class="rail-add"><Plus :size="11" :stroke-width="2" /> Add skill</RouterLink>
        </header>
        <div class="skill-grid">
          <RouterLink v-for="skill in deckSkills" :key="skill.id" to="/skills" class="skill-card">
            <div class="skill-card__top">
              <Sparkles :size="14" :stroke-width="1.5" />
              <span class="skill-name">/{{ skill.name }}</span>
            </div>
            <p class="skill-src">{{ skill.source }}</p>
            <span class="skill-play" aria-hidden="true"><Play :size="11" :stroke-width="2.2" fill="currentColor" /></span>
          </RouterLink>
          <RouterLink v-if="!deckSkills.length" to="/skills" class="skill-card skill-card--empty">
            <span class="skill-name">No skills yet</span>
            <p class="skill-src">Open catalog</p>
          </RouterLink>
        </div>
      </section>
    </DockPanel>

    <DockPanel
      v-if="layout.routines.open"
      :label="labels.routines"
      :x="layout.routines.x"
      :y="layout.routines.y"
      :w="layout.routines.w"
      :h="layout.routines.h"
      :z="layout.routines.z"
      @close="close('routines')"
      @raise="raise('routines')"
      @move="(x, y) => move('routines', x, y)"
      @resize="(w, h) => resize('routines', w, h)"
    >
      <section class="rail-block mix-form">
        <header class="rail-head">
          <span class="rail-meta">
            next {{ formatNextRun(mixOverview?.mix.nextRunAt ?? null) }}
            · {{ mixOverview?.mix.lastStatus ?? 'idle' }}
          </span>
        </header>
        <SystemMessage v-if="mixError" variant="error">{{ mixError }}</SystemMessage>
        <SystemMessage v-if="mixOverview?.mix.lastError" variant="error">{{ mixOverview.mix.lastError }}</SystemMessage>

        <div class="mix-telegram">
          <div class="mix-telegram__head">
            <p class="mix-label">Telegram</p>
            <button
              type="button"
              class="mix-help__toggle"
              :class="{ 'mix-help__toggle--on': telegramHelpOpen }"
              :aria-expanded="telegramHelpOpen"
              aria-controls="telegram-setup-help"
              aria-label="How to set up Telegram"
              @click="telegramHelpOpen = !telegramHelpOpen"
            >
              <CircleHelp :size="13" :stroke-width="1.8" />
            </button>
          </div>
          <div v-if="telegramHelpOpen" id="telegram-setup-help" class="mix-help">
            <p>Agentic OS sends Morning mix to this chat. It does not read replies.</p>
            <ol>
              <li>Open <strong>@BotFather</strong> in Telegram and send <code>/newbot</code>. Copy the HTTP API token.</li>
              <li>Open the new bot and tap <strong>Start</strong>.</li>
              <li>
                Send it any message, then open
                <code>https://api.telegram.org/bot&lt;&lt;TOKEN&gt;&gt;/getUpdates</code>
                and copy <code>chat.id</code>.
              </li>
              <li>Paste the token and chat id here, then Save Telegram. You can also do this during install.</li>
              <li>Click Test. A short confirmation should appear in that chat.</li>
            </ol>
          </div>
          <template v-if="!mixOverview?.telegram.connected">
            <input v-model="telegramToken" type="password" placeholder="Bot token" autocomplete="off" />
            <input v-model="telegramChatId" type="text" placeholder="Chat id" />
            <div class="rail-actions">
              <Button size="sm" :arrow="false" :disabled="mixBusy" @click="saveTelegram">SAVE TELEGRAM</Button>
            </div>
          </template>
          <template v-else>
            <p class="rail-meta">chat {{ mixOverview.telegram.chatId }}</p>
            <div class="rail-actions">
              <Button size="sm" variant="outline" :arrow="false" :disabled="mixBusy" @click="withMix(() => api.testTelegram())">
                TEST
              </Button>
              <Button size="sm" variant="outline" :arrow="false" :disabled="mixBusy" @click="withMix(() => api.disconnectTelegram())">
                DISCONNECT
              </Button>
            </div>
          </template>
        </div>

        <label class="mix-toggle">
          <input
            type="checkbox"
            :checked="mixOverview?.mix.enabled ?? false"
            :disabled="mixBusy || !mixOverview?.telegram.connected"
            @change="withMix(() => api.saveMix({ enabled: ($event.target as HTMLInputElement).checked }))"
          />
          Morning mix
        </label>
        <div class="mix-form__row">
          <input v-model="mixCron" type="text" placeholder="30 7 * * *" />
          <Button size="sm" variant="outline" :arrow="false" :disabled="mixBusy" @click="withMix(() => api.saveMix({ cron: mixCron }))">
            CRON
          </Button>
        </div>
        <div class="rail-actions">
          <Button
            size="sm"
            :arrow="false"
            :disabled="mixBusy || !mixOverview?.telegram.connected || mixOverview?.mix.running"
            @click="withMix(() => api.runMix())"
          >
            {{ mixOverview?.mix.running ? 'RUNNING...' : 'RUN NOW' }}
          </Button>
        </div>

        <p class="mix-label">Sources</p>
        <div v-for="source in mixSources" :key="source.id" class="mix-source">
          <span>{{ source.title }}</span>
          <button type="button" :disabled="mixBusy" @click="withMix(() => api.deleteMixSource(source.id))">Remove</button>
        </div>
        <p v-if="!mixSources.length" class="rail-empty">Add a YouTube channel id or @handle.</p>
        <div class="mix-form__row">
          <input v-model="sourceUrl" type="text" placeholder="UC… or @channel" />
          <Button size="sm" :arrow="false" :disabled="mixBusy || !sourceUrl.trim()" @click="addSource">ADD</Button>
        </div>
      </section>
    </DockPanel>
  </div>
</template>
