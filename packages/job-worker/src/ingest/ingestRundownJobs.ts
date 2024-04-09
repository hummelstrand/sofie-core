import { JobContext } from '../jobs'
import { logger } from '../logging'
import { makeNewIngestRundown } from './ingestCache'
import { runWithRundownLock } from './lock'
import { removeRundownFromDb } from '../rundownPlaylists'
import { DBRundown, RundownOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import {
	IngestRegenerateRundownProps,
	IngestRemoveRundownProps,
	IngestUpdateRundownMetaDataProps,
	IngestUpdateRundownProps,
	UserRemoveRundownProps,
	UserUnsyncRundownProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import { UpdateIngestRundownAction, UpdateIngestRundownResult, runIngestUpdateOperation } from './runOperation'
import { IncomingIngestRundownChange } from '@sofie-automation/blueprints-integration'
import { getCurrentTime } from '../lib'

/**
 * Attempt to remove a rundown, or orphan it
 */
export async function handleRemovedRundown(context: JobContext, data: IngestRemoveRundownProps): Promise<void> {
	return runIngestUpdateOperation(context, data, () => {
		// Remove it
		return data.forceDelete ? UpdateIngestRundownAction.FORCE_DELETE : UpdateIngestRundownAction.DELETE
	})
}

/**
 * User requested removing a rundown
 */
export async function handleUserRemoveRundown(context: JobContext, data: UserRemoveRundownProps): Promise<void> {
	/**
	 * As the user requested a delete, it may not be from an ingest gateway, and have a bad relationship between _id and externalId.
	 * Because of this, we must do some more manual steps to ensure it is done correctly, and with as close to correct locking as is reasonable
	 */
	const tmpRundown = await context.directCollections.Rundowns.findOne(data.rundownId)
	if (!tmpRundown || tmpRundown.studioId !== context.studioId) {
		// Either not found, or belongs to someone else
		return
	}

	if (tmpRundown.restoredFromSnapshotId) {
		// Its from a snapshot, so we need to use a lighter locking flow
		return runWithRundownLock(context, data.rundownId, async (rundown, lock) => {
			if (rundown) {
				// It's from a snapshot, so should be removed directly, as that means it cannot run ingest operations
				// Note: this bypasses activation checks, but that probably doesnt matter
				await removeRundownFromDb(context, lock)

				// check if the playlist is now empty
				const rundownCount: Pick<DBRundown, '_id'>[] = await context.directCollections.Rundowns.findFetch(
					{ playlistId: rundown.playlistId },
					{ projection: { _id: 1 } }
				)
				if (rundownCount.length === 0) {
					// A lazy approach, but good enough for snapshots
					await context.directCollections.RundownPlaylists.remove(rundown.playlistId)
				}
			}
		})
	} else {
		// Its a real rundown, so defer to the proper route for deletion
		return handleRemovedRundown(context, {
			rundownExternalId: tmpRundown.externalId,
			peripheralDeviceId: null,
			forceDelete: data.force,
		})
	}
}

/**
 * Insert or update a rundown with a new IngestRundown
 */
export async function handleUpdatedRundown(context: JobContext, data: IngestUpdateRundownProps): Promise<void> {
	return runIngestUpdateOperation(context, data, (ingestRundown) => {
		if (ingestRundown || data.isCreateAction) {
			return {
				ingestRundown: makeNewIngestRundown(data.ingestRundown),
				changes: {
					source: 'ingest',
					rundownChanges: IncomingIngestRundownChange.Regenerate,
				},
			} satisfies UpdateIngestRundownResult
		} else {
			throw new Error(`Rundown "${data.rundownExternalId}" not found`)
		}
	})
}

/**
 * Update a rundown from a new IngestRundown (ingoring IngestSegments)
 */
export async function handleUpdatedRundownMetaData(
	context: JobContext,
	data: IngestUpdateRundownMetaDataProps
): Promise<void> {
	return runIngestUpdateOperation(context, data, (ingestRundown) => {
		if (ingestRundown) {
			return {
				ingestRundown: {
					...data.ingestRundown,
					modified: getCurrentTime(),
					segments: ingestRundown.segments,
				},
				changes: {
					source: 'ingest',
					rundownChanges: IncomingIngestRundownChange.Payload,
				},
			} satisfies UpdateIngestRundownResult
		} else {
			throw new Error(`Rundown "${data.rundownExternalId}" not found`)
		}
	})
}

/**
 * Regnerate a Rundown from the cached IngestRundown
 */
export async function handleRegenerateRundown(context: JobContext, data: IngestRegenerateRundownProps): Promise<void> {
	return runIngestUpdateOperation(context, data, (ingestRundown) => {
		if (ingestRundown) {
			return {
				// We want to regenerate unmodified
				ingestRundown,
				changes: {
					source: 'ingest',
					rundownChanges: IncomingIngestRundownChange.Regenerate,
				},
			} satisfies UpdateIngestRundownResult
		} else {
			throw new Error(`Rundown "${data.rundownExternalId}" not found`)
		}
	})
}

/**
 * User requested unsyncing a rundown
 */
export async function handleUserUnsyncRundown(context: JobContext, data: UserUnsyncRundownProps): Promise<void> {
	return runWithRundownLock(context, data.rundownId, async (rundown) => {
		if (rundown) {
			if (!rundown.orphaned) {
				await context.directCollections.Rundowns.update(rundown._id, {
					$set: {
						orphaned: RundownOrphanedReason.MANUAL,
					},
				})
			} else {
				logger.info(`Rundown "${rundown._id}" was already unsynced`)
			}
		}
	})
}
