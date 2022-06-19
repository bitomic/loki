import { GithubQueue } from '../queues'
import { HOUR } from '../util'

export const CRPName = 'container-retention-policy'

void GithubQueue.add(
	CRPName,
	null,
	{
		repeat: {
			every: HOUR * 24
		}
	}
)
