import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { getJob, listRecentJobs } from '../services/graph-runner.js'
import { jobEvents } from '../services/job-events.js'

export const jobsRoutes = new Hono()

jobsRoutes.get('/jobs', (c) => {
  const jobs = listRecentJobs().map((j) => j.toJSON())
  return c.json({ jobs })
})

jobsRoutes.get('/jobs/:id', (c) => {
  const job = getJob(c.req.param('id'))
  if (!job) return c.json({ error: 'Not found' }, 404)
  return c.json({ job: job.toJSON() })
})

jobsRoutes.get('/jobs/:id/events', (c) => {
  const jobId = c.req.param('id')
  const job = getJob(jobId)
  if (!job) return c.json({ error: 'Not found' }, 404)

  return streamSSE(c, async (stream) => {
    const send = async (event: { type: string; message?: string; status?: string }) => {
      await stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event),
      })
    }

    await send({ type: 'status', status: job.status })
    if (job.logTail) {
      for (const line of job.logTail.split('\n')) {
        if (line.trim()) await send({ type: 'log', message: line })
      }
    }

    if (job.status === 'done' || job.status === 'failed') {
      await send({ type: job.status, status: job.status, message: job.errorMessage ?? undefined })
      return
    }

    const handler = async (event: {
      jobId: string
      type: string
      message?: string
      status?: string
    }) => {
      if (event.jobId !== jobId) return
      await send(event)
      if (event.type === 'done' || event.type === 'error') {
        jobEvents.off('job', handler)
      }
    }

    jobEvents.on('job', handler)

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        jobEvents.off('job', handler)
        resolve()
      }, 30 * 60 * 1000)

      const finish = async (event: { jobId: string; type: string }) => {
        if (event.jobId !== jobId) return
        if (event.type === 'done' || event.type === 'error') {
          clearTimeout(timeout)
          jobEvents.off('job', finish)
          resolve()
        }
      }
      jobEvents.on('job', finish)
    })
  })
})
