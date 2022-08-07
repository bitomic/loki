import { HOUR } from '../util'
import { WikiQueue } from '../queues'

export const RecipesName = 'recipes'

void WikiQueue.add(
	RecipesName,
	null,
	{
		repeat: {
			every: 6 * HOUR
		}
	}
)
