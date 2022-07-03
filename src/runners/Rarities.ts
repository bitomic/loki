import { env, pino } from '../lib'
import { Fandom } from 'mw.js'
import { format } from 'lua-json'
import type { Job } from 'bullmq'
import { RaritiesName } from '../producers'

export default class Test {
	protected readonly logger = pino.child( {
		worker: RaritiesName
	} )

	public async run( job: Pick<Job, 'name'> ): Promise<void> {
		if ( job.name !== RaritiesName ) return

		const fandom = new Fandom()
		const wiki = fandom.getWiki( 'es.genshin-impact' )
		const bot = await fandom.login( {
			password: env.FANDOM_PASS,
			username: env.FANDOM_USER,
			wiki
		} )

		const pages = ( await wiki.queryProp( {
			prop: 'transcludedin',
			tilimit: 'max',
			tinamespace: 0,
			tishow: '!redirect',
			titles: [ 'Plantilla:Infobox Objeto', 'Plantilla:Infobox Personaje jugable', 'Plantilla:Infobox Arma', 'Plantilla:Infobox Comida' ]
		} ) ).map( i => i.transcludedin?.map( i => i.title ) ).flat() // eslint-disable-line

		const rarities: Record<string, number> = {}
		for await ( const page of wiki.iterPages( pages ) ) {
			if ( page.missing ) continue
			const { content } = page.revisions[ 0 ].slots.main
			const rarity = content.match( / *rareza *= *(\d)/ )
			if ( !rarity?.[ 1 ] ) continue
			rarities[ page.title ] = parseInt( rarity[ 1 ], 10 )
		}

		const lua = format( rarities )
		await bot.edit( {
			bot: true,
			text: lua,
			title: 'Module:Rarezas'
		} )
	}
}
