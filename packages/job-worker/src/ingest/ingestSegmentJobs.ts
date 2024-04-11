import { getCurrentTime } from '../lib'
import { JobContext } from '../jobs'
import { regenerateSegmentsFromIngestData } from './generationSegment'
import { makeNewIngestSegment } from './ingestCache'
import { CommitIngestData } from './lock'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { literal } from '@sofie-automation/corelib/dist/lib'
import {
	IngestRegenerateSegmentProps,
	IngestRemoveSegmentProps,
	IngestUpdateSegmentProps,
	IngestUpdateSegmentRanksProps,
	RemoveOrphanedSegmentsProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import { runCustomIngestUpdateOperation, runIngestUpdateOperation } from './runOperation'
import { NrcsIngestSegmentChangeDetailsEnum } from '@sofie-automation/blueprints-integration'

/**
 * Regnerate a Segment from the cached IngestSegment
 */
export async function handleRegenerateSegment(context: JobContext, data: IngestRegenerateSegmentProps): Promise<void> {
	return runIngestUpdateOperation(context, data, (ingestRundown) => {
		if (ingestRundown) {
			// Ensure the target segment exists in the cache
			const ingestSegment = ingestRundown.segments.find((s) => s.externalId === data.segmentExternalId)
			if (!ingestSegment) {
				throw new Error(
					`Rundown "${data.rundownExternalId}" does not have a Segment "${data.segmentExternalId}" to update`
				)
			}

			return {
				// We modify in-place
				ingestRundown,
				changes: {
					source: 'ingest',
					segmentChanges: {
						[data.segmentExternalId]: {
							payloadChanged: true,
						},
					},
				},
			}
		} else {
			throw new Error(`Rundown "${data.rundownExternalId}" not found`)
		}
	})
}

/**
 * Attempt to remove a segment, or orphan it
 */
export async function handleRemovedSegment(context: JobContext, data: IngestRemoveSegmentProps): Promise<void> {
	return runIngestUpdateOperation(context, data, (ingestRundown) => {
		if (ingestRundown) {
			const oldSegmentsLength = ingestRundown.segments.length
			ingestRundown.segments = ingestRundown.segments.filter((s) => s.externalId !== data.segmentExternalId)
			ingestRundown.modified = getCurrentTime()

			if (ingestRundown.segments.length === oldSegmentsLength) {
				throw new Error(
					`Rundown "${data.rundownExternalId}" does not have a Segment "${data.segmentExternalId}" to remove`
				)
			}

			return {
				// We modify in-place
				ingestRundown,
				changes: {
					source: 'ingest',
					segmentChanges: {
						[data.segmentExternalId]: NrcsIngestSegmentChangeDetailsEnum.Deleted,
					},
				},
			}
		} else {
			throw new Error(`Rundown "${data.rundownExternalId}" not found`)
		}
	})
}

/**
 * Insert or update a segment from a new IngestSegment
 */
export async function handleUpdatedSegment(context: JobContext, data: IngestUpdateSegmentProps): Promise<void> {
	const segmentExternalId = data.ingestSegment.externalId
	if (!segmentExternalId) throw new Error('Segment externalId must be set!')

	return runIngestUpdateOperation(context, data, (ingestRundown) => {
		if (ingestRundown) {
			const countBefore = ingestRundown.segments.length
			ingestRundown.segments = ingestRundown.segments.filter((s) => s.externalId !== segmentExternalId)
			if (countBefore === ingestRundown.segments.length && !data.isCreateAction)
				throw new Error(`Segment "${data.ingestSegment.externalId}" not found`)

			ingestRundown.segments.push(makeNewIngestSegment(data.ingestSegment))
			ingestRundown.modified = getCurrentTime()

			return {
				// We modify in-place
				ingestRundown,
				changes: {
					source: 'ingest',
					segmentChanges: {
						[segmentExternalId]: NrcsIngestSegmentChangeDetailsEnum.Inserted, // This forces downstream to do a full diff themselves
					},
				},
			}
		} else {
			throw new Error(`Rundown "${data.rundownExternalId}" not found`)
		}
	})
}

/**
 * Update the ranks of the Segments in a Rundown
 */
export async function handleUpdatedSegmentRanks(
	context: JobContext,
	data: IngestUpdateSegmentRanksProps
): Promise<void> {
	return runIngestUpdateOperation(context, data, (ingestRundown) => {
		if (ingestRundown) {
			let hasChange = false

			// Update ranks on ingest data
			for (const segment of ingestRundown.segments) {
				const newRank = Number(data.newRanks[segment.externalId])
				if (!isNaN(newRank)) {
					segment.rank = newRank
					hasChange = true
				}
			}

			return {
				// We modify in-place
				ingestRundown,
				changes: {
					source: 'ingest',
					segmentOrderChanged: hasChange,
				},
			}
		} else {
			throw new Error(`Rundown "${data.rundownExternalId}" not found`)
		}
	})
}

/**
 * Check for and remove any orphaned segments if their contents are no longer on air
 */
export async function handleRemoveOrphanedSegemnts(
	context: JobContext,
	data: RemoveOrphanedSegmentsProps
): Promise<void> {
	return runCustomIngestUpdateOperation(context, data, async (_context, ingestModel, ingestRundown) => {
		// Find the segments that are still orphaned (in case they have resynced before this executes)
		// We flag them for deletion again, and they will either be kept if they are somehow playing, or purged if they are not
		const stillOrphanedSegments = ingestModel.getOrderedSegments().filter((s) => !!s.segment.orphaned)

		// Note: scratchpad segments are ignored here, as they will never be in the ingestModel

		const stillHiddenSegments = stillOrphanedSegments.filter(
			(s) =>
				s.segment.orphaned === SegmentOrphanedReason.HIDDEN &&
				data.orphanedHiddenSegmentIds.includes(s.segment._id)
		)

		const stillDeletedSegmentIds = stillOrphanedSegments
			.filter(
				(s) =>
					s.segment.orphaned === SegmentOrphanedReason.DELETED &&
					data.orphanedDeletedSegmentIds.includes(s.segment._id)
			)
			.map((s) => s.segment._id)

		const hiddenSegmentIds = ingestModel
			.getOrderedSegments()
			.filter((s) => !!stillHiddenSegments.find((a) => a.segment._id === s.segment._id))
			.map((s) => s.segment._id)

		const { result } = await regenerateSegmentsFromIngestData(context, ingestModel, ingestRundown, hiddenSegmentIds)

		const changedHiddenSegments = result?.changedSegmentIds ?? []

		// Make sure any orphaned hidden segments arent marked as hidden
		for (const segment of stillHiddenSegments) {
			if (!changedHiddenSegments.includes(segment.segment._id)) {
				if (segment.segment.isHidden && segment.segment.orphaned === SegmentOrphanedReason.HIDDEN) {
					segment.setOrphaned(undefined)
					changedHiddenSegments.push(segment.segment._id)
				}
			}
		}

		if (changedHiddenSegments.length === 0 && stillDeletedSegmentIds.length === 0) {
			// Nothing could have changed, so take a shortcut and skip any saving
			return null
		}

		return literal<CommitIngestData>({
			changedSegmentIds: changedHiddenSegments,
			removedSegmentIds: stillDeletedSegmentIds,
			renamedSegments: new Map(),
			removeRundown: false,
		})
	})
}
