import { env, logger } from '../lib'
import type { FandomBot, FandomWiki } from 'mw.js'
import { Fandom } from 'mw.js'
import type { JobsOptions } from 'bullmq'
import { LokiQueue } from '../queues'
import { Piece } from '@sapphire/pieces'

export abstract class Task extends Piece {
	public jobOptions: JobsOptions | null = null
	#logger: typeof logger | null = null

	protected get logger(): typeof logger {
		if ( !this.#logger ) this.#logger = logger.child( { label: this.name } )
		return this.#logger
	}

	public abstract run(): void | Promise<void>

	protected static getFandomBot( wiki: FandomWiki ): Promise<FandomBot> {
		const fandom = new Fandom()
		return fandom.login( {
			password: env.FANDOM_PASS,
			username: env.FANDOM_USER,
			wiki
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
