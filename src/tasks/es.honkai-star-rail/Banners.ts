import { parse, type Template, UnnamedParameter } from 'mwparser'
import type { JobsOptions } from 'bullmq'
import { sleep } from '@quority/core'
import { Time } from '@sapphire/duration'
import type { Wiki } from '@quority/fandom'
import { WikiTask } from '../../framework'

export class UserTask extends WikiTask {
	public override jobOptions: JobsOptions = {
		repeat: {
			every: Time.Hour
		}
	}

	public async run(): Promise<void> {
		const wiki = UserTask.getFandomWiki( 'es.honkai-star-rail' )
		const english = UserTask.getFandomWiki( 'honkai-star-rail' )
		const bot = await UserTask.getBot( wiki )

		const banners = await this.getPagesInCategory( wiki, 'Saltos' )
		const translations = await this.getTranslatedTitles( wiki, 'en', banners )

		const cache = {
			characters: new Set<string>(),
			cones: new Set<string>()
		}

		for await ( const page of wiki.iterPages( banners ) ) {
			if ( page.missing ) continue
			const content = parse( page.revisions[ 0 ].slots.main.content )
			const template = content.findTemplate( 'Obtenibles en salto' ).templates.at( 0 )
			if ( !template ) {
				this.logger.warn( `Couldn't find template in page ${ page.title }.` )
				continue
			}

			const englishName = translations[ page.title ]
			if ( !englishName ) continue

			const englishPage = await english.getPage( englishName )
			if ( !englishPage ) {
				this.logger.warn( `No english page ${ englishName }.` )
				continue
			}

			const englishContent = parse( englishPage.replace( /<!-+ *.*?>/g, '' ) )
			const warpPool = englishContent.findTemplate( 'Warp Pool' ).templates.at( 0 )
			if ( !warpPool ) {
				this.logger.warn( `No warp pool template in page ${ englishName }.` )
				continue
			}

			const promoted: string[] = []
			const normal: string[] = []
			for ( const parameter of warpPool.parameters ) {
				if ( !( parameter instanceof UnnamedParameter ) ) continue
				const name = parameter.value.trim()
				if ( name.startsWith( '^' ) ) {
					promoted.push( name.substring( 1 ) )
				} else {
					normal.push( name )
				}
			}

			const promotedCharacters: string[] = []
			const promotedCones: string[] = []
			const characters: string[] = []
			const cones: string[] = []

			const allpages = [ ...normal, ...promoted ].filter( i => !cache.characters.has( i ) && !cache.cones.has( i ) )
			while ( allpages.length ) {
				const result = await english.queryProp( {
					clcategories: 'Category:Characters',
					cllimit: 'max',
					prop: 'categories',
					titles: allpages.splice( 0, 50 )
				} )
				for ( const item of result ) {
					// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
					if ( item.categories ) {
						cache.characters.add( item.title )
					} else {
						cache.cones.add( item.title )
					}
				}
			}

			const englishToSpanish = await this.getTranslatedTitles( english, 'es', [ ...normal, ...promoted ] )
			for ( const item of promoted ) {
				const name = englishToSpanish[ item ] ?? item
				if ( cache.characters.has( item ) ) {
					promotedCharacters.push( name )
				} else {
					promotedCones.push( name )
				}
			}
			for ( const item of normal ) {
				const name = englishToSpanish[ item ] ?? item
				if ( cache.characters.has( item ) ) {
					characters.push( name )
				} else {
					cones.push( name )
				}
			}

			const set = ( ( template: Template, name: string, list: string[] ) => {
				if ( !list.length ) return
				template.setParameter( name, list.join( ', ' ) )
			} ).bind( undefined, template )

			set( 'personajes promocionales', promotedCharacters )
			set( 'conos promocionales', promotedCones )
			set( 'personajes', characters )
			set( 'conos', cones )

			template.prettify()
			await bot.edit( {
				summary: 'Actualizando lista de obtenibles.',
				text: content.toString(),
				title: page.title
			} )
			await sleep( 1500 )
		}
	}

	protected async getTranslatedTitles( wiki: Wiki, lang: string, titles: string[] ): Promise<Record<string, string>> {
		const translations: Record<string, string> = {}

		for ( let i = 0; i < titles.length; i += 50 ) {
			const result = await wiki.queryProp( {
				lllang: lang,
				lllimit: 'max',
				prop: 'langlinks',
				titles: titles.slice( i, i + 50 )
			} )

			for ( const item of result ) {
				const translation = item.langlinks.at( 0 )?.title
				if ( !translation ) {
					this.logger.warn( `No interwiki in page ${ item.title }.` )
					continue
				}
				translations[ item.title ] = translation
			}
		}

		return translations
	}
}
