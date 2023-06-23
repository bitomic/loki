import { format } from 'lua-json'
import type { JobsOptions } from 'bullmq'
import { request } from 'undici'
import { s } from '@sapphire/shapeshift'
import { Task } from '../../framework'
import { Time } from '@sapphire/duration'

interface MoveStats {
	base: number
	dmg_type: string
	label: string
	levelScale: number
	statScale: number
}

interface MovesModule {
	[ pokemon: string ]: {
		[ move: string ]: {
			cooldown?: number
			stats?: MoveStats[]
			type?: string
		}
	}
}

export class UserTask extends Task {
	protected static readonly validator = s.object( {
		display_name: s.string,
		skills: s.object( {
			cd: s.string.or( s.number ).optional,
			name: s.string,
			rsb: s.object( {} ).passthrough.optional,
			type: s.string.optional,
			upgrades: s.object( {
				cd: s.string.or( s.number ).optional,
				cd1: s.string.or( s.number ).optional,
				name: s.string,
				rsb: s.object( {} ).passthrough,
				type: s.string
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
				const move: MovesModule[ string ][ string ] = {}
				if ( skill.type ) move.type = skill.type

				const cooldown = skill.cd
				if ( cooldown && ( typeof cooldown !== 'string' || cooldown.length > 0 ) ) {
					move.cooldown = typeof cooldown === 'number' ? cooldown : parseInt( cooldown, 10 )
				}
				pokemon[ skill.name ] = move
				const stats = this.addMoves( skill.rsb )
				if ( stats ) {
					move.stats = stats
				}

				if ( !skill.upgrades ) continue
				for ( const upgrade of skill.upgrades ) {
					const move: MovesModule[ string ][ string ] = {
						type: upgrade.type
					}
					const cooldown = upgrade.cd ?? upgrade.cd1
					if ( cooldown ) {
						move.cooldown = typeof cooldown === 'number' ? cooldown : parseInt( cooldown, 10 )
					}
					pokemon[ upgrade.name ] = move

					const stats = this.addMoves( upgrade.rsb )
					if ( stats ) {
						move.stats = stats
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

	protected addMoves( rsb: Record<string, unknown> ): MoveStats[] | null {
		const moves: MoveStats[] = []
		for ( let i = 0; i <= 5; i++ ) {
			const prefix = i === 0 ? '' : `add${ i }_`
			const move = this.getMoveFields( rsb, prefix )
			if ( !move ) break
			moves.push( move )
		}

		return moves.length ? moves : null
	}

	protected getMoveFields<T extends string>( move: unknown, prefix: T ): MoveStats | null {
		const validator = s.object( {
			[ `${ prefix }label` ]: s.string.lengthGreaterThan( 0 ),
			[ `${ prefix }ratio` ]: s.string.transform( v => v.length ? v : '0' ),
			[ `${ prefix }dmg_type` ]: s.string.optional,
			[ `${ prefix }slider` ]: s.string.transform( v => v.length ? v : '0' ),
			[ `${ prefix }base` ]: s.string.transform( v => v.length ? v : '0' )
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
