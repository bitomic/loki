import { env, logger } from '../lib'
import { Fandom, Wiki } from 'mw.js'
import { parse, UnnamedParameter } from 'mwparser'
import { format } from 'lua-json'
import type { Job } from 'bullmq'
import { RecipesName } from '../producers'

export default class {
	protected readonly logger = logger.child( {
		worker: RecipesName
	} )

	public async run( job: Pick<Job, 'name'> ): Promise<void> {
		if ( job.name !== RecipesName ) return

		const fandom = new Fandom()
		const en = new Wiki( { api: 'https://calamitymod.wiki.gg/api.php' } )
		const dataTemplates = await this.getDataTemplates( en )
		const pages = await en.getPages( dataTemplates )
		const data: Record<string, unknown[]> = {}

		for ( const [ title, page ] of Object.entries( pages ) ) {
			const parsed = parse( page )
			const templates = parsed.templates.filter( i => i.name === 'recipes/register' )
			const isHistorical = title.includes( 'Historical' )

			for ( const template of templates ) {
				const result = template.getParameter( 'result' )?.value
				if ( !result ) continue
				const station = template.getParameter( 'station' )?.value
				const amount = parseInt( template.getParameter( 'amount' )?.value ?? '', 10 )
				const materials: Record<string, number> = {}
				const unnamed = template.parameters.filter( i => i instanceof UnnamedParameter )
				for ( let i = 0; i < unnamed.length; i += 2 ) {
					const material = unnamed[ i ]?.value
					const qty = unnamed[ i + 1 ]?.value
					if ( !material || !qty ) continue
					materials[ material ] = parseInt( qty, 10 )
				}

				const array = data[ result ] ?? []
				const item: Record<string, unknown> = { amount, materials, station }
				if ( isHistorical ) item.historical = true
				array.push( item )
				data[ result ] ??= array
			}
		}

		const es = fandom.getWiki( 'es.calamitymod' )
		const bot = await fandom.login( {
			password: env.FANDOM_PASS,
			username: env.FANDOM_USER,
			wiki: es
		} )
		await bot.edit( {
			minor: true,
			text: format( data ),
			title: 'Module:Recetas/datos'
		} )
	}

	protected async getDataTemplates( wiki: Wiki ): Promise<string[]> {
		return ( await wiki.queryList( {
			cmlimit: 'max',
			cmtitle: 'Category:Data templates',
			list: 'categorymembers'
		} ) ).map( i => i.title ).filter( i => i.startsWith( 'Recipes' ) )
	}
}
