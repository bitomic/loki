import { env } from '../../lib'
import IORedis from 'ioredis'
import type { JobsOptions } from 'bullmq'
import { request } from 'undici'
import { s } from '@sapphire/shapeshift'
import { Task } from '../../framework'
import { Time } from '@sapphire/duration'

export class UserTask extends Task {
	public override jobOptions: JobsOptions = {
		repeat: {
			every: Time.Hour * 4
		}
	}

	public async run(): Promise<void> {
		const redis = new IORedis( {
			db: env.TWITCH_REDIS_DB,
			host: env.REDIS_HOST,
			password: env.REDIS_PASS,
			port: env.REDIS_PORT,
			username: env.REDIS_USER
		} )

		const { refresh_token } = s.object( {
			refresh_token: s.string
		} ).parse( await redis.hgetall( 'unite:twitch-user' ) )

		const url = new URL( 'https://id.twitch.tv/oauth2/token' )
		Object.entries( {
			client_id: env.TWITCH_CLIENT_ID,
			client_secret: env.TWITCH_CLIENT_SECRET,
			grant_type: 'refresh_token',
			refresh_token
		} ).forEach( ( [ k, v ] ) => url.searchParams.set( k, `${ v }` ) )

		const req = await request( url, {
			headers: {
				'content-type': 'application/x-www-form-urlencoded'
			},
			method: 'POST'
		} )
		await redis.hset( 'unite:twitch-user', await req.body.json() as Record<string, unknown> )
	}
}
