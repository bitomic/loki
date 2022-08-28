import { logger, redis } from './lib'
import { LokiEvents, LokiName, LokiQueue } from './queues'
import path from 'path'
import type { QueueEventsListener } from 'bullmq'
import { TaskStore } from './framework/TaskStore'
import { Worker } from 'bullmq'

void ( async () => {
	await LokiQueue.obliterate( { force: true } )

	const tasks = new TaskStore()
	tasks.registerPath( path.resolve( __dirname, 'tasks' ) )
	await tasks.loadAll()

	new Worker( LokiName, async job => {
		const { name } = job
		logger.info( `Running: ${ name }` )
		const task = tasks.get( name )
		await task?.run()
		logger.info( `Finished: ${ name }` )
	}, { connection: redis } )

	const log = async ( level: 'error' | 'info' | 'warn', event: string, job: EventJob ): Promise<void> => {
		const name = job.name || ( await LokiQueue.getJob( job.jobId ) )?.name || 'unknown'
		logger[ level ]( `${ event } - ${ name }` )
	}

	type Events = Array<keyof QueueEventsListener>
	interface EventJob {
		jobId: string
		name: string
	}
	const errorEvents: Events = [ 'error', 'failed' ]
	for ( const event of errorEvents ) {
		LokiEvents.on( event, ( job: EventJob ): void => void log( 'error', event, job ) )
	}

	logger.info( 'Loki is ready!' )
} )()
