import Rarities from '../runners/Rarities'
import { redis } from '../lib'
import { WikiName } from '../queues'
import { Worker } from 'bullmq'

new Worker(
	WikiName,
	job => new Rarities().run( job ),
	{ connection: redis }
)
