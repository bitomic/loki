import { format } from 'lua-json'
import type { JobsOptions } from 'bullmq'
import { request } from 'undici'
import { s } from '@sapphire/shapeshift'
import { Task } from '../../framework'
import { Time } from '@sapphire/duration'

interface MoveData {
	base: number
	dmg_type: string
	label: string
	levelScale: number
	statScale: number
}

interface MovesModule {
	[ pokemon: string ]: {
		[ move: string ]: MoveData[]
	}
}

const NAME_CONVERSIONS: Record<string, string> = {
	Ninetales: 'Ninetales de Alola'
}

export class UserTask extends Task {
	protected static readonly validator = s.object( {
		display_name: s.string.transform( n => NAME_CONVERSIONS[ n ] ?? n ),
		skills: s.object( {
			name: s.string,
			rsb: s.object( {} ).passthrough.optional,
			upgrades: s.object( {
				name: s.string,
				rsb: s.object( {} ).passthrough
			} ).passthrough.array.optional
		} ).passthrough.array
	} ).ignore.array

	public override jobOptions: JobsOptions = {
		repeat: {
			every: Time.Day
		}
	}

	public async run(): Promise<void> {
		const data = UserTask.validator.parse( await this.getJson() )

		const module: MovesModule = {}
		for ( const { display_name, skills } of data ) {
			const pokemon: MovesModule[ string ] = {}

			for ( const skill of skills ) {
				if ( !skill.rsb ) continue
				const moves = this.addMoves( skill.rsb )
				if ( moves ) {
					pokemon[ skill.name ] = moves
				}

				if ( !skill.upgrades ) continue
				for ( const upgrade of skill.upgrades ) {
					const moves = this.addMoves( upgrade.rsb )
					if ( moves ) {
						pokemon[ upgrade.name ] = moves
					}
				}
			}

			if ( Object.keys( pokemon ).length ) {
				module[ display_name ] = pokemon
			}
		}

		const wiki = UserTask.getFandomWiki( 'es.pokemon-unite' )
		const bot = await UserTask.getBot( wiki )
		await bot.edit( {
			bot: true,
			text: format( module ),
			title: 'Module:Movimientos/datos'
		} )
	}

	protected addMoves( rsb: Record<string, unknown> ): MoveData[] | null {
		const moves: MoveData[] = []
		for ( let i = 0; i <= 5; i++ ) {
			const prefix = i === 0 ? '' : `add${ i }_`
			const move = this.getMoveFields( rsb, prefix )
			if ( !move ) break
			moves.push( move )
		}

		return moves.length ? moves : null
	}

	protected getMoveFields<T extends string>( move: unknown, prefix: T ): MovesModule[ string ][ string ][ number ] | null {
		const validator = s.object( {
			[ `${ prefix }label` ]: s.string.lengthGreaterThan( 0 ),
			[ `${ prefix }ratio` ]: s.string.lengthGreaterThan( 0 ),
			[ `${ prefix }dmg_type` ]: s.string.lengthGreaterThan( 0 ),
			[ `${ prefix }slider` ]: s.string.lengthGreaterThan( 0 ),
			[ `${ prefix }base` ]: s.string.lengthGreaterThan( 0 )
		} )
		const parsed = validator.run( move )
		if ( parsed.isErr() ) return null
		type Attribute = 'label' | 'ratio' | 'dmg_type' | 'slider' | 'base'
		const data = parsed.unwrap() as Record<`${ typeof prefix }${ Attribute }`, string>

		return {
			base: parseInt( data[ `${ prefix }base` ], 10 ),
			dmg_type: data[ `${ prefix }dmg_type` ],
			label: data[ `${ prefix }label` ],
			levelScale: parseInt( data[ `${ prefix }slider` ], 10 ),
			statScale: parseInt( data[ `${ prefix }ratio` ], 10 )
		}
	}

	protected async getJson(): Promise<unknown> {
		const { body } = await request( 'https://unite-db.com/pokemon.json' )
		return body.json()
	}
}
