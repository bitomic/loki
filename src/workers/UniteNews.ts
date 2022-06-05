import { redis } from '../lib'
import UniteNews from '../runners/UniteNews'
import { WikiName } from '../queues'
import { Worker } from 'bullmq'

new Worker(
	WikiName,
	job => new UniteNews().run( job ),
	{ connection: redis }
)
