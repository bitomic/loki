import type { PieceContext, PieceOptions } from '@sapphire/pieces'
import { Fandom } from 'mw.js'
import type { FandomWiki } from 'mw.js'
import { format } from 'lua-json'
import { HOUR } from '../../util'
import type { JobsOptions } from 'bullmq'
import { Task } from '../../framework'

export class UserTask extends Task {
	public override jobOptions: JobsOptions = {
		repeat: {
			every: HOUR
		}
	}

	public constructor( context: PieceContext, options: PieceOptions ) {
		super( context, {
			...options,
			name: 'es.genshin-impact/rarities'
		} )
	}

	public async run(): Promise<void> {
		const wiki = Fandom.getWiki( 'es.genshin-impact' )
		const bot = await Task.getFandomBot( wiki )
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

	protected async getPagesInCategory( wiki: FandomWiki, category: string ): Promise<string[]> {
		return ( await wiki.queryList( {
			cmlimit: 'max',
			cmnamespace: 0,
			cmtitle: `Category:${ category }`,
			list: 'categorymembers'
		} ) ).map( i => i.title )
	}
}
