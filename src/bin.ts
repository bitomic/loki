import fs from 'fs'
import { logger } from './lib'
import path from 'path'
import type { UserTask as PingTask } from './tasks/Ping'
import type { Store } from '@sapphire/pieces'

void ( async () => {
	const { argv } = process
	const args = argv.slice( 2 ).map( i => i.toLowerCase() )
	const name = args.pop()! // eslint-disable-line @typescript-eslint/no-non-null-assertion
	const directory = path.resolve( __dirname, 'tasks', ...args )
	const file = fs.readdirSync( directory ).find( i => i.toLowerCase().includes( name ) && i.endsWith( '.js' ) )
	if ( !file ) {
		logger.error( 'Couldn\'t find the specified task.' )
		process.exit( 1 )
	}
	const filepath = path.resolve( directory, file )

	const t1 = Date.now()
	logger.info( `Running task: ${ file.replace( '.js', '' ) }` )
	const { UserTask } = await import( filepath ) as unknown as { UserTask: typeof PingTask }
	const task = new UserTask(
		{
			name: 'bin',
			path: __dirname,
			root: __dirname,
			store: {} as Store<PingTask>
		}
	)

	await task.run() // eslint-disable-line @typescript-eslint/await-thenable
	logger.info( `Finished task (${ Date.now() - t1 }ms)` )

	process.exit( 0 )
} )()
