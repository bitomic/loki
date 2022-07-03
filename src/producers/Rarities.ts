import { HOUR } from '../util'
import { WikiQueue } from '../queues'

export const RaritiesName = 'rarities'

void WikiQueue.add(
	RaritiesName,
	null,
	{
		repeat: {
			every: HOUR
		}
	}
)
