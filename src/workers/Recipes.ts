import Recipes from '../runners/Recipes'
import { redis } from '../lib'
import { WikiName } from '../queues'
import { Worker } from 'bullmq'

new Worker(
	WikiName,
	job => new Recipes().run( job ),
	{ connection: redis, lockDuration: 1000 * 60 * 15 }
)
