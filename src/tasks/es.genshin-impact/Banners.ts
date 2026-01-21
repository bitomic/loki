import { NamedParameter, parse } from 'mwparser'
import { format } from 'lua-json'
import type { JobsOptions } from 'bullmq'
import type { Template } from 'mwparser'
import { Time } from '@sapphire/duration'
import { WikiTask } from '../../framework'

type BannerData = Record<string, string | Record<string, boolean>> & {
	inicio: string
}

export class UserTask extends WikiTask {
	public override jobOptions: JobsOptions = {
		repeat: {
			every: Time.Hour
		}
	}

	public async run(): Promise<void> {
		const wiki = UserTask.getFandomWiki( 'es.genshin-impact' )
		const pages = await this.getPagesInCategory( wiki, 'Banners' )
		const data: Record<string, BannerData> = {}

		for await ( const page of wiki.iterPages( pages ) ) {
			if ( page.missing ) continue
			const parsed = parse( page.revisions[ 0 ].slots.main.content )
			const template = parsed.templates.find( i => i.name.replace( /_/g, ' ' ).toLowerCase() === 'obtenibles en banner' )
			const infobox = parsed.templates.find( i => i.name.replace( /_/g, ' ' ).toLowerCase() === 'infobox banner' )
			if ( !template || !infobox ) continue
			data[ page.title ] = this.getData( template, infobox )
		}

		const bot = await UserTask.getBot( wiki )
		await bot.edit( {
			text: format( data ),
			title: 'Module:Banner/datos'
		} )
	}

	protected getData( template: Template, infobox: Template ) {
		const startTime = infobox.getParameter( 'inicio' )?.value.trim()
		const data: BannerData = {
			inicio: startTime && startTime.length > 0 ? new Date( startTime ).toISOString() : ''
		}
		for ( const parameter of template.parameters ) {
			if ( !( parameter instanceof NamedParameter ) ) continue
			data[ parameter.name ] = parameter.value.split( /,/g ).map( i => i.trim() )
				.reduce( ( list, item ) => {
					list[ item ] = true
					return list
				}, {} as Record<string, boolean> )
		}
		return data
	}
}
