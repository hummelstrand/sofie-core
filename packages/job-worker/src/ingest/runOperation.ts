import { IngestModel } from './model/IngestModel'
import { CommitIngestOperation } from './commit'
import { LocalIngestRundown, LocalIngestSegment, RundownIngestDataCache } from './ingestCache'
import { canRundownBeUpdated, getRundownId } from './lib'
import { JobContext } from '../jobs'
import { IngestPropsBase } from '@sofie-automation/corelib/dist/worker/ingest'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { loadIngestModelFromRundownExternalId } from './model/implementation/LoadIngestModel'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { CommitIngestData, UpdateIngestRundownAction, generatePartMap, runWithRundownLockInner } from './lock'
import { DatabasePersistedModel } from '../modelBase'
import { IncomingIngestChange, IngestRundown } from '@sofie-automation/blueprints-integration'
import { MutableIngestRundownImpl } from '../blueprints/ingest/MutableIngestRundownImpl'
import { CommonContext } from '../blueprints/context'
import { PeripheralDeviceId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { GenerateRundownMode, updateRundownFromIngestData, updateRundownFromIngestDataInner } from './generationRundown'
import { calculateSegmentsAndRemovalsFromIngestData, calculateSegmentsFromIngestData } from './generationSegment'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import _ = require('underscore')

export interface UpdateIngestRundownChange {
	ingestRundown: LocalIngestRundown
	changes: IncomingIngestChange
}

export type UpdateIngestRundownResult2 = UpdateIngestRundownChange | UpdateIngestRundownAction

// nocommit - this needs a better name
export interface ComputedIngestChanges {
	ingestRundown: LocalIngestRundown

	// define what needs regenerating
	segmentsToRemove: string[]
	segmentsUpdatedRanks: Record<string, number> // contains the new rank
	segmentsToRegenerate: LocalIngestSegment[]
	regenerateRundown: boolean // TODO - full vs metadata?
}

// nocommit - this needs a better name
export type ComputedIngestChanges2 = ComputedIngestChanges | UpdateIngestRundownAction

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
			// Update the Sofie ingest view
			const sofieIngestObjectCache = await pSofieIngestObjectCache
			const oldSofieIngestRundown = clone(sofieIngestObjectCache.fetchRundown())
			const computedChanges = await updateSofieIngestRundown(
				context,
				rundownId,
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
					oldSofieIngestRundown,
					data.peripheralDeviceId
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
	ingestRundownChanges: UpdateIngestRundownResult2
} {
	const updateNrcsIngestModelSpan = context.startSpan('ingest.calcFcn')
	const oldNrcsIngestRundown = nrcsIngestObjectCache.fetchRundown()
	const updatedIngestRundown = updateNrcsIngestModelFcn(clone(oldNrcsIngestRundown))
	updateNrcsIngestModelSpan?.end()

	switch (updatedIngestRundown) {
		// case UpdateIngestRundownAction.REJECT:
		// 	// Reject change
		// 	return
		case UpdateIngestRundownAction.DELETE:
		case UpdateIngestRundownAction.FORCE_DELETE:
			nrcsIngestObjectCache.delete()
			break
		default:
			nrcsIngestObjectCache.update(updatedIngestRundown.ingestRundown)
			break
	}

	return {
		oldNrcsIngestRundown,
		ingestRundownChanges: updatedIngestRundown,
	}
}

async function updateSofieIngestRundown(
	context: JobContext,
	rundownId: RundownId,
	sofieIngestObjectCache: RundownIngestDataCache,
	ingestRundownChanges: UpdateIngestRundownResult2
): Promise<ComputedIngestChanges2 | null> {
	if (
		ingestRundownChanges === UpdateIngestRundownAction.DELETE ||
		ingestRundownChanges === UpdateIngestRundownAction.FORCE_DELETE
	) {
		// Also delete the Sofie view of the Rundown
		// nocommit Is this correct? Or should we keep the Sofie view as-is until the rundown is deleted? Or perhaps even let the blueprints decide?
		sofieIngestObjectCache.delete()

		return ingestRundownChanges
	} else {
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
				ingestRundownChanges.ingestRundown,
				mutableIngestRundown,
				ingestRundownChanges.changes
			)
		} else {
			mutableIngestRundown.defaultApplyIngestChanges(
				ingestRundownChanges.ingestRundown,
				ingestRundownChanges.changes
			)
		}

		const resultChanges = mutableIngestRundown.intoIngestRundown(rundownId, sofieIngestRundown)
		//  const newSofieIngestRundown = resultChanges.ingestRundown

		// Sync changes to the cache
		sofieIngestObjectCache.replaceDocuments(resultChanges.changedCacheObjects)
		sofieIngestObjectCache.removeAllOtherDocuments(resultChanges.allCacheObjectIds)

		return resultChanges.computedChanges
	}
}

async function updateSofieRundownModel(
	context: JobContext,
	pIngestModel: Promise<IngestModel & DatabasePersistedModel>,
	computedIngestChanges: ComputedIngestChanges2 | null,
	oldSofieIngestRundown: LocalIngestRundown | undefined,
	peripheralDeviceId: PeripheralDeviceId | null
) {
	const ingestModel = await pIngestModel

	// Load any 'before' data for the commit
	const beforeRundown = ingestModel.rundown
	const beforePartMap = generatePartMap(ingestModel)

	let commitData: CommitIngestData | null = null

	if (
		computedIngestChanges === UpdateIngestRundownAction.DELETE ||
		computedIngestChanges === UpdateIngestRundownAction.FORCE_DELETE
	) {
		// Check if it exists and can be deleted
		const rundown = ingestModel.rundown
		if (rundown) {
			const canRemove =
				computedIngestChanges === UpdateIngestRundownAction.FORCE_DELETE || canRundownBeUpdated(rundown, false)
			if (!canRemove) throw UserError.create(UserErrorMessage.RundownRemoveWhileActive, { name: rundown.name })

			// The rundown has been deleted
			commitData = {
				changedSegmentIds: [],
				removedSegmentIds: [],
				renamedSegments: new Map(),

				removeRundown: true,
				returnRemoveFailure: true,
			}
		}
	} else if (computedIngestChanges) {
		const calcSpan = context.startSpan('ingest.calcFcn')
		commitData = await applyCalculatedIngestChangesToModel(
			context,
			ingestModel,
			computedIngestChanges,
			oldSofieIngestRundown,
			peripheralDeviceId
		)
		calcSpan?.end()
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
	oldIngestRundown: ReadonlyDeep<IngestRundown> | undefined,
	peripheralDeviceId: PeripheralDeviceId | null
): Promise<CommitIngestData | null> {
	const newIngestRundown = computedIngestChanges.ingestRundown

	// Ensure the rundown can be updated
	const rundown = ingestModel.rundown
	if (!canRundownBeUpdated(rundown, false)) return null

	const span = context.startSpan('ingest.applyCalculatedIngestChangesToModel')

	if (!rundown || computedIngestChanges.regenerateRundown) {
		// Do a full regeneration

		const result = await updateRundownFromIngestData(
			context,
			ingestModel,
			newIngestRundown,
			GenerateRundownMode.Create,
			peripheralDeviceId
		)

		span?.end()
		return result
	} else {
		// Update segment ranks:
		for (const [segmentExternalId, newRank] of Object.entries<number>(computedIngestChanges.segmentsUpdatedRanks)) {
			const segment = ingestModel.getSegmentByExternalId(segmentExternalId)
			if (segment) {
				segment.setRank(newRank)
			}
		}

		// Updated segments that has had their segment.externalId changed:
		const renamedSegments = new Map<SegmentId, SegmentId>() // nocommit: reimplement: applyExternalIdDiff(ingestModel, segmentDiff, true)

		// If requested, regenerate the rundown in the 'metadata' mode
		if (computedIngestChanges.regenerateRundown) {
			const regenerateCommitData = await updateRundownFromIngestDataInner(
				context,
				ingestModel,
				newIngestRundown,
				GenerateRundownMode.MetadataChange, // TODO - full vs metadata?
				peripheralDeviceId
			)
			if (regenerateCommitData?.regenerateAllContents) {
				const regeneratedSegmentIds = await calculateSegmentsAndRemovalsFromIngestData(
					context,
					ingestModel,
					newIngestRundown,
					regenerateCommitData.allRundownWatchedPackages
				)

				// TODO - should this include the ones which were renamed/updated ranks above?
				return {
					changedSegmentIds: regeneratedSegmentIds.changedSegmentIds,
					removedSegmentIds: regeneratedSegmentIds.removedSegmentIds,
					renamedSegments: renamedSegments,

					removeRundown: false,
				} satisfies CommitIngestData
			}
		}

		// Create/Update segments
		const segmentsToRegenerate = _.sortBy([...computedIngestChanges.segmentsToRegenerate], (se) => se.rank)
		const changedSegmentIds = await calculateSegmentsFromIngestData(
			context,
			ingestModel,
			segmentsToRegenerate,
			null
		)

		const changedSegmentIdsSet = new Set<SegmentId>(changedSegmentIds)
		for (const segmentId of Object.keys(computedIngestChanges.segmentsUpdatedRanks)) {
			changedSegmentIdsSet.add(ingestModel.getSegmentIdFromExternalId(segmentId))
		}
		// TODO - include changed external ids?

		// Remove/orphan old segments
		const orphanedSegmentIds: SegmentId[] = []
		for (const segmentExternalId of computedIngestChanges.segmentsToRemove) {
			const segment = ingestModel.getSegmentByExternalId(segmentExternalId)
			if (segment) {
				// We orphan it and queue for deletion. the commit phase will complete if possible
				orphanedSegmentIds.push(segment.segment._id)
				segment.setOrphaned(SegmentOrphanedReason.DELETED)

				segment.removeAllParts()

				// It can't also have been changed if it is deleted
				changedSegmentIdsSet.delete(segment.segment._id)
			}
		}

		span?.end()
		return {
			changedSegmentIds: Array.from(changedSegmentIdsSet),
			removedSegmentIds: orphanedSegmentIds, // Only inform about the ones that werent renamed
			renamedSegments: renamedSegments,

			removeRundown: false,
		} satisfies CommitIngestData
	}
}
