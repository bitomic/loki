import { load } from 'ts-dotenv'

export const env = load( {
	FANDOM_PASS: String,
	FANDOM_USER: String,
	NODE_ENV: [
		'development' as const,
		'production' as const
	],
	REDIS_HOST: String,
	REDIS_PASS: String,
	REDIS_PORT: {
		default: 6379,
		type: Number
	}
} )
