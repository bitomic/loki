import { Fandom } from 'mw.js'
import type { FandomWiki } from 'mw.js'
import { format } from 'path'
import { HOUR } from '../../util'
import type { JobsOptions } from 'bullmq'
import { Task } from '../../framework'

export class UserTask extends Task {
	public override jobOptions: JobsOptions = {
		repeat: {
			every: HOUR
		}
	}

	public async run(): Promise<void> {
		const wiki = Fandom.getWiki( 'es.genshin-impact' )
		const bot = await Task.getFandomBot( wiki )
		const pages = await this.getPages( wiki )
		const rarities = await this.getRarities( wiki, pages )

		this.logger.info( 'Updating rarities...' )
		await bot.edit( {
			bot: true,
			text: format( rarities ),
			title: 'Module:Rarezas'
		} )
	}

	protected async getPages( wiki: FandomWiki ): Promise<string[]> {
		return ( await wiki.queryProp( {
			prop: 'transcludedin',
			tilimit: 'max',
			tinamespace: 0,
			tishow: '!redirect',
			titles: [ 'Plantilla:Infobox Objeto', 'Plantilla:Infobox Personaje jugable', 'Plantilla:Infobox Arma', 'Plantilla:Infobox Comida' ]
		} ) ).map( i => i.transcludedin?.map( i => i.title ) ).flat() // eslint-disable-line
	}

	protected async getRarities( wiki: FandomWiki, pages: string[] ): Promise<Record<string, number>> {
		const rarities: Record<string, number> = {}
		for await ( const page of wiki.iterPages( pages ) ) {
			if ( page.missing ) continue
			const { content } = page.revisions[ 0 ].slots.main
			const rarity = content.match( / *rareza *= *(\d)/ )
			if ( !rarity?.[ 1 ] ) continue
			rarities[ page.title ] = parseInt( rarity[ 1 ], 10 )
		}
		return rarities
	}
}
