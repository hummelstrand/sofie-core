import { getCurrentTime } from '../lib'
import { JobContext } from '../jobs'
import { LocalIngestRundown, makeNewIngestPart } from './ingestCache'
import { IngestRemovePartProps, IngestUpdatePartProps } from '@sofie-automation/corelib/dist/worker/ingest'
import { UpdateIngestRundownChange } from './runOperation'
import { NrcsIngestPartChangeDetails } from '@sofie-automation/blueprints-integration'

/**
 * Remove a Part from a Segment
 */
export function handleRemovedPart(
	_context: JobContext,
	data: IngestRemovePartProps,
	ingestRundown: LocalIngestRundown | undefined
): UpdateIngestRundownChange {
	if (!ingestRundown) throw new Error(`Rundown "${data.rundownExternalId}" not found`)

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
						[data.partExternalId]: NrcsIngestPartChangeDetails.Deleted,
					},
				},
			},
		},
	} satisfies UpdateIngestRundownChange
}

/**
 * Insert or update a Part in a Segment
 */
export function handleUpdatedPart(
	_context: JobContext,
	data: IngestUpdatePartProps,
	ingestRundown: LocalIngestRundown | undefined
): UpdateIngestRundownChange {
	if (!ingestRundown) throw new Error(`Rundown "${data.rundownExternalId}" not found`)

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
							? NrcsIngestPartChangeDetails.Updated
							: NrcsIngestPartChangeDetails.Inserted,
					},
				},
			},
		},
	} satisfies UpdateIngestRundownChange
}
