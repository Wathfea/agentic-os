import { EventEmitter } from 'node:events'

export type JobEvent = {
  jobId: string
  type: 'log' | 'status' | 'done' | 'error'
  message?: string
  status?: string
}

class JobEventBus extends EventEmitter {
  emitJob(event: JobEvent): void {
    this.emit(event.jobId, event)
    this.emit('job', event)
  }
}

export const jobEvents = new JobEventBus()
