import { Meteor } from 'meteor/meteor'
import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import _ from 'underscore'
import { Rundowns } from '../../../lib/collections/Rundowns'

const REACTIVITY_DEBOUNCE = 20

type ChangedHandler = (rundownIds: RundownId[]) => () => void

export class RundownsObserver {
	#rundownsLiveQuery: Meteor.LiveQueryHandle
	#rundownIds: Set<RundownId> = new Set<RundownId>()
	#changed: ChangedHandler | undefined
	#cleanup: (() => void) | undefined

	constructor(activePlaylistId: RundownPlaylistId, onChanged: ChangedHandler) {
		this.#changed = onChanged
		const cursor = Rundowns.find(
			{
				playlistId: activePlaylistId,
			},
			{
				projection: {
					_id: 1,
				},
			}
		)
		this.#rundownsLiveQuery = cursor.observe({
			added: (doc) => {
				this.#rundownIds.add(doc._id)
				this.updateRundownContent()
			},
			changed: (doc) => {
				this.#rundownIds.add(doc._id)
				this.updateRundownContent()
			},
			removed: (doc) => {
				this.#rundownIds.delete(doc._id)
				this.updateRundownContent()
			},
		})
		this.updateRundownContent()
	}

	public get rundownIds(): RundownId[] {
		return Array.from(this.#rundownIds)
	}

	private innerUpdateRundownContent = () => {
		if (!this.#changed) return
		const changed = this.#changed
		this.#cleanup = changed(this.rundownIds)
	}

	public updateRundownContent = _.debounce(
		Meteor.bindEnvironment(this.innerUpdateRundownContent),
		REACTIVITY_DEBOUNCE
	)

	public dispose = (): void => {
		this.updateRundownContent.cancel()
		this.#rundownsLiveQuery.stop()
		this.#changed = undefined
		this.#cleanup?.()
	}
}
