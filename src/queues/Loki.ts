import { Queue, QueueEvents, QueueScheduler } from 'bullmq'
import { redis } from '../lib'

export const LokiName = 'Loki'

export const LokiScheduler = new QueueScheduler( LokiName, { connection: redis } )

export const LokiEvents = new QueueEvents( LokiName, { connection: redis } )

export const LokiQueue = new Queue( LokiName, {
	connection: redis,
	defaultJobOptions: {
		attempts: 1,
		removeOnComplete: true,
		removeOnFail: true
	}
} )

