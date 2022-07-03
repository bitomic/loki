import Prefixes from '../runners/Prefixes'
import { redis } from '../lib'
import { WikiName } from '../queues'
import { Worker } from 'bullmq'

new Worker(
	WikiName,
	job => new Prefixes().run( job ),
	{ connection: redis }
)
