import { NrcsIngestRundownChangeDetails, IngestPart } from '@sofie-automation/blueprints-integration'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { literal } from '@sofie-automation/corelib/dist/lib'
import {
	MosRundownProps,
	MosRundownMetadataProps,
	MosRundownStatusProps,
	MosRundownReadyToAirProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import { JobContext } from '../../jobs'
import { getCurrentTime } from '../../lib'
import _ = require('underscore')
import { LocalIngestRundown } from '../ingestCache'
import { getRundownId, getPartId, canRundownBeUpdated } from '../lib'
import { runWithRundownLock } from '../lock'
import { parseMosString } from './lib'
import { groupedPartsToSegments, groupIngestParts, storiesToIngestParts } from './mosToIngest'
import { GenerateRundownMode, updateRundownFromIngestData } from '../generationRundown'
import { IngestUpdateOperationFunction, runCustomIngestUpdateOperation } from '../runOperation'

/**
 * Insert or update a mos rundown
 */
export function handleMosRundownData(context: JobContext, data: MosRundownProps): IngestUpdateOperationFunction | null {
	// Create or update a rundown (ie from rundownCreate or rundownList)

	if (parseMosString(data.mosRunningOrder.ID) !== data.rundownExternalId)
		throw new Error('mosRunningOrder.ID and rundownExternalId mismatch!')

	return (ingestRundown) => {
		const rundownId = getRundownId(context.studioId, data.rundownExternalId)
		const parts = _.compact(
			storiesToIngestParts(context, rundownId, data.mosRunningOrder.Stories || [], data.isUpdateOperation, [])
		)
		const groupedStories = groupIngestParts(parts)

		// If this is a reload of a RO, then use cached data to make the change more seamless
		if (data.isUpdateOperation && ingestRundown) {
			const partCacheMap = new Map<PartId, IngestPart>()
			for (const segment of ingestRundown.segments) {
				for (const part of segment.parts) {
					partCacheMap.set(getPartId(rundownId, part.externalId), part)
				}
			}

			for (const annotatedPart of parts) {
				const cached = partCacheMap.get(annotatedPart.partId)
				if (cached && !annotatedPart.ingest.payload) {
					annotatedPart.ingest.payload = cached.payload
				}
			}
		}

		const ingestSegments = groupedPartsToSegments(rundownId, groupedStories)

		return {
			ingestRundown: literal<LocalIngestRundown>({
				externalId: data.rundownExternalId,
				name: parseMosString(data.mosRunningOrder.Slug),
				type: 'mos',
				segments: ingestSegments,
				payload: data.mosRunningOrder,
				modified: getCurrentTime(),
			}),
			changes: {
				source: 'ingest',
				rundownChanges: NrcsIngestRundownChangeDetails.Regenerate, // nocommit this is too coarse
			},
		}
	}
}

/**
 * Update the payload of a mos rundown, without changing any parts or segments
 */
export function handleMosRundownMetadata(
	_context: JobContext,
	data: MosRundownMetadataProps
): IngestUpdateOperationFunction | null {
	return (ingestRundown) => {
		if (ingestRundown) {
			ingestRundown.payload = _.extend(ingestRundown.payload, data.mosRunningOrderBase)
			ingestRundown.modified = getCurrentTime()

			return {
				// We modify in-place
				ingestRundown,
				changes: {
					source: 'ingest',
					rundownChanges: NrcsIngestRundownChangeDetails.Payload,
				},
			}
		} else {
			throw new Error(`Rundown "${data.rundownExternalId}" not found`)
		}
	}
}

/**
 * Update the status of a mos rundown
 */
export async function handleMosRundownStatus(context: JobContext, data: MosRundownStatusProps): Promise<void> {
	const rundownId = getRundownId(context.studioId, data.rundownExternalId)

	return runWithRundownLock(context, rundownId, async (rundown) => {
		if (!rundown) throw new Error(`Rundown "${rundownId}" not found!`)

		if (!canRundownBeUpdated(rundown, false)) return

		await context.directCollections.Rundowns.update(rundown._id, {
			$set: {
				status: data.status,
			},
		})
	})
}

/**
 * Update the ready to air state of a mos rundown
 */
export async function handleMosRundownReadyToAir(context: JobContext, data: MosRundownReadyToAirProps): Promise<void> {
	// nocommit, maybe this should be using the 'standard' flow instead of this custom one?
	return runCustomIngestUpdateOperation(context, data, async (context, ingestModel, ingestRundown) => {
		if (!ingestModel.rundown || ingestModel.rundown.airStatus === data.status) return null

		// If rundown is orphaned, then it should be ignored
		if (ingestModel.rundown.orphaned) return null

		ingestModel.setRundownAirStatus(data.status)

		return updateRundownFromIngestData(
			context,
			ingestModel,
			ingestRundown,
			GenerateRundownMode.MetadataChange,
			data.peripheralDeviceId
		)
	})
}
