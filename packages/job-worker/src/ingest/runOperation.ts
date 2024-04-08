import { IngestModel } from './model/IngestModel'
import { CommitIngestOperation } from './commit'
import { LocalIngestRundown, RundownIngestDataCache } from './ingestCache'
import { getRundownId } from './lib'
import { JobContext } from '../jobs'
import { IngestPropsBase } from '@sofie-automation/corelib/dist/worker/ingest'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { loadIngestModelFromRundownExternalId } from './model/implementation/LoadIngestModel'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { UpdateIngestRundownAction, UpdateIngestRundownChange, generatePartMap, runWithRundownLockInner } from './lock'
import { DatabasePersistedModel } from '../modelBase'

export type UpdateIngestRundownResult2 = UpdateIngestRundownChange | UpdateIngestRundownAction

/**
 * Perform an ingest update operation on a rundown
 * This will automatically do some post-update data changes, to ensure the playout side (partinstances etc) is updated with the changes
 * @param context Context of the job being run
 * @param studioId Id of the studio the rundown belongs to
 * @param rundownExternalId ExternalId of the rundown to lock
 * @param updateNrcsIngestModelFcn Function to mutate the ingestData. Throw if the requested change is not valid. Return undefined to indicate the ingestData should be deleted
 * @param calcFcn Function to run to update the Rundown. Return the blob of data about the change to help the post-update perform its duties. Return null to indicate that nothing changed
 */
export async function runIngestUpdateOperationNew(
	context: JobContext,
	data: IngestPropsBase,
	updateNrcsIngestModelFcn: (oldIngestRundown: LocalIngestRundown | undefined) => UpdateIngestRundownResult2
): Promise<void> {
	if (!data.rundownExternalId) {
		throw new Error(`Job is missing rundownExternalId`)
	}

	const rundownId = getRundownId(context.studioId, data.rundownExternalId)
	return runWithRundownLockInner(context, rundownId, async (rundownLock) => {
		const span = context.startSpan(`ingestLockFunction.${context.studioId}`)

		// Load the old ingest data
		const pIngestModel = loadIngestModelFromRundownExternalId(context, rundownLock, data.rundownExternalId)
		const nrcsIngestObjectCache = await RundownIngestDataCache.create(
			context,
			context.directCollections.NrcsIngestDataCache,
			rundownId
		)

		// Update the NRCS ingest view
		const { oldNrcsIngestRundown, ingestRundownChanges } = updateNrcsIngestObjects(
			context,
			nrcsIngestObjectCache,
			updateNrcsIngestModelFcn
		)

		// Start saving the nrcs ingest data
		const pSaveNrcsIngestChanges = nrcsIngestObjectCache.saveToDatabase()

		let resultingError: UserError | void | undefined

		try {
			// Update the Sofie ingest view

			// TODO

			// Start saving the Sofie ingest data
			// const pSaveSofieIngestChanges = sofieIngestObjectCache.saveToDatabase()

			try {
				resultingError = await updateSofieRundownModel(
					context,
					pIngestModel,
					ingestRundownChanges,
					oldSofieIngestRundown
				)
			} finally {
				// Ensure we save the sofie ingest data
				// await pSaveSofieIngestChanges
			}
		} finally {
			// Ensure we save the nrcs ingest data
			await pSaveNrcsIngestChanges

			span?.end()
		}

		if (resultingError) throw resultingError
	})
}

function updateNrcsIngestObjects(
	context: JobContext,
	nrcsIngestObjectCache: RundownIngestDataCache,
	updateNrcsIngestModelFcn: (oldIngestRundown: LocalIngestRundown | undefined) => UpdateIngestRundownResult2
): {
	oldNrcsIngestRundown: LocalIngestRundown | undefined
	ingestRundownChanges: UpdateIngestRundownChange | undefined
} {
	const updateNrcsIngestModelSpan = context.startSpan('ingest.calcFcn')
	const oldNrcsIngestRundown = nrcsIngestObjectCache.fetchRundown()
	const updatedIngestRundown = updateNrcsIngestModelFcn(clone(oldNrcsIngestRundown))
	updateNrcsIngestModelSpan?.end()

	let ingestRundownChanges: UpdateIngestRundownChange | undefined
	switch (updatedIngestRundown) {
		// case UpdateIngestRundownAction.REJECT:
		// 	// Reject change
		// 	return
		case UpdateIngestRundownAction.DELETE:
			nrcsIngestObjectCache.delete()
			ingestRundownChanges = undefined
			break
		default:
			nrcsIngestObjectCache.update(updatedIngestRundown.ingestRundown)
			ingestRundownChanges = updatedIngestRundown
			break
	}

	return {
		oldNrcsIngestRundown,
		ingestRundownChanges,
	}
}

async function updateSofieRundownModel(
	context: JobContext,
	pIngestModel: Promise<IngestModel & DatabasePersistedModel>,
	ingestRundownChanges: UpdateIngestRundownChange | undefined,
	oldSofieIngestRundown: LocalIngestRundown | undefined
) {
	const ingestModel = await pIngestModel

	// Load any 'before' data for the commit
	const beforeRundown = ingestModel.rundown
	const beforePartMap = generatePartMap(ingestModel)

	const calcSpan = context.startSpan('ingest.calcFcn')
	const commitData = await calcFcn(context, ingestModel, ingestRundownChanges, oldSofieIngestRundown)
	calcSpan?.end()

	let resultingError: UserError | void | undefined

	if (commitData) {
		const commitSpan = context.startSpan('ingest.commit')
		// The change is accepted. Perform some playout calculations and save it all
		resultingError = await CommitIngestOperation(context, ingestModel, beforeRundown, beforePartMap, commitData)
		commitSpan?.end()
	} else {
		// Should be no changes
		ingestModel.assertNoChanges()
	}

	return resultingError
}
