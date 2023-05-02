import { ApplyOptions } from '@sapphire/decorators'
import { Fandom } from 'mw.js'
import { format } from 'lua-json'
import { HOUR } from '../../util'
import type { HTMLElement } from 'node-html-parser'
import type { JobsOptions } from 'bullmq'
import { parse } from 'node-html-parser'
import type { PieceOptions } from '@sapphire/pieces'
import { request } from 'undici'
import { Task } from '../../framework'

interface IBasicData {
	attackStyle: string
	difficulty: string
	isAlternativeForm: boolean
	name: string
	rol: string // to not break stuff already depending on this property
	role: string
	style: string
}

interface IStatsLevel {
	attack: string
	defense: string
	hp: string
	specialAttack: string
	specialDefense: string
}

interface IAllStats {
	stats: Record<string, Partial<IStatsLevel>>
}

@ApplyOptions<PieceOptions>( {
	name: 'es.pokemon-unite/licenses'
} )
export class UserTask extends Task {
	public override jobOptions: JobsOptions = {
		repeat: {
			every: HOUR * 24
		}
	}

	public async run(): Promise<void> {
		const links = await this.getLinks()
		if ( !links ) return

		const data: {
			[ key: string ]: IBasicData & {
				stats: Record<string, Partial<IStatsLevel>>
			}
		} = {}
		for ( const link of links ) {
			const { body } = await request( link )
			const parsed = parse( await body.text() )
			const basicData = this.getBasicData( parsed )
			const stats = await this.getStats( basicData.at( 0 )?.name )

			for ( let i = 0; i < basicData.length; i++ ) {
				const basicDataItem = basicData[ i ]
				const statsItem = stats[ i ]
				if ( !basicDataItem || !statsItem ) {
					this.logger.warn( `There were found different basic data items and stats items for ${ link }` )
					break
				}
				data[ basicDataItem.name ] = {
					...basicDataItem,
					...statsItem
				}
			}
		}

		// Is this necessary? Of course no!
		const keys = [ ...Object.keys( data ) ].sort()
		const sortedData: typeof data = {}
		// @ts-expect-error - ignore
		for ( const key of keys ) sortedData[ key ] = data[ key ]

		const wiki = Fandom.getWiki( 'es.pokemon-unite' )
		const bot = await UserTask.getFandomBot( wiki )
		await bot.edit( {
			bot: true,
			text: format( sortedData ),
			title: 'Module:Pokémon/datos'
		} )
	}

	protected getBasicData( parsed: HTMLElement ): IBasicData[] {
		const result = parsed.querySelector( '.tab' )?.querySelectorAll( '.fooinfo' ) // the main table where the image is
			.map( ( i, idx ) => {
				const lastColumn: Array<string | undefined> = i.nextElementSibling.nextElementSibling.querySelectorAll( 'tr' ).map( i => i.querySelectorAll( 'td' ).pop() )
					.map( i => i?.innerText )
				const [ difficulty, style, role, attackStyle ] = lastColumn
				return {
					attackStyle: this.normalizeAttackStyle( attackStyle ),
					difficulty: this.normalizeDifficulty( difficulty ),
					isAlternativeForm: idx !== 0,
					name: this.normalizeName( i.parentNode.previousElementSibling.previousElementSibling.innerText ),
					rol: this.normalizeRole( role ),
					role: this.normalizeRole( role ),
					style: this.normalizeStyle( style )
				}
			} ) as IBasicData[]

		if ( result[ 0 ]?.name === 'Scizor' ) {
			result.push( {
				...result[ 0 ],
				name: 'Scyther'
			} )
		}

		return result
	}

	protected async getStats( name: string | undefined ): Promise<IAllStats[]> {
		if ( !name ) return []

		if ( name === 'Ninetales de Alola' ) name = 'ninetales'
		else if ( name === 'Mr. Mime' ) name = 'mrmime'

		const url = `https://www.pokexperto.net/index2.php?seccion=pokemonunite/${ name.toLowerCase() }`
		const { body } = await request( url )

		const parsed = parse( await body.text() )
		const statsTable = parsed.querySelectorAll( 'th' ).find( i => i.innerText === 'Ataque Especial' )?.parentNode.parentNode.parentNode
		const trs = statsTable?.querySelectorAll( 'tr' )
		trs?.shift()

		if ( !trs ) return []
		else if ( name === 'Aegislash' ) return this.getAegislashStats( trs )
		else if ( name === 'Hoopa' ) return this.getHoopaStats( trs )
		else if ( name === 'Scizor' ) return this.getScizorStats( trs )

		const allStats: IAllStats = { stats: {} }
		for ( const tr of trs ) {
			const level = tr.querySelector( 'th' )?.innerText.match( /(\d+)/ )?.at( 0 )
			if ( !level ) continue

			allStats.stats[ level ] = this.getRowStats( tr )
		}

		return [ allStats ]
	}

	protected getRowStats( tr: HTMLElement ): Partial<IStatsLevel> {
		const levelStats: Partial<IStatsLevel> = {}

		const tds = tr.querySelectorAll( 'td' ).map( i => i.innerText )
		const [ hp, attack, defense, specialAttack, specialDefense ] = tds
		if ( hp ) levelStats.hp = hp
		if ( attack ) levelStats.attack = attack
		if ( defense ) levelStats.defense = defense
		if ( specialAttack ) levelStats.specialAttack = specialAttack
		if ( specialDefense ) levelStats.specialDefense = specialDefense

		return levelStats
	}

	protected getMultipleRowsStats( trs: HTMLElement[], from: number, to: number ): Array<Partial<IStatsLevel>> {
		const stats: Array<Partial<IStatsLevel>> = []
		for ( let i = from; i <= to; i++ ) {
			const tr = trs.at( i )
			if ( !tr ) continue
			stats.push( this.getRowStats( tr ) )
		}
		return stats
	}

	protected getAegislashStats( trs: HTMLElement[] ): IAllStats[] {
		const allStats: IAllStats[] = []

		const baseStats: IAllStats[ 'stats' ] = {}
		this.getMultipleRowsStats( trs, 0, 5 ).reduce( ( list, item, index ) => {
			list[ `${ index + 1 }` ] = item
			return list
		}, baseStats )

		const shieldStats: IAllStats[ 'stats' ] = {}
		this.getMultipleRowsStats( trs, 7, 15 ).reduce( ( list, item, index ) => {
			list[ `${ index + 7 }` ] = item
			return list
		}, shieldStats )

		const bladeStats: IAllStats[ 'stats' ] = {}
		this.getMultipleRowsStats( trs, 17, 25 ).reduce( ( list, item, index ) => {
			list[ `${ index + 7 }` ] = item
			return list
		}, bladeStats )

		allStats.push(
			{ stats: { ...baseStats, ...bladeStats } },
			{ stats: { ...baseStats, ...shieldStats } }
		)
		return allStats
	}

	protected getHoopaStats( trs: HTMLElement[] ): IAllStats[] {
		const allStats: IAllStats[] = []

		const baseStats: IAllStats[ 'stats' ] = {}
		this.getMultipleRowsStats( trs, 0, 7 ).reduce( ( list, item, index ) => {
			list[ `${ index + 1 }` ] = item
			return list
		}, baseStats )

		const boundStats: IAllStats[ 'stats' ] = {}
		this.getMultipleRowsStats( trs, 9, 15 ).reduce( ( list, item, index ) => {
			list[ `${ index + 9 }` ] = item
			return list
		}, boundStats )

		const unboundStats: IAllStats[ 'stats' ] = {}
		this.getMultipleRowsStats( trs, 17, 23 ).reduce( ( list, item, index ) => {
			list[ `${ index + 9 }` ] = item
			return list
		}, unboundStats )

		allStats.push(
			{ stats: { ...baseStats, ...boundStats } },
			{ stats: { ...baseStats, ...unboundStats } }
		)

		return allStats
	}

	protected getScizorStats( trs: HTMLElement[] ): IAllStats[] {
		const allStats: IAllStats[] = []

		const baseStats: IAllStats[ 'stats' ] = {}
		this.getMultipleRowsStats( trs, 0, 3 ).reduce( ( list, item, index ) => {
			list[ `${ index + 1 }` ] = item
			return list
		}, baseStats )

		const boundStats: IAllStats[ 'stats' ] = {}
		this.getMultipleRowsStats( trs, 5, 15 ).reduce( ( list, item, index ) => {
			list[ `${ index + 5 }` ] = item
			return list
		}, boundStats )

		const unboundStats: IAllStats[ 'stats' ] = {}
		this.getMultipleRowsStats( trs, 17, 27 ).reduce( ( list, item, index ) => {
			list[ `${ index + 5 }` ] = item
			return list
		}, unboundStats )

		allStats.push(
			{ stats: { ...baseStats, ...boundStats } },
			{ stats: { ...baseStats, ...unboundStats } }
		)

		return allStats
	}

	protected async getLinks(): Promise<Set<string> | null> {
		const { body } = await request( 'https://www.serebii.net/pokemonunite/pokemon.shtml' )
		const links = parse( await body.text() ).querySelector( '.dextable' )
			?.querySelectorAll( 'a' )
		if ( !links || links.length === 0 ) {
			this.logger.warn( 'Couldn\'t find any link in Serebii.' )
			return null
		}

		return new Set( links.map( i => {
			const href = i.getAttribute( 'href' ) ?? ''
			const url = new URL( href, 'https://www.serebii.net' )
			return `${ url }` // eslint-disable-line @typescript-eslint/restrict-template-expressions
		} ) )
	}

	protected normalizeAttackStyle( name?: string ): string {
		return name === 'Physical Attacker' ? 'Ataque' : 'Ataque especial'
	}

	protected normalizeDifficulty( name?: string ): string {
		if ( name === 'Novice' ) {
			return 'Baja'
		} else if ( name === 'Intermediate' ) {
			return 'Media'
		}
		return 'Alta'
	}

	protected normalizeName( name: string ): string {
		if ( name.startsWith( 'Alolan' ) ) {
			return `${ name.split( / /g ).pop() } de Alola` // eslint-disable-line @typescript-eslint/restrict-template-expressions
		} else if ( name === 'Shield Forme' ) {
			return 'Aegislash (Forma Escudo)'
		} else if ( name === 'Hoopa Unbound' ) {
			return 'Hoopa (Desatado)'
		}

		return name
	}

	protected normalizeRole( name?: string ): string {
		if ( name === 'Attacker' ) {
			return 'Ofensivo'
		} else if ( name === 'All-Rounder' ) {
			return 'Equilibrado'
		} else if ( name === 'Defender' ) {
			return 'Defensivo'
		} else if ( name === 'Speedster' ) {
			return 'Ágil'
		}
		return 'Auxiliar'
	}

	protected normalizeStyle( name?: string ): string {
		return name === 'Ranged' ? 'Largo alcance' : 'Corto alcance'
	}
}
