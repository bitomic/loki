import { HOUR } from '../util'
import { WikiQueue } from '../queues'

export const PrefixesName = 'prefixes'

void WikiQueue.add(
	PrefixesName,
	null,
	{
		repeat: {
			every: HOUR
		}
	}
)
