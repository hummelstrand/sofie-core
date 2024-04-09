import { getCurrentTime } from '../lib'
import { JobContext } from '../jobs'
import { makeNewIngestPart } from './ingestCache'
import { IngestRemovePartProps, IngestUpdatePartProps } from '@sofie-automation/corelib/dist/worker/ingest'
import { UpdateIngestRundownChange, runIngestUpdateOperation } from './runOperation'
import { IncomingIngestPartChange } from '@sofie-automation/blueprints-integration'

/**
 * Remove a Part from a Segment
 */
export async function handleRemovedPart(context: JobContext, data: IngestRemovePartProps): Promise<void> {
	return runIngestUpdateOperation(context, data, (ingestRundown) => {
		if (ingestRundown) {
			const ingestSegment = ingestRundown.segments.find((s) => s.externalId === data.segmentExternalId)
			if (!ingestSegment) {
				throw new Error(
					`Rundown "${data.rundownExternalId}" does not have a Segment "${data.segmentExternalId}" to update`
				)
			}
			const partCountBefore = ingestSegment.parts.length
			ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== data.partExternalId)

			if (partCountBefore === ingestSegment.parts.length) {
				return {
					// No change
					ingestRundown,
					changes: {
						source: 'ingest',
					},
				} satisfies UpdateIngestRundownChange
			}
			ingestSegment.modified = getCurrentTime()

			return {
				// We modify in-place
				ingestRundown,
				changes: {
					source: 'ingest',
					segmentChanges: {
						[data.segmentExternalId]: {
							partsChanges: {
								[data.partExternalId]: IncomingIngestPartChange.Deleted,
							},
						},
					},
				},
			} satisfies UpdateIngestRundownChange
		} else {
			throw new Error(`Rundown "${data.rundownExternalId}" not found`)
		}
	})
}

/**
 * Insert or update a Part in a Segment
 */
export async function handleUpdatedPart(context: JobContext, data: IngestUpdatePartProps): Promise<void> {
	return runIngestUpdateOperation(context, data, (ingestRundown) => {
		if (ingestRundown) {
			const ingestSegment = ingestRundown.segments.find((s) => s.externalId === data.segmentExternalId)
			if (!ingestSegment) {
				throw new Error(
					`Rundown "${data.rundownExternalId}" does not have a Segment "${data.segmentExternalId}" to update`
				)
			}
			const partCountBefore = ingestSegment.parts.length
			ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== data.ingestPart.externalId)
			const isUpdate = partCountBefore !== ingestSegment.parts.length

			ingestSegment.parts.push(makeNewIngestPart(data.ingestPart))
			ingestSegment.modified = getCurrentTime()

			return {
				// We modify in-place
				ingestRundown,
				changes: {
					source: 'ingest',
					segmentChanges: {
						[data.segmentExternalId]: {
							partsChanges: {
								[data.ingestPart.externalId]: isUpdate
									? IncomingIngestPartChange.Payload
									: IncomingIngestPartChange.Inserted,
							},
						},
					},
				},
			} satisfies UpdateIngestRundownChange
		} else {
			throw new Error(`Rundown "${data.rundownExternalId}" not found`)
		}
	})
}
