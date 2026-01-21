import { format } from 'lua-json'
import type { JobsOptions } from 'bullmq'
import { parse } from 'mwparser'
import { Time } from '@sapphire/duration'
import type { Wiki } from '@quority/fandom'
import { WikiTask } from '../../framework'

interface Resource {
	effectType?: string;
	element?: string;
	quality?: string;
	prefix?: string;
	type?: string
}

export class UserTask extends WikiTask {
	public override jobOptions: JobsOptions = {
		repeat: {
			every: Time.Hour
		}
	}

	public async run(): Promise<void> {
		const wiki = UserTask.getFandomWiki( 'es.genshin-impact' )

		const result: Record<string, Resource> = {}
		await this.getCharacters( wiki, result )
		await this.getWeapons( wiki, result )
		await this.getFoods( wiki, result )
		await this.getArtifacts( wiki, result )
		await this.getItems( wiki, result )
		await this.getOutfits( wiki, result )

		const bot = await UserTask.getBot( wiki )
		await bot.edit( {
			summary: 'Actualizando datos de recursos',
			text: format( result ),
			title: 'Module:Recursos/datos',
		} )
	}

	protected async getCharacters( wiki: Wiki, result: Record<string, Resource> ): Promise<void> {
		const characters = await this.getTitlesInTransclusions( wiki, 'Template:Infobox Personaje jugable' )

		for ( const character of characters ) {
			result[ character ] = {
				element: 'Adaptive',
				prefix: 'Personaje',
				quality: '1',
			}
		}

		for ( let i = 4; i <= 5; i++ ) {
			const titles = await this.getTitlesInCategory( wiki, `Category:Personajes de ${ i } estrellas` )

			for ( const title of titles ) {
				const record = result[ title ]
				if ( !record ) continue

				if ( title === 'Manekín' || title === 'Aloy' ) {
					record.quality = `${ i }a`
				} else {
					record.quality = `${ i }`
				}
			}
		}

		const elements = [ 'Anemo', 'Cryo', 'Dendro', 'Electro', 'Geo', 'Hydro', 'Pyro' ]
		for ( const element of elements ) {
			const titles = await this.getTitlesInCategory( wiki, `Category:Usuarios de ${ element }` )

			for ( const title of titles ) {
				const record = result[ title ]
				if ( !record ) continue

				record.element = element
			}
		}
	}

	protected async getWeapons( wiki: Wiki, result: Record<string, Resource> ): Promise<void> {
		const types = [ 'Arcos', 'Catalizadores', 'Espadas', 'Lanzas', 'Mandobles' ]
		for ( const type of types ) {
			const singular = type === 'Catalizadores' ? 'Catalizador' : type.replace( /s$/m, '' )
			const titles = await this.getTitlesInCategory( wiki, `Category:${ type }` )

			for ( const title of titles ) {
				result[ title ] = { prefix: 'Arma', quality: '1', type: singular }
			}
		}

		for ( let i = 4; i <= 5; i++ ) {
			const titles = await this.getTitlesInCategory( wiki, `Category:Armas de ${ i } estrellas` )

			for ( const title of titles ) {
				const record = result[ title ]
				if ( !record ) continue

				record.quality = `${ i }`
			}
		}
	}

	protected async getFoods( wiki: Wiki, result: Record<string, Resource> ): Promise<void> {
		for ( let i = 1; i <= 5; i++ ) {
			const titles = await this.getTitlesInCategory( wiki, `Category:Comidas de ${ i } estrella${ i === 1 ? '' : 's' }` )

			for ( const title of titles ) {
				result[ title ] = { prefix: 'Comida', quality: `${ i }` }
			}
		}

		const types = {
			'ATK Up': 'Platos que mejoran ataque',
			'DEF Up': 'Platos que mejoran la defensa',
			'Regeneration': 'Platos que regeneran Vida',
		}
		for ( const [ label, category ] of Object.entries( types ) ) {
			const titles = await this.getTitlesInCategory( wiki, `Category:${ category }` )

			for ( const title of titles ) {
				const record = result[ title ]
				if ( !record ) continue

				record.effectType = label
			}
		}
	}

	protected async getArtifacts( wiki: Wiki, result: Record<string, Resource> ): Promise<void> {
		const titles = await this.getTitlesInCategory( wiki, 'Category:Conjuntos de artefactos' )

		for await ( const page of wiki.iterPages( titles ) ) {
			if ( page.missing ) continue

			const parsed = parse( page.revisions[ 0 ].slots.main.content )
			const infobox = parsed.templates.find( t => t.name.replace( /_/g, ' ' ).toLowerCase() === 'infobox artefacto' )
			const rarity = infobox?.getParameter( 'rareza' )?.value
			if ( !rarity ) continue

			result[ page.title ] = { prefix: 'Artefacto', quality: rarity.replace( '-', '' ) }
		}
	}

	protected async getItems( wiki: Wiki, result: Record<string, Resource> ): Promise<void> {
		for ( let i = 1; i <= 5; i++ ) {
			const titles = await this.getTitlesInCategory( wiki, `Category:Objetos de ${ i } estrella${ i === 1 ? '' : 's' }` )

			for ( const title of titles ) {
				result[ title ] = { quality: `${ i }` }
			}
		}
	}

	protected async getOutfits( wiki: Wiki, result: Record<string, Resource> ): Promise<void> {
		const titles = await this.getTitlesInTransclusions( wiki, 'Template:Infobox Vestuario' )

		for ( const title of titles ) {
			const record = result[ title ]
			if ( !record ) continue

			record.prefix = 'Vestuario'
		}
	}

	protected async getTitlesInCategory( wiki: Wiki, category: string ): Promise<string[]> {
		return ( await wiki.queryList( {
			cmlimit: 'max',
			cmprop: 'title',
			cmtitle: category,
			list: 'categorymembers',
		} ) ).map( i => i.title )
	}

	protected async getTitlesInTransclusions( wiki: Wiki, template: string ): Promise<string[]> {
		return ( await wiki.queryProp( {
			prop: 'transcludedin',
			tilimit: 'max',
			tiprop: 'title',
			titles: template,
		} ) ).flatMap( i => i.transcludedin.map( j => j.title ) )
	}
}
