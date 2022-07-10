import ContainerRetentionPolicy from '../runners/ContainerRetentionPolicy'
import { GithubName } from '../queues'
import { redis } from '../lib'
import { Worker } from 'bullmq'

new Worker(
	GithubName,
	job => new ContainerRetentionPolicy().run( job ),
	{ connection: redis, lockDuration: 1000 * 60 * 15 }
)
