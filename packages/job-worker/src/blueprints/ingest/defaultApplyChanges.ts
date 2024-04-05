import {
	IngestRundown,
	IncomingIngestChange,
	IngestDefaultChangesOptions,
	IncomingIngestRundownChange,
	MutableIngestRundown,
	IncomingIngestSegmentChange,
	IngestSegment,
} from '@sofie-automation/blueprints-integration'
import { assertNever, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'

export function defaultApplyChanges<TRundownPayload, TSegmentPayload, TPartPayload>(
	mutableIngestRundown: MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>,
	nrcsRundown: IngestRundown,
	changes: IncomingIngestChange,
	options: IngestDefaultChangesOptions<TRundownPayload, TSegmentPayload, TPartPayload>
): void {
	if (changes.source !== 'ingest') throw new Error(`Changes passed to defaultApplyChanges must be from ingest source`)

	let regenerateAllContents = false

	switch (changes.rundownChanges) {
		case IncomingIngestRundownChange.Regenerate: {
			// Future: should this be able to merge?
			mutableIngestRundown.replacePayload(options.transformRundownPayload(nrcsRundown.payload))

			mutableIngestRundown.setName(nrcsRundown.name)
			mutableIngestRundown.removeAllSegments()
			regenerateAllContents = true

			break
		}
		case IncomingIngestRundownChange.Payload: {
			// Future: should this be able to merge?
			mutableIngestRundown.replacePayload(options.transformRundownPayload(nrcsRundown.payload))

			mutableIngestRundown.setName(nrcsRundown.name)
			break
		}
		case undefined:
		case null:
			// No changes
			break
		default:
			assertNever(changes.rundownChanges)
	}

	// TODO - other portions

	if (regenerateAllContents) {
		// Regenerate all the segments
		for (const nrcsSegment of nrcsRundown.segments) {
			mutableIngestRundown.replaceSegment(transformSegmentAndPartPayloads(nrcsSegment, options), null)
		}
	} else {
		const nrcsSegmentMap = normalizeArrayToMap(nrcsRundown.segments, 'externalId')
		const nrcsSegmentIds = nrcsRundown.segments.map((s) => s.externalId)

		// Propogate segment changes
		for (const [segmentId, change] of Object.entries<IncomingIngestSegmentChange | undefined>(
			changes.segmentChanges || {}
		)) {
			if (!change) continue

			const nrcsSegment = nrcsSegmentMap.get(segmentId)
			const mutableSegment = mutableIngestRundown.getSegment(segmentId)

			switch (change) {
				case IncomingIngestSegmentChange.Inserted: {
					if (!nrcsSegment) throw new Error(`Segment ${segmentId} not found in nrcs rundown`)

					const segmentIndex = nrcsSegmentIds.indexOf(segmentId)
					const beforeSegmentId = segmentIndex !== -1 ? nrcsSegmentIds[segmentIndex + 1] ?? null : null

					mutableIngestRundown.replaceSegment(
						transformSegmentAndPartPayloads(nrcsSegment, options),
						beforeSegmentId
					)
					break
				}
				case IncomingIngestSegmentChange.Deleted: {
					mutableIngestRundown.removeSegment(segmentId)

					break
				}
				case IncomingIngestSegmentChange.ContentsOrder: {
					if (!mutableSegment) throw new Error(`Segment ${segmentId} not found in rundown`)
					if (!nrcsSegment) throw new Error(`Segment ${segmentId} not found in nrcs rundown`)

					// TODO - what to do here?

					break
				}
				case IncomingIngestSegmentChange.Payload: {
					if (!mutableSegment) throw new Error(`Segment ${segmentId} not found in rundown`)
					if (!nrcsSegment) throw new Error(`Segment ${segmentId} not found in nrcs rundown`)

					mutableSegment.replacePayload(options.transformSegmentPayload(nrcsSegment.payload))
					mutableSegment.setName(nrcsSegment.name)
					break
				}
				default:
					assertNever(change)
			}
		}

		// TODO - propogate part changes?

		if (changes.segmentOrderChanged) {
			// const orderedSegmentIds = changes.segmentOrderChanged.orderedSegmentIds
			// TODO
		}
	}
}

function transformSegmentAndPartPayloads(segment: IngestSegment, options: IngestDefaultChangesOptions): IngestSegment {
	return {
		...segment,
		payload: options.transformSegmentPayload(segment.payload),
		parts: segment.parts.map((part) => ({
			...part,
			payload: options.transformPartPayload(part.payload),
		})),
	}
}
