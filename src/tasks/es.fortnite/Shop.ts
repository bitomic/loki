import { format } from 'lua-json'
import type { JobsOptions } from 'bullmq'
import { sleep } from '@quority/core'
import { Task } from '../../framework'
import { Time } from '@sapphire/duration'

export class UserTask extends Task {
	public static readonly LANGUAGES = [ 'ar', 'de', 'en', 'es', 'es-419', 'fr', 'id', 'it', 'ja', 'ko', 'pl', 'pt-BR', 'ru', 'th', 'tr', 'vi', 'zh-Hans', 'zh-Hant' ]

	public override jobOptions: JobsOptions = {
		repeat: {
			every: Time.Hour * 6,
		}
	}

	public async run(): Promise<void> {
		const wiki = UserTask.getFandomWiki( 'es.fortnite' )
		const bot = await UserTask.getBot( wiki )

		const shops = await this.getShops()
		//  @ts-expect-error idc
		const shopDate = shops.en.data.date as string // eslint-disable-line @typescript-eslint/no-unsafe-member-access

		for ( const [ language, shop ] of Object.entries( shops ) ) {
			this.logger.info( `Updating shop: ${ shopDate }/${ language }` )
			const text = format( shop as object )

			await bot.edit( {
				summary: 'Actualizando tienda a partir de los datos de fortnite-api.',
				text,
				title: `Module:Tienda/${ shopDate }/${ language }`
			} )
			await sleep( 3000 )
		}
	}

	public async getShops() {
		const data: Record<string, unknown> = {}
		for ( const language of UserTask.LANGUAGES ) {
			data[ language ] = await this.getShop( language )
		}
		return data
	}

	public async getShop( language: string ) {
		const req = await fetch( `https://fortnite-api.com/v2/shop?language=${ language }` )
		const result = await req.json() as Record<string, unknown>
		this.transformObject( result )
		return result
	}

	public transformObject( obj: unknown ) {
		if ( Array.isArray( obj ) ) {
			for ( const item of obj ) {
				this.transformObject( item )
			}
			return
		}
		if ( typeof obj !== 'object' || obj === null ) return
		const data = obj as Record<string, unknown>

		for ( const key in data ) {
			this.transformObject( data[ key ] )
			if ( key === key.toLowerCase() ) continue
			const newKey = key.replace( /([A-Z])/g, char => `_${ char.toLowerCase() }` )

			data[ newKey ] = data[ key ]
			delete data[ key ] // eslint-disable-line @typescript-eslint/no-dynamic-delete
		}
	}
}
