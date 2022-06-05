import { magentaBright } from 'colorette'
import Pino from 'pino'
import pretty from 'pino-pretty'

export const pino = Pino( pretty( {
	colorize: true,
	customPrettifiers: {
		time: ( ts: string | object ) => magentaBright(
			typeof ts === 'string'
				? new Date( ts ).toISOString()
				: new Date().toISOString() )
	},
	ignore: 'pid,hostname'
} ) )
