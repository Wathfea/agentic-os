import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { ensureStore, getDashboardToken, PORT } from './config.js'
import { closeDb } from './db/index.js'
import { projectsRoutes } from './routes/projects.js'
import { graphsRoutes } from './routes/graphs.js'
import { skillsRoutes } from './routes/skills.js'
import { jobsRoutes } from './routes/jobs.js'
import { systemRoutes } from './routes/system.js'
import { brainRoutes } from './routes/brain.js'
import { briefingRoutes } from './routes/briefing.js'
import { mixRoutes } from './routes/mix.js'
import { startScheduler } from './services/scheduler-service.js'
import { startWatchManager, stopAllWatchers } from './services/watch-manager.js'

ensureStore()

const app = new Hono()

app.use(
  '/api/*',
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    allowHeaders: ['Authorization', 'Content-Type'],
  }),
)

app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/briefing/oauth/callback') {
    await next()
    return
  }

  const token = getDashboardToken()
  const auth = c.req.header('Authorization')
  const queryToken = c.req.query('token')
  const authorized =
    auth === `Bearer ${token}` || (queryToken !== undefined && queryToken === token)
  if (!authorized) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})

app.route('/api', projectsRoutes)
app.route('/api', graphsRoutes)
app.route('/api', skillsRoutes)
app.route('/api', jobsRoutes)
app.route('/api', systemRoutes)
app.route('/api', brainRoutes)
app.route('/api', briefingRoutes)
app.route('/api', mixRoutes)

app.get('/api/health', (c) => c.json({ ok: true }))

startScheduler()
startWatchManager()

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Agentic OS API listening on http://127.0.0.1:${info.port}`)
  console.log(`Dashboard token: store/.dashboard-token`)
})

process.on('SIGINT', () => {
  stopAllWatchers()
  closeDb()
  server.close()
  process.exit(0)
})
