import { format } from 'lua-json'
import type { JobsOptions } from 'bullmq'
import { parse } from 'mwparser'
import { Time } from '@sapphire/duration'
import type { Wiki } from '@quority/fandom'
import { WikiTask } from '../../framework'

enum PageType {
	Personaje = 'Personaje',
	Arma = 'Arma',
	Artefacto = 'Artefacto',
	Enemigo = 'Enemigo',
	Comida = 'Comida',
	Vestuario = 'Vestuario'
}

export class UserTask extends WikiTask {
	public override jobOptions: JobsOptions = {
		repeat: {
			every: Time.Hour
		}
	}

	public async run(): Promise<void> {
		const wiki = UserTask.getFandomWiki( 'es.genshin-impact' )
		const bot = await UserTask.getBot( wiki )
		const data = {
			...await this.getPages( wiki ),
			...await this.getArtifactPieces( wiki )
		}

		this.logger.info( 'Updating prefixes...' )
		await bot.edit( {
			bot: true,
			text: format( data ),
			title: 'Module:Prefijo/datos'
		} )
	}

	protected async getPages( wiki: Wiki ): Promise<Record<string, PageType>> {
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
			const transclusions = await this.getTransclusions( wiki, `Infobox ${ infobox }` )
			const types = transclusions.reduce( ( list, item ) => {
				list[ item ] = type
				return list
			}, {} as Record<string, PageType> )

			Object.assign(
				pages,
				types
			)
		}

		return pages
	}

	protected async getArtifactPieces( wiki: Wiki ): Promise<Record<string, PageType>> {
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
