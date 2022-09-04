import { Fandom } from 'mw.js'
import { format } from 'lua-json'
import { HOUR } from '../../util'
import type { HTMLElement } from 'node-html-parser'
import type { JobsOptions } from 'bullmq'
import { parse } from 'node-html-parser'
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
	speed: string | null
	stats: Record<string, Partial<IStatsLevel>>
}

export class UserTask extends Task {
	public override jobOptions: JobsOptions = {
		repeat: {
			every: HOUR * 24
		}
	}

	public async run(): Promise<void> {
		const links = await this.getLinks()
		if ( !links ) return

		/*
		const links = [
			'https://www.serebii.net/pokemonunite/pokemon/venusaur.shtml',
			'https://www.serebii.net/pokemonunite/pokemon/hoopa.shtml',
			'https://www.serebii.net/pokemonunite/pokemon/aegislash.shtml'
		]
		*/

		const data: {
			[ key: string ]: IBasicData & {
				speed: string | null
				stats: Record<string, Partial<IStatsLevel>>
			}
		} = {}
		for ( const link of links ) {
			const { body } = await request( link )
			const parsed = parse( await body.text() )
			const basicData = this.getBasicData( parsed )
			const stats = this.getStats( parsed )
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
		return parsed.querySelector( '.tab' )?.querySelectorAll( '.fooinfo' ) // the main table where the image is
			.map( ( i, idx ) => {
				const lastColumn = i.nextElementSibling.nextElementSibling.querySelectorAll( 'tr' ).map( i => i.querySelectorAll( 'td' ).pop() )
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
	}

	protected getStats( parsed: HTMLElement ): IAllStats[] {
		const statsTables = parsed.querySelectorAll( 'h2' ).filter( i => i.innerText.startsWith( 'Stats' ) )
			.map( i => i.parentNode.parentNode.parentNode.querySelectorAll( 'tr' ) )
		const allStats: IAllStats[] = []

		for ( const statsTable of statsTables ) {
			const stats: Record<string, Partial<IStatsLevel>> = {}
			let speed: string | null = null
			for ( const row of statsTable ) {
				const tds = row.querySelectorAll( 'td.cen' )
				if ( tds.length !== 7 ) continue
				const [ level, hp, attack, defense, specialAttack, specialDefense, rowSpeed ] = tds.map( i => i.innerText )
				const idx = level?.match( /\d+/ )?.at( 0 )
				if ( !idx ) continue
				const statsLevel = stats[ idx ] ?? {}
				if ( hp && parseInt( hp, 10 ) ) statsLevel.hp = hp
				if ( attack && parseInt( attack, 10 ) ) statsLevel.attack = attack
				if ( defense && parseInt( defense, 10 ) ) statsLevel.defense = defense
				if ( specialAttack && parseInt( specialAttack, 10 ) ) statsLevel.specialAttack = specialAttack
				if ( specialDefense && parseInt( specialDefense, 10 ) ) statsLevel.specialDefense = specialDefense
				if ( rowSpeed && parseInt( rowSpeed, 10 ) ) speed = rowSpeed

				stats[ idx ] ??= statsLevel
			}

			allStats.push( { speed, stats } )
		}

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
