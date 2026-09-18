#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const STORE_DIR = join(REPO_ROOT, 'store')
const CONFIG_PATH = join(STORE_DIR, 'agentic.config.json')
const DB_PATH = join(STORE_DIR, 'agentic.db')
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

const CUSTOM_LABELS = [
  { name: 'Newsletters', color: { backgroundColor: '#4986e7', textColor: '#ffffff' } },
  { name: 'Shopping', color: { backgroundColor: '#ffad47', textColor: '#000000' } },
  { name: 'Dev-Alerts', color: { backgroundColor: '#16a766', textColor: '#ffffff' } },
  { name: 'Finance', color: { backgroundColor: '#a479e2', textColor: '#ffffff' } },
  { name: 'Travel', color: { backgroundColor: '#42d692', textColor: '#000000' } },
  { name: 'Social', color: { backgroundColor: '#fb4c2f', textColor: '#ffffff' } },
]

const FILTER_RULES = [
  { label: 'Shopping', from: '@petchef.hu' },
  { label: 'Shopping', from: '@send.vasbutor.hu' },
  { label: 'Shopping', from: '@orders.temu.com' },
  { label: 'Shopping', from: '@marketing.ryanairemail.com' },
  { label: 'Shopping', from: '@bolt.eu' },
  { label: 'Shopping', from: '@alza.hu' },
  { label: 'Shopping', from: '@tropicfeel.com' },
  { label: 'Shopping', from: '@naturalszepseg.hu' },
  { label: 'Shopping', from: '@hasznaltauto.hu' },
  { label: 'Shopping', from: '@one.hu' },
  { label: 'Shopping', from: '@simple.hu' },
  { label: 'Finance', from: '@szamlazz.hu' },
  { label: 'Dev-Alerts', from: '@getpicasso.com' },
  { label: 'Travel', from: '@loyalty.qatarairways.com' },
  { label: 'Travel', from: '@promo.airasia.com' },
  { label: 'Travel', from: '@szallas.hu' },
  { label: 'Dev-Alerts', from: '@expo.dev' },
  { label: 'Dev-Alerts', from: '@md.getsentry.com' },
  { label: 'Dev-Alerts', from: '@discord.com' },
  { label: 'Dev-Alerts', from: '@flutterflow.io' },
  { label: 'Finance', from: '@wise.com' },
  { label: 'Finance', from: 'payments-noreply@google.com' },
  { label: 'Social', from: '@linkedin.com' },
  { label: 'Newsletters', query: 'list:(<)' },
]

const CLEANUP_QUERIES = [
  { name: 'promotions >14d', query: 'category:promotions is:unread older_than:14d' },
  { name: 'updates >14d', query: 'category:updates is:unread older_than:14d' },
  { name: 'social >14d', query: 'category:social is:unread older_than:14d' },
  { name: 'forums >14d', query: 'category:forums is:unread older_than:14d' },
  { name: 'newsletters >7d', query: 'list:(<) is:unread older_than:7d' },
  { name: 'shopping senders >7d', query: 'is:unread older_than:7d (from:@petchef.hu OR from:@send.vasbutor.hu OR from:@orders.temu.com OR from:@marketing.ryanairemail.com OR from:@bolt.eu OR from:@alza.hu OR from:@hasznaltauto.hu)' },
]

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) throw new Error(`Missing ${CONFIG_PATH}`)
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
}

function loadDb() {
  if (!existsSync(DB_PATH)) throw new Error(`Missing ${DB_PATH}`)
  return new Database(DB_PATH)
}

async function refreshTokenIfNeeded(db, config) {
  const conn = db.prepare('SELECT * FROM google_workspace_connection WHERE id = 1').get()
  if (!conn) throw new Error('Google not connected. Open dashboard and click CONNECT GOOGLE.')

  let token = conn.access_token
  const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : 0
  if (expiresAt < Date.now() + 60_000) {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
    })
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`)
    token = data.access_token
    db.prepare(
      'UPDATE google_workspace_connection SET access_token = ?, expires_at = ?, updated_at = datetime(\'now\') WHERE id = 1',
    ).run(token, new Date(Date.now() + data.expires_in * 1000).toISOString())
  }

  return token
}

async function gmailFetch(token, path, init) {
  const url = path.startsWith('https://') ? path : `${GMAIL_BASE}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gmail API ${res.status}: ${text.slice(0, 400)}`)
  }
  if (res.status === 204) return null
  return res.json()
}

async function getProfile(token) {
  return gmailFetch(token, '/profile')
}

async function listLabels(token) {
  const data = await gmailFetch(token, '/labels')
  return data.labels ?? []
}

async function ensureLabel(token, name, color) {
  const labels = await listLabels(token)
  const existing = labels.find((l) => l.name === name && l.type === 'user')
  if (existing) return existing.id

  const created = await gmailFetch(token, '/labels', {
    method: 'POST',
    body: JSON.stringify({
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
      color,
    }),
  })
  return created.id
}

async function listFilters(token) {
  const data = await gmailFetch(token, '/settings/filters')
  return data.filter ?? []
}

function filterExists(existing, rule, labelId) {
  return existing.some((f) => {
    const criteria = f.criteria ?? {}
    const action = f.action ?? {}
    const fromMatch = rule.from ? criteria.from === rule.from : true
    const queryMatch = rule.query ? criteria.query === rule.query : true
    const skipMatch = action.removeLabelIds?.includes('INBOX')
    const labelMatch = action.addLabelIds?.includes(labelId)
    return fromMatch && queryMatch && skipMatch && labelMatch
  })
}

async function createFilters(token, labelIds, dryRun) {
  const existing = await listFilters(token)
  let created = 0
  let skipped = 0

  for (const rule of FILTER_RULES) {
    const labelId = labelIds[rule.label]
    if (!labelId) continue
    if (filterExists(existing, rule, labelId)) {
      skipped++
      continue
    }

    const criteria = {}
    if (rule.from) criteria.from = rule.from
    if (rule.query) criteria.query = rule.query

    const action = {
      addLabelIds: [labelId],
      removeLabelIds: ['INBOX', 'UNREAD'],
    }

    if (dryRun) {
      console.log(`[dry-run] filter: ${rule.label} <- ${rule.from ?? rule.query}`)
      created++
      continue
    }

    await gmailFetch(token, '/settings/filters', {
      method: 'POST',
      body: JSON.stringify({ criteria, action }),
    })
    console.log(`created filter: ${rule.label} <- ${rule.from ?? rule.query}`)
    created++
  }

  return { created, skipped }
}

async function collectMessageIds(token, query, maxMessages) {
  const ids = []
  let pageToken

  while (ids.length < maxMessages) {
    const params = new URLSearchParams({
      q: query,
      maxResults: String(Math.min(100, maxMessages - ids.length)),
    })
    if (pageToken) params.set('pageToken', pageToken)

    const data = await gmailFetch(token, `/messages?${params}`)
    for (const m of data.messages ?? []) {
      ids.push(m.id)
      if (ids.length >= maxMessages) break
    }
    pageToken = data.nextPageToken
    if (!pageToken) break
  }

  return ids
}

async function batchModify(token, ids, dryRun) {
  if (!ids.length) return 0

  const chunkSize = 1000
  let modified = 0

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    if (dryRun) {
      modified += chunk.length
      continue
    }
    await gmailFetch(token, '/messages/batchModify', {
      method: 'POST',
      body: JSON.stringify({
        ids: chunk,
        removeLabelIds: ['UNREAD', 'INBOX'],
      }),
    })
    modified += chunk.length
  }

  return modified
}

async function analyze(token) {
  const profile = await getProfile(token)
  const unread = await gmailFetch(token, '/labels/UNREAD')
  const inbox = await gmailFetch(token, '/labels/INBOX')

  console.log(`Account: ${profile.emailAddress}`)
  console.log(`Total messages: ${profile.messagesTotal}`)
  console.log(`Unread (all): ${unread?.messagesUnread ?? '?'} (${unread?.threadsUnread ?? '?'} threads)`)
  console.log(`Unread in inbox: ${inbox?.messagesUnread ?? '?'} (${inbox?.threadsUnread ?? '?'} threads)`)
  console.log()

  const senderCounts = new Map()
  const domainCounts = new Map()
  let newsletterCount = 0
  let sampled = 0
  let pageToken

  while (sampled < 300) {
    const params = new URLSearchParams({
      q: 'is:unread in:inbox',
      maxResults: '100',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const list = await gmailFetch(token, `/messages?${params}`)
    if (!list.messages?.length) break

    for (const m of list.messages) {
      const msg = await gmailFetch(
        token,
        `/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe`,
      )
      const hdrs = Object.fromEntries((msg.payload?.headers ?? []).map((h) => [h.name, h.value]))
      const from = hdrs.From ?? 'unknown'
      const emailMatch = from.match(/<([^>]+)>/) || from.match(/([\w.+-]+@[\w.-]+)/)
      const email = emailMatch ? emailMatch[1].toLowerCase() : from.toLowerCase()
      const domain = email.includes('@') ? email.split('@')[1] : email
      senderCounts.set(from, (senderCounts.get(from) ?? 0) + 1)
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1)
      if (hdrs['List-Unsubscribe']) newsletterCount++
      sampled++
      if (sampled >= 300) break
    }

    pageToken = list.nextPageToken
    if (!pageToken) break
  }

  console.log(`Sampled ${sampled} unread inbox messages`)
  console.log(`Newsletters in sample: ${newsletterCount}`)
  console.log()
  console.log('Top senders:')
  for (const [sender, count] of [...senderCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${count}x  ${sender}`)
  }
  console.log()
  console.log('Top domains:')
  for (const [domain, count] of [...domainCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${count}x  ${domain}`)
  }
  console.log()
  console.log('Cleanup preview:')
  for (const item of CLEANUP_QUERIES) {
    const data = await gmailFetch(
      token,
      `/messages?q=${encodeURIComponent(item.query)}&maxResults=1`,
    )
    console.log(`  ${item.name}: ~${data.resultSizeEstimate ?? 0} messages`)
  }
}

async function setup(token, dryRun) {
  const labelIds = {}
  for (const spec of CUSTOM_LABELS) {
    if (dryRun) {
      labelIds[spec.name] = `dry-run-${spec.name}`
      console.log(`[dry-run] label: ${spec.name}`)
    } else {
      labelIds[spec.name] = await ensureLabel(token, spec.name, spec.color)
      console.log(`label ready: ${spec.name}`)
    }
  }

  const { created, skipped } = await createFilters(token, labelIds, dryRun)
  console.log(`filters: ${created} new, ${skipped} already existed`)
}

async function cleanup(token, dryRun, maxPerQuery) {
  let total = 0
  for (const item of CLEANUP_QUERIES) {
    const ids = await collectMessageIds(token, item.query, maxPerQuery)
    console.log(`${item.name}: ${ids.length} messages`)
    const modified = await batchModify(token, ids, dryRun)
    total += modified
  }
  console.log(`${dryRun ? 'would archive' : 'archived'} ${total} messages total`)
}

function printAuthHint() {
  console.log()
  console.log('If you see insufficientPermissions / 403:')
  console.log('  1. Add gmail.modify + gmail.settings.basic scopes in Google Cloud Console')
  console.log('  2. Disconnect Google on the Agentic dashboard')
  console.log('  3. Reconnect (CONNECT GOOGLE) to grant new permissions')
  console.log('  4. Re-run this script')
}

function usage() {
  console.log(`Usage: node scripts/organize-gmail.mjs <command> [options]

Commands:
  analyze              Inbox stats (readonly)
  setup                Create labels + filters
  cleanup              Archive old noise (promotions, newsletters, etc.)
  all                  setup + cleanup

Options:
  --apply              Execute changes (default is dry-run for setup/cleanup/all)
  --max-per-query=N    Max messages per cleanup query (default: 500)
`)
}

async function main() {
  const args = process.argv.slice(2)
  const command = args.find((a) => !a.startsWith('--')) ?? 'analyze'
  const dryRun = !args.includes('--apply')
  const maxArg = args.find((a) => a.startsWith('--max-per-query='))
  const maxPerQuery = maxArg ? Number(maxArg.split('=')[1]) : 500

  if (command === 'help' || command === '-h') {
    usage()
    return
  }

  const config = loadConfig()
  const db = loadDb()
  const token = await refreshTokenIfNeeded(db, config)

  if (command === 'analyze') {
    await analyze(token)
    return
  }

  if (dryRun) {
    console.log('DRY RUN — pass --apply to execute changes\n')
  }

  try {
    if (command === 'setup') {
      await setup(token, dryRun)
    } else if (command === 'cleanup') {
      await cleanup(token, dryRun, maxPerQuery)
    } else if (command === 'all') {
      await setup(token, dryRun)
      console.log()
      await cleanup(token, dryRun, maxPerQuery)
    } else {
      usage()
      process.exit(1)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('403') || msg.includes('insufficient')) {
      console.error(msg)
      printAuthHint()
      process.exit(1)
    }
    throw err
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
