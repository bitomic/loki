import { Queue, QueueEvents, QueueScheduler } from 'bullmq'
import { redis } from '../lib'

export const GithubName = 'Github'

export const GithubScheduler = new QueueScheduler( GithubName, { connection: redis } )

export const GithubEvents = new QueueEvents( GithubName, { connection: redis } )

export const GithubQueue = new Queue( GithubName, {
	connection: redis,
	defaultJobOptions: {
		attempts: 3,
		backoff: {
			delay: 1000,
			type: 'exponential'
		},
		removeOnComplete: true
	}
} )

