import { env } from '../../lib'
import type { JobsOptions } from 'bullmq'
import { Octokit } from '@octokit/core'
import { Task } from '../../framework'
import { Time } from '@sapphire/duration'

export class UserTask extends Task {
	public override jobOptions: JobsOptions = {
		repeat: {
			every: Time.Day
		}
	}

	public async run(): Promise<void> {
		const octokit = new Octokit( {
			auth: env.GITHUB_PAT
		} )

		const packages = await this.getMyPackages( octokit, 'bitomic' )

		for ( const name of packages ) {
			const toDelete = await this.getVersionsToDelete( octokit, name )
			for ( const version of toDelete ) {
				await octokit.request( `DELETE /user/packages/container/${ name }/versions/${ version }` )
			}
			if ( toDelete.length > 0 ) {
				this.logger.info( `Deleted ${ toDelete.length } versions for ${ name }.` )
			}
		}
	}

	protected async getMyPackages( octokit: Octokit, user: string ): Promise<string[]> {
		const req = await octokit.request( 'GET /user/packages', {
			package_type: 'container'
		} )
		return req.data.filter( i => i.owner?.login === user ).map( i => i.name )
	}

	protected async getVersionsToDelete( octokit: Octokit, name: string ) {
		const versions = ( await octokit.request( `GET /user/packages/container/${ name }/versions?per_page=100` ) ).data as Array<{
			id: number
			metadata: { container: { tags: [ string ] } }
		}>
		return versions
			.slice( 3 )
			.filter( i => !i.metadata.container.tags.includes( 'latest' ) )
			.map( i => i.id )
	}
}
