import { env } from '../lib'
import { Fandom } from 'mw.js'
import type { FandomBot } from 'mw.js'

export const fandom = new Fandom()

export const getFandomBot = (): Promise<FandomBot> => fandom.login( {
	password: env.FANDOM_PASS,
	username: env.FANDOM_USER
} )
