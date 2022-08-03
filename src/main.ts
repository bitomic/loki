import './producers'
import './workers'
import { GithubEvents, GithubQueue, WikiEvents, WikiQueue } from './queues'
import type { Queue, QueueEventsListener } from 'bullmq'
import { pino } from './lib'

interface EventJob {
	jobId: string
	name: string
}

type Events = Array<keyof QueueEventsListener>

( () => {
	const infoEvents: Events = [ 'active', 'added', 'completed', 'drained' ]
	const warnEvents: Events = [ 'delayed', 'paused', 'removed' ]
	const errorEvents: Events = [ 'error', 'failed' ]

	const log = async ( level: 'error' | 'info' | 'warn', event: string, job: EventJob, queue: Queue ): Promise<void> => {
		const name = job.name || ( await queue.getJob( job.jobId ) )?.name || 'unknown'
		pino[ level ]( `${ event } - ${ name } (${ job.jobId })` )
	}

	const queues = [
		{ events: GithubEvents, queue: GithubQueue },
		{ events: WikiEvents, queue: WikiQueue }
	]
	for ( const { events, queue } of queues ) {
		for ( const event of infoEvents ) {
			events.on( event, ( job: EventJob ): void => void log( 'info', event, job, queue ) )
		}

		for ( const event of warnEvents ) {
			events.on( event, ( job: EventJob ): void => void log( 'warn', event, job, queue ) )
		}

		for ( const event of errorEvents ) {
			events.on( event, ( job: EventJob ): void => void log( 'error', event, job, queue ) )
		}
	}

	pino.info( 'Loki is ready!' )
} )()
