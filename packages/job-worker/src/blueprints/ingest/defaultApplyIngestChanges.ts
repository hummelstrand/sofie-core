import {
	IngestRundown,
	IncomingIngestChange,
	IngestDefaultChangesOptions,
	IncomingIngestRundownChange,
	MutableIngestRundown,
	IncomingIngestSegmentChange,
	IngestSegment,
	IncomingIngestSegmentChangeEnum,
	MutableIngestSegment,
	IncomingIngestSegmentChangeObject,
	IncomingIngestPartChange,
	IngestPart,
} from '@sofie-automation/blueprints-integration'
import { assertNever, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'

export function defaultApplyIngestChanges<TRundownPayload, TSegmentPayload, TPartPayload>(
	mutableIngestRundown: MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>,
	nrcsRundown: IngestRundown,
	changes: IncomingIngestChange,
	options: IngestDefaultChangesOptions<TRundownPayload, TSegmentPayload, TPartPayload>
): void {
	if (changes.source !== 'ingest')
		throw new Error(`Changes passed to defaultApplyIngestChanges must be from ingest source`)

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

	if (regenerateAllContents) {
		// Regenerate all the segments
		for (const nrcsSegment of nrcsRundown.segments) {
			mutableIngestRundown.replaceSegment(transformSegmentAndPartPayloads(nrcsSegment, options), null)
		}
	} else {
		// Propogate segment changes
		applySegmentChanges(mutableIngestRundown, nrcsRundown, changes, options)

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
		parts: segment.parts.map((part) => transformPartPayload(part, options)),
	}
}
function transformPartPayload(part: IngestPart, options: IngestDefaultChangesOptions): IngestPart {
	return {
		...part,
		payload: options.transformPartPayload(part.payload),
	}
}

function applySegmentChanges<TRundownPayload, TSegmentPayload, TPartPayload>(
	mutableIngestRundown: MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>,
	nrcsRundown: IngestRundown,
	changes: IncomingIngestChange,
	options: IngestDefaultChangesOptions<TRundownPayload, TSegmentPayload, TPartPayload>
) {
	if (!changes.segmentChanges) return

	const nrcsSegmentMap = normalizeArrayToMap(nrcsRundown.segments, 'externalId')
	const nrcsSegmentIds = nrcsRundown.segments.map((s) => s.externalId)

	for (const [segmentId, change] of Object.entries<IncomingIngestSegmentChange | undefined>(changes.segmentChanges)) {
		if (!change) continue

		const nrcsSegment = nrcsSegmentMap.get(segmentId)
		const mutableSegment = mutableIngestRundown.getSegment(segmentId)

		switch (change) {
			case IncomingIngestSegmentChangeEnum.Inserted: {
				if (!nrcsSegment) throw new Error(`Segment ${segmentId} not found in nrcs rundown`)

				const segmentIndex = nrcsSegmentIds.indexOf(segmentId)
				const beforeSegmentId = segmentIndex !== -1 ? nrcsSegmentIds[segmentIndex + 1] ?? null : null

				mutableIngestRundown.replaceSegment(
					transformSegmentAndPartPayloads(nrcsSegment, options),
					beforeSegmentId
				)
				break
			}
			case IncomingIngestSegmentChangeEnum.Deleted: {
				mutableIngestRundown.removeSegment(segmentId)

				break
			}
			default: {
				if (!mutableSegment) throw new Error(`Segment ${segmentId} not found in rundown`)
				if (!nrcsSegment) throw new Error(`Segment ${segmentId} not found in nrcs rundown`)

				applyChangesToSegment(mutableSegment, nrcsSegment, change, options)

				break
			}
		}
	}
}

function applyChangesToSegment<TRundownPayload, TSegmentPayload, TPartPayload>(
	mutableSegment: MutableIngestSegment<TSegmentPayload, TPartPayload>,
	nrcsSegment: IngestSegment,
	segmentChange: IncomingIngestSegmentChangeObject,
	options: IngestDefaultChangesOptions<TRundownPayload, TSegmentPayload, TPartPayload>
) {
	if (segmentChange.payloadChanged) {
		mutableSegment.replacePayload(options.transformSegmentPayload(nrcsSegment.payload))
		mutableSegment.setName(nrcsSegment.name)
	}

	if (segmentChange.partsChanges) {
		const nrcsPartMap = normalizeArrayToMap(nrcsSegment.parts, 'externalId')
		const nrcsPartIds = nrcsSegment.parts.map((s) => s.externalId)

		for (const [partId, change] of Object.entries<IncomingIngestPartChange | undefined>(
			segmentChange.partsChanges
		)) {
			if (!change) continue

			const nrcsPart = nrcsPartMap.get(partId)
			const mutablePart = mutableSegment.getPart(partId)

			switch (change) {
				case IncomingIngestPartChange.Inserted: {
					if (!nrcsPart) throw new Error(`Segment ${partId} not found in nrcs rundown`)

					const partIndex = nrcsPartIds.indexOf(partId)
					const beforePartId = partIndex !== -1 ? nrcsPartIds[partIndex + 1] ?? null : null

					mutableSegment.replacePart(transformPartPayload(nrcsPart, options), beforePartId)
					break
				}
				case IncomingIngestPartChange.Deleted: {
					mutableSegment.removePart(partId)

					break
				}
				case IncomingIngestPartChange.Payload: {
					if (!mutablePart) throw new Error(`Part ${partId} not found in segment`)
					if (!nrcsPart) throw new Error(`Part ${partId} not found in nrcs segment`)

					mutablePart.replacePayload(options.transformPartPayload(nrcsPart.payload))
					mutablePart.setName(nrcsPart.name)

					break
				}
				default: {
					assertNever(change)
				}
			}
		}
	}

	if (segmentChange.partOrderChanged) {
		// TODO - what to do here?
	}
}
