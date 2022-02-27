import { load } from 'ts-dotenv'

export const env = load( {
	NODE_ENV: [
		'development' as const,
		'production' as const
	]
} )
