import { IngestModel } from './model/IngestModel'
import { CommitIngestOperation } from './commit'
import { LocalIngestRundown, RundownIngestDataCache } from './ingestCache'
import { getRundownId } from './lib'
import { JobContext } from '../jobs'
import { IngestPropsBase } from '@sofie-automation/corelib/dist/worker/ingest'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { loadIngestModelFromRundownExternalId } from './model/implementation/LoadIngestModel'
import { clone } from '@sofie-automation/corelib/dist/lib'
import {
	CommitIngestData,
	UpdateIngestRundownAction,
	UpdateIngestRundownChange,
	generatePartMap,
	runWithRundownLockInner,
} from './lock'
import { DatabasePersistedModel } from '../modelBase'
import { IngestRundown, IngestSegment } from '@sofie-automation/blueprints-integration'
import { MutableIngestRundownImpl } from '../blueprints/ingest/MutableIngestRundownImpl'
import { CommonContext } from '../blueprints/context'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'

export type UpdateIngestRundownResult2 = UpdateIngestRundownChange | UpdateIngestRundownAction

// nocommit - this needs a better name
export interface ComputedIngestChanges {
	ingestRundown: IngestRundown

	// define what needs regenerating
	segmentsToRemove: string[]
	segmentsUpdatedRanks: Record<string, number> // contains the new rank
	segmentsToRegenerate: IngestSegment[]
	regenerateRundown: boolean // TODO - full vs metadata?
}

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
		pIngestModel.catch(() => null) // Prevent unhandled promise rejection
		const pSofieIngestObjectCache = RundownIngestDataCache.create(
			context,
			context.directCollections.SofieIngestDataCache,
			rundownId
		)
		pSofieIngestObjectCache.catch(() => null) // Prevent unhandled promise rejection
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
		pSaveNrcsIngestChanges.catch(() => null) // Prevent unhandled promise rejection

		let resultingError: UserError | void | undefined

		try {
			const newNrcsIngestRundown = nrcsIngestObjectCache.fetchRundown()

			// Update the Sofie ingest view
			const sofieIngestObjectCache = await pSofieIngestObjectCache
			const oldSofieIngestRundown = clone(sofieIngestObjectCache.fetchRundown())
			const computedChanges = await updateSofieIngestRundown(
				context,
				rundownId,
				newNrcsIngestRundown,
				sofieIngestObjectCache,
				ingestRundownChanges
			)

			// Start saving the Sofie ingest data
			const pSaveSofieIngestChanges = sofieIngestObjectCache.saveToDatabase()

			try {
				resultingError = await updateSofieRundownModel(
					context,
					pIngestModel,
					computedChanges,
					oldSofieIngestRundown
				)
			} finally {
				// Ensure we save the sofie ingest data
				await pSaveSofieIngestChanges
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

async function updateSofieIngestRundown(
	context: JobContext,
	rundownId: RundownId,
	newNrcsIngestRundown: IngestRundown | undefined,
	sofieIngestObjectCache: RundownIngestDataCache,
	ingestRundownChanges: UpdateIngestRundownChange | undefined
): Promise<ComputedIngestChanges | null> {
	if (!newNrcsIngestRundown) {
		// Also delete the Sofie view of the Rundown
		// nocommit Is this correct? Or should we keep the Sofie view as-is until the rundown is deleted? Or perhaps even let the blueprints decide?
		sofieIngestObjectCache.delete()

		return null
	} else if (ingestRundownChanges) {
		const studioBlueprint = context.studioBlueprint.blueprint

		const sofieIngestRundown = sofieIngestObjectCache.fetchRundown()

		const mutableIngestRundown = new MutableIngestRundownImpl(clone(sofieIngestRundown))

		// Let blueprints apply changes to the Sofie ingest data
		if (typeof studioBlueprint.processIngestData === 'function') {
			const blueprintContext = new CommonContext({
				name: 'processIngestData',
				identifier: `studio:${context.studioId},blueprint:${studioBlueprint.blueprintId}`,
			})

			await studioBlueprint.processIngestData(
				blueprintContext,
				newNrcsIngestRundown,
				mutableIngestRundown,
				ingestRundownChanges.changes
			)
		} else {
			mutableIngestRundown.defaultApplyIngestChanges(newNrcsIngestRundown, ingestRundownChanges.changes)
		}

		const resultChanges = mutableIngestRundown.intoIngestRundown(rundownId, sofieIngestRundown)
		//  const newSofieIngestRundown = resultChanges.ingestRundown

		// Sync changes to the cache
		sofieIngestObjectCache.replaceDocuments(resultChanges.changedCacheObjects)
		sofieIngestObjectCache.removeAllOtherDocuments(resultChanges.allCacheObjectIds)

		return resultChanges.computedChanges
	} else {
		// nocommit - should this be doing a delete?
		return null
	}
}

async function updateSofieRundownModel(
	context: JobContext,
	pIngestModel: Promise<IngestModel & DatabasePersistedModel>,
	computedIngestChanges: ComputedIngestChanges | null,
	oldSofieIngestRundown: LocalIngestRundown | undefined
) {
	const ingestModel = await pIngestModel

	// Load any 'before' data for the commit
	const beforeRundown = ingestModel.rundown
	const beforePartMap = generatePartMap(ingestModel)

	let commitData: CommitIngestData | null
	if (computedIngestChanges) {
		const calcSpan = context.startSpan('ingest.calcFcn')
		commitData = await applyCalculatedIngestChangesToModel(
			context,
			ingestModel,
			computedIngestChanges,
			oldSofieIngestRundown
		)
		calcSpan?.end()
	} else {
		// The rundown has been deleted
		// nocommit verify this is sensible
		commitData = {
			changedSegmentIds: [],
			removedSegmentIds: [],
			renamedSegments: new Map(),

			removeRundown: true,

			returnRemoveFailure: false,
		}
	}

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

async function applyCalculatedIngestChangesToModel(
	context: JobContext,
	ingestModel: IngestModel,
	computedIngestChanges: ComputedIngestChanges,
	oldIngestRundown: ReadonlyDeep<IngestRundown> | undefined
): Promise<CommitIngestData> | null {
	// TODO
}
