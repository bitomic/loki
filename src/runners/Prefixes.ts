import { env, logger } from '../lib'
import { Fandom, type FandomWiki } from 'mw.js'
import { format } from 'lua-json'
import type { Job } from 'bullmq'
import { parse } from 'mwparser'
import { PrefixesName } from '../producers'

enum PageType {
	Personaje = 'Personaje',
	Arma = 'Arma',
	Artefacto = 'Artefacto',
	Enemigo = 'Enemigo',
	Comida = 'Comida',
	Vestuario = 'Vestuario'
}

export default class {
	protected readonly logger = logger.child( {
		worker: PrefixesName
	} )

	public async run( job: Pick<Job, 'name'> ): Promise<void> {
		if ( job.name !== PrefixesName ) return

		const fandom = new Fandom()
		const wiki = fandom.getWiki( 'es.genshin-impact' )
		const bot = await fandom.login( {
			password: env.FANDOM_PASS,
			username: env.FANDOM_USER,
			wiki
		} )

		const pageTypes: Array<[ string, PageType ]> = [
			[ 'Arma', PageType.Arma ],
			[ 'Artefacto', PageType.Artefacto ],
			[ 'Comida', PageType.Comida ],
			[ 'Enemigo', PageType.Enemigo ],
			[ 'Personaje jugable', PageType.Personaje ],
			[ 'Vestuario', PageType.Vestuario ],
		]

		const pages: Record<string, PageType> = {}
		for ( const [ infobox, type ] of pageTypes ) {
			const transclusions = ( await wiki.queryProp( {
				prop: 'transcludedin',
				tilimit: 'max',
				tinamespace: 0,
				tishow: '!redirect',
				titles: `Plantilla:Infobox ${ infobox }`
			} ) ).map( i => i.transcludedin?.map( i => i.title ) ).flat() // eslint-disable-line
				.reduce( ( list, item ) => {
					list[ item ] = type
					return list
				}, {} as Record<string, PageType> )

			Object.assign(
				pages,
				transclusions
			)
		}
		Object.assign( pages, await this.getArtifactPieces( wiki ) )

		const lua = format( pages )
		await bot.edit( {
			bot: true,
			text: lua,
			title: 'Module:Prefijo/datos'
		} )
	}

	protected async getArtifactPieces( wiki: FandomWiki ): Promise<Record<string, PageType>> {
		const pages = ( await wiki.queryProp( {
			prop: 'transcludedin',
			tilimit: 'max',
			tinamespace: 0,
			tishow: '!redirect',
			titles: 'Plantilla:Infobox Artefacto'
		} ) ).map( i => i.transcludedin?.map( i => i.title ) ).flat() // eslint-disable-line

		const artifacts: string[] = []
		const parts = [
			'flor', 'pluma', 'arenas', 'cáliz', 'tiara'
		]

		for await ( const page of wiki.iterPages( pages ) ) {
			if ( page.missing ) continue
			const { content } = page.revisions[ 0 ].slots.main
			const parsed = parse( content )
			const infobox = parsed.templates.find( t => t.name === 'Infobox Artefacto' )
			if ( !infobox ) continue

			for ( const part of parts ) {
				const piece = infobox.getParameter( part )
				if ( !piece ) continue
				artifacts.push( piece.value )
			}
		}

		return artifacts.reduce( ( list, item ) => {
			list[ item ] = PageType.Artefacto
			return list
		}, {} as Record<string, PageType> )
	}
}
