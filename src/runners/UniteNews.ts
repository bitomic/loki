import { fandom, getFandomBot } from '../util'
import { format, parse as luaParse } from 'lua-json'
import type { FandomWiki } from 'mw.js'
import type { HTMLElement } from 'node-html-parser'
import { parse as htmlParse } from 'node-html-parser'
import type { Job } from 'bullmq'
import { pino } from '../lib'
import { request } from 'undici'
import { UniteNewsName } from '../producers'

interface INewsItem {
	date: string
	description: string
	image: string
	title: string
	url: string
}

type ILuaNewsItem = Omit<INewsItem, 'image'> & { id: number }

export default class {
	protected readonly logger = pino.child( {
		worker: UniteNewsName
	} )
	protected readonly UNITE_URL = 'https://unite.pokemon.com/es-mx/news/'
	protected readonly MONTHS: string[] = []
	protected readonly wiki: FandomWiki

	public constructor() {
		this.wiki = fandom.getWiki( 'es.pokemon-unite' )
		const intl = new Intl.DateTimeFormat( 'es', { month: 'long' } )
		for ( let i = 0; i < 12; i++ ) {
			this.MONTHS.push( intl.format( new Date( 2022, i, 15 ) ) )
		}
	}

	public async run( job: Pick<Job, 'name'> ): Promise<void> {
		if ( job.name !== UniteNewsName ) return

		const news = await this.getOfficialNews()
		const [ lastWikiNews ] = await this.getWikiNews()

		if ( !lastWikiNews ) {
			this.logger.error( 'Couldn\'t retrieve the news from the wiki.' )
			return
		}

		const lastPostedIndex = news.findIndex( i => i.url === lastWikiNews.url )
		if ( lastPostedIndex === 0 ) {
			this.logger.info( 'News list is already up to date.' )
			return
		}

		const items = news.map( ( value, index ) => ( {
			...value,
			id: lastWikiNews.id + lastPostedIndex - index
		} ) ).slice( 0, 3 )

		const bot = await getFandomBot()
		this.logger.info( await bot.whoAmI() )

		for ( const item of items ) {
			if ( item.id <= lastWikiNews.id ) continue

			await bot.uploadFromUrl( {
				filename: `Noticia ${ item.id }.jpg`,
				url: item.image
			} )
				.catch( e => {
					this.logger.error( `Couldn't upload an image for news item with it ${ item.id }` )
					this.logger.error( e )
				} )
		}

		const newsData = items.map( ( { date, description, id, title, url } ) => ( {
			date, description, id, title, url
		} ) )

		await bot.edit( {
			bot: true,
			text: format( newsData ),
			title: 'Module:Noticias/datos'
		} )
			.catch( e => {
				this.logger.error( 'An error ocurred while trying to update the news module.' )
				this.logger.error( e )
				throw e
			} )
	}

	protected async getOfficialNews(): Promise<INewsItem[]> {
		const { body } = await request( this.UNITE_URL, {
			headers: {
				'User-Agent': 'unite/1.0'
			}
		} )
		const res = await body.text()
		const dom = htmlParse( res )

		const news: INewsItem[] = []
		const mainNewsItem = this.getMainNews( dom )
		if ( mainNewsItem ) news.push( mainNewsItem )

		const newsCards = dom.querySelectorAll( '.news-card' )
		for ( const newsCard of newsCards ) {
			const newsItem = this.getNewsItem( newsCard )
			if ( newsItem ) news.push( newsItem )
		}

		return news
	}

	protected getMainNews( dom: HTMLElement ): INewsItem | null {
		const item = dom.querySelector( '.main-header' )
		if ( !item ) return null
		const date = item.querySelector( '.news-date-tag' )?.innerText
		const title = item.querySelector( 'h2' )?.innerText
		const img = item.querySelector( 'img' )?.attributes.src
		const description = item.querySelector( 'p:not(.news-date-tag)' )?.innerText
		const link = item.querySelector( 'a.button' )?.attributes.href
		if ( !date || !title || !img || !description || !link ) return null
		return {
			date: this.resolveDate( date ),
			description,
			image: this.resolveUrl( img ),
			title,
			url: this.resolveUrl( link )
		}
	}

	protected resolveDate( date: string ): string {
		const [
			day, monthName, year
		] = date.split( ' de ' ) as [ string, string, string ]
		const month = this.MONTHS.indexOf( monthName )
		return new Date( parseInt( year, 10 ), month, parseInt( day, 10 ), 0, 0, 0, 0 ).toISOString()
	}

	protected resolveUrl( path: string ): string {
		return new URL( path, this.UNITE_URL ).href
	}

	protected async getWikiNews(): Promise<ILuaNewsItem[]> {
		const news = await this.wiki.getPages( 'Module:Noticias/datos' )
		return luaParse( news ) as ILuaNewsItem[]
	}

	protected getNewsItem( item: HTMLElement ): INewsItem | null {
		const date = item.querySelector( '.news-date-tag' )?.innerText
		const title = item.querySelector( '.news-card__title' )?.innerText
		const img = item.querySelector( 'img' )?.attributes.src
		const description = item.querySelector( '.news-card__excerpt' )?.innerText
		const link = item.querySelector( '.news-card__title' )?.attributes.href
		if ( !date || !title || !img || !description || !link ) return null
		return {
			date: this.resolveDate( date ),
			description,
			image: this.resolveUrl( img ),
			title,
			url: this.resolveUrl( link )
		}
	}
}
