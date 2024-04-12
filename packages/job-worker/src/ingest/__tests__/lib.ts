import { removeRundownFromDb } from '../../rundownPlaylists'
import { RundownLock } from '../../jobs/lock'
import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { MockJobContext } from '../../__mocks__/context'
import { LocalIngestRundown } from '../ingestCache'

class FakeRundownLock extends RundownLock {
	constructor(rundownId: RundownId) {
		super(rundownId)
	}
	get isLocked(): boolean {
		return true
	}
	async release(): Promise<void> {
		// Nothing
	}
	//
}

/** For tests, cleanup a playlist and all of its rundowns */
export async function removeRundownPlaylistFromDb(
	context: MockJobContext,
	playlistIds: RundownPlaylistId[]
): Promise<void> {
	const rundowns: Pick<DBRundown, '_id'>[] = await context.mockCollections.Rundowns.findFetch(
		{ playlistId: { $in: playlistIds } },
		{ projection: { _id: 1 } }
	)

	await Promise.allSettled([
		context.mockCollections.RundownPlaylists.remove({ _id: { $in: playlistIds } }),
		rundowns.map(async (rd) => removeRundownFromDb(context, new FakeRundownLock(rd._id))),
	])
}

export function stripModifiedTimestamps(ingestRundown: LocalIngestRundown): void {
	if (ingestRundown.modified) ingestRundown.modified = 1
	for (const segment of ingestRundown.segments) {
		if (segment.modified) segment.modified = 1
		for (const part of segment.parts) {
			if (part.modified) part.modified = 1
		}
	}
}
