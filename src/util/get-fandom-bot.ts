import { env } from '../lib'
import { Fandom } from 'mw.js'
import type { FandomBot } from 'mw.js'

export const getFandomBot = async (): Promise<FandomBot> => new Fandom().login( {
	password: env.FANDOM_PASS,
	username: env.FANDOM_USER
} )