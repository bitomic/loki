import { env } from './environment'
import IORedis from 'ioredis'

export const redis = new IORedis( {
	host: env.REDIS_HOST,
	maxRetriesPerRequest: null,
	password: env.REDIS_PASS,
	port: env.REDIS_PORT
} )
