import { format } from 'lua-json'
import type { JobsOptions } from 'bullmq'
import { Time } from '@sapphire/duration'
import { WikiTask } from '../../framework'

export class UserTask extends WikiTask {
	public override jobOptions: JobsOptions = {
		repeat: {
			every: Time.Hour
		}
	}

	public async run(): Promise<void> {
		const wiki = UserTask.getFandomWiki( 'es.genshin-impact' )
		const bot = await UserTask.getBot( wiki )
		const itemTypes = [ 'Armas', 'Comidas', 'Objetos', 'Personajes' ]
		const rarities: Record<string, number> = {}
		for ( const itemType of itemTypes ) {
			for ( let i = 1; i <= 5; i++ ) {
				const category = `${ itemType } de ${ i } estrella${ i === 1 ? '' : 's' }`
				const pages = await this.getPagesInCategory( wiki, category )
				for ( const page of pages ) {
					rarities[ page ] = i
				}
			}
		}

		this.logger.info( 'Updating rarities...' )
		await bot.edit( {
			bot: true,
			text: format( rarities ),
			title: 'Module:Rarezas'
		} )
	}
}
