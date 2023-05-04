import { Task } from './Task'
import type { Wiki } from '@quority/core'

export abstract class WikiTask extends Task {
	protected async getPagesInCategory( wiki: Wiki, category: string ): Promise<string[]> {
		return ( await wiki.queryList( {
			cmlimit: 'max',
			cmnamespace: 0,
			cmtitle: `Category:${ category }`,
			list: 'categorymembers'
		} ) ).map( i => i.title )
	}

	protected async getTransclusions( wiki: Wiki, template: string ): Promise<string[]> {
		return ( await wiki.queryProp( {
			prop: 'transcludedin',
			tilimit: 'max',
			tinamespace: 0,
			tishow: '!redirect',
			titles: `Plantilla:${ template }`
		} ) ).map( i => i.transcludedin?.map( i => i.title ) ).flat() // eslint-disable-line
	}
}
