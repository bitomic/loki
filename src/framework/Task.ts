import type { Bot, Wiki } from '@quority/core'
import { env, logger } from '../lib'
import { Wiki as FandomWiki } from '@quority/fandom'
import type { JobsOptions } from 'bullmq'
import { LokiQueue } from '../queues'
import { Piece } from '@sapphire/pieces'
import { randomUUID } from 'crypto'

export abstract class Task extends Piece {
	public jobOptions: JobsOptions | null = null
	#logger: typeof logger | null = null
	public override name = randomUUID()

	public get logger(): typeof logger {
		if ( !this.#logger ) {
			const directory = this.location.directories.at( -1 ) ?? 'unknown'
			const name = this.location.name.replace( /\.(js|cjs|mjs)/, '' )
			const label = `${ directory }/${ name }`
			this.#logger = logger.child( { label } )
		}
		return this.#logger
	}

	public abstract run(): void | Promise<void>

	protected static getBot( wiki: Wiki ): Promise<Bot> {
		return wiki.login( env.FANDOM_USER, env.FANDOM_PASS )
	}

	protected static getFandomWiki( interwiki: string ): FandomWiki {
		return new FandomWiki( {
			api: interwiki
		} )
	}

	public async register(): Promise<void> {
		await LokiQueue.add(
			this.name,
			null,
			this.jobOptions ?? {}
		)
	}

	public override async onLoad(): Promise<void> {
		await this.register()
	}
}
