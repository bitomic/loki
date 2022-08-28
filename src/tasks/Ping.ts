import type { JobsOptions } from 'bullmq'
import { Task } from '../framework'

export class UserTask extends Task {
	public override jobOptions: JobsOptions = {
		repeat: {
			cron: '*/5 * * * * *'
		}
	}

	public run(): void {
		this.logger.info( 'ping' )
	}
}
