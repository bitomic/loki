import { HOUR } from '../../util'
import { WikiQueue } from '../../queues'

export const UniteNewsName = 'unite-news'

void WikiQueue.add(
	UniteNewsName,
	null,
	{
		repeat: {
			every: HOUR * 12
		}
	}
)
