import type { ArrayValidator } from '@sapphire/shapeshift'
import { format } from 'lua-json'
import type { JobsOptions } from 'bullmq'
import { request } from 'undici'
import { s } from '@sapphire/shapeshift'
import { Task } from '../../framework'
import { Time } from '@sapphire/duration'

interface IBasicData {
	attackStyle: string
	difficulty: string
	name: string
	role: string
	style: string
}

interface IStatsLevel {
	attack: number
	defense: number
	hp: number
	specialAttack: number
	specialDefense: number
}

interface IAllStats {
	stats: Record<string, Partial<IStatsLevel>>
}

export class UserTask extends Task {
	public static readonly STAT = s.object( {
		level: s.object( {
			attack: s.number,
			defense: s.number,
			hp: s.number,
			sp_attack: s.number,
			sp_defense: s.number
		} ).array,
		name: s.string
	} ).ignore

	public static readonly POKEMON = s.object( {
		damage_type: s.enum( ...[ 'Physical', 'Special' ] as const ),
		display_name: s.string,
		name: s.string,
		tags: s.object( {
			difficulty: s.enum( ...[ 'Novice', 'Intermediate', 'Expert' ] as const ),
			range: s.enum( ...[ 'Melee', 'Ranged' ] as const ),
			role: s.enum( ...[ 'Speedster', 'All-Rounder', 'Defender', 'Supporter', 'Attacker' ] as const )
		} )
	} ).ignore

	public override jobOptions: JobsOptions = {
		repeat: {
			every: Time.Day
		}
	}

	public async run(): Promise<void> {
		const stats = await UserTask.getJson( 'https://unite-db.com/stats.json', UserTask.STAT.array )
		const pokemon = await UserTask.getJson( 'https://unite-db.com/pokemon.json', UserTask.POKEMON.array )

		const data: Record<string, IBasicData & IAllStats> = {}

		const NAME_REPLACEMENTS: Record<string, string> = {
			'Ninetales': 'Ninetales de Alola'
		}
		const ATTACK_STYLES = {
			Physical: 'Ataque',
			Special: 'Ataque especial'
		}
		const DIFFICULTIES = {
			Expert: 'Alta',
			Intermediate: 'Media',
			Novice: 'Baja'
		}
		const RANGES = {
			Melee: 'Corto alcance',
			Ranged: 'Largo alcance'
		}
		const ROLES = {
			'All-Rounder': 'Equilibrado',
			Attacker: 'Ofensivo',
			Defender: 'Defensivo',
			Speedster: 'Ágil',
			Supporter: 'Auxiliar'
		}

		for ( const key in stats ) {
			const stat = stats[ key ]
			const item = pokemon[ key ]
			if ( !stat || !item ) {
				this.logger.error( 'Missing data.' )
				continue
			}

			const name = NAME_REPLACEMENTS[ item.display_name ] ?? item.display_name

			data[ name ] = {
				attackStyle: ATTACK_STYLES[ item.damage_type ],
				difficulty: DIFFICULTIES[ item.tags.difficulty ],
				name,
				role: ROLES[ item.tags.role ],
				stats: Object.fromEntries( Object.entries( stat.level ).map( ( [ idx, item ] ) => [
					`${ parseInt( idx, 10 ) + 1 }`,
					{
						attack: item.attack,
						defense: item.defense,
						hp: item.hp,
						specialAttack: item.sp_attack,
						specialDefense: item.sp_defense
					}
				] ) ),
				style: RANGES[ item.tags.range ]
			}
		}

		const wiki = UserTask.getFandomWiki( 'es.pokemon-unite' )
		const bot = await UserTask.getBot( wiki )
		await bot.edit( {
			bot: true,
			text: format( data ),
			title: 'Module:Pokémon/datos'
		} )
	}

	protected static async getJson<T extends ArrayValidator<unknown[]>>( url: string, validator: T ): Promise<Record<string, ReturnType<T[ 'parse' ]>[ number ]>> {
		const { body } = await request( url )
		const data = validator.parse( await body.json() )
		type Collection = Record<string, ReturnType<T[ 'parse' ]>[ number ]>

		const reshaped = {} as Collection
		for ( const item of data ) {
			if ( item && typeof item === 'object' && 'name' in item ) {
				const { name } = item
				if ( typeof name === 'string' ) {
					reshaped[ name ] = item
				}
			}
		}

		return reshaped
	}
}
