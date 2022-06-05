import { env } from '../lib'
import { Fandom } from 'mw.js'
import type { FandomBot } from 'mw.js'

export const fandom = new Fandom()

let bot: FandomBot | null

export const getFandomBot = async (): Promise<FandomBot> => {
	if ( bot ) {
		const whoami = await bot.whoAmI()
		if ( whoami.query.userinfo.id === 0 ) bot = null
	}

	if ( !bot ) {
		bot = await fandom.login( {
			password: env.FANDOM_PASS,
			username: env.FANDOM_USER
		} )
	}

	return bot
}
