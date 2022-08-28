import { env, logger } from '../lib'
import { CRPName } from '../producers'
import type { Job } from 'bullmq'
import { Octokit } from '@octokit/core'

export default class {
	protected readonly logger = logger.child( {
		worker: CRPName
	} )
	protected readonly username = 'bitomic'

	public async run( job: Pick<Job, 'name'> ): Promise<void> {
		if ( job.name !== CRPName ) return

		const user = 'bitomic'
		const octokit = new Octokit( {
			auth: env.GITHUB_PAT
		} )

		const packages = ( await octokit.request( 'GET /user/packages', {
			package_type: 'container'
		} ) ).data.filter( i => i.owner?.login === user ).map( i => i.name )
		for ( const name of packages ) {
			const versions = ( await octokit.request( `GET /user/packages/container/${ name }/versions?per_page=100` ) ).data as Array<{
				id: number
				metadata: { container: { tags: [ string ] } }
			}>
			const toDelete = versions
				.slice( 3 )
				.filter( i => !i.metadata.container.tags.includes( 'latest' ) )
				.map( i => i.id )
			for ( const version of toDelete ) {
				await octokit.request( `DELETE /user/packages/container/${ name }/versions/${ version }` )
			}
			if ( toDelete.length > 0 ) {
				this.logger.info( `Deleted ${ toDelete.length } versions for ${ name }.` )
			}
		}
	}
}
