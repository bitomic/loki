import { Queue, QueueEvents, QueueScheduler } from 'bullmq'
import { redis } from '../lib'

export const WikiName = 'Wiki'

export const WikiScheduler = new QueueScheduler( WikiName, { connection: redis } )

export const WikiEvents = new QueueEvents( WikiName, { connection: redis } )

export const WikiQueue = new Queue( WikiName, {
	connection: redis,
	defaultJobOptions: {
		attempts: 3,
		backoff: {
			delay: 1000,
			type: 'exponential'
		}
	}
} )

