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
			mutableIngestRundown.forceFullRegenerate()
			regenerateAllContents = true

			// TODO - segment renames need to be preserved through this route

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

			// TODO - segment renames should be preserved?
		}
	} else {
		// Propogate segment changes
		applySegmentChanges(mutableIngestRundown, nrcsRundown, changes, options)

		if (changes.segmentOrderChanged) {
			// Figure out which segments don't have a new rank, and will need interpolating
			const missingNewRank: Array<{ segmentId: string; afterId: string | null }> = []
			const segmentIdRanksInRundown = normalizeArrayToMap(nrcsRundown.segments, 'externalId')
			mutableIngestRundown.segments.forEach((segment, i) => {
				if (!segmentIdRanksInRundown.has(segment.externalId)) {
					missingNewRank.push({
						segmentId: segment.externalId,
						afterId: i > 0 ? mutableIngestRundown.segments[i - 1].externalId : null,
					})
				}
			})

			// Run through the segments in reverse order, so that we can insert them in the correct order
			for (let i = nrcsRundown.segments.length - 1; i >= 0; i--) {
				const nrcsSegment = nrcsRundown.segments[i]
				const beforeNrcsSegment: IngestSegment | undefined = nrcsRundown.segments[i + 1]

				mutableIngestRundown.moveSegmentBefore(nrcsSegment.externalId, beforeNrcsSegment?.externalId ?? null)
			}

			// Run through the segments without a defined rank, and ensure they are positioned after the same segment as before
			for (const segmentInfo of missingNewRank) {
				mutableIngestRundown.moveSegmentAfter(segmentInfo.segmentId, segmentInfo.afterId)
			}
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

	// Perform the inserts last, so that we can ensure they happen in a sensible order
	const segmentsToInsert: IngestSegment[] = []

	// Perform any renames before any other changes
	for (const [segmentId, change] of Object.entries<IncomingIngestSegmentChange | undefined>(changes.segmentChanges)) {
		if (!change) continue

		if (change && typeof change === 'object' && change.oldExternalId) {
			const mutableSegment = mutableIngestRundown.getSegment(change.oldExternalId)
			if (!mutableSegment) throw new Error(`Segment ${change.oldExternalId} not found in rundown`)

			mutableIngestRundown.renameSegment(change.oldExternalId, segmentId)
		}
	}

	// Apply changes and delete segments
	for (const [segmentId, change] of Object.entries<IncomingIngestSegmentChange | undefined>(changes.segmentChanges)) {
		if (!change) continue

		const nrcsSegment = nrcsSegmentMap.get(segmentId)
		const mutableSegment = mutableIngestRundown.getSegment(segmentId)

		switch (change) {
			case IncomingIngestSegmentChangeEnum.Inserted: {
				if (!nrcsSegment) throw new Error(`Segment ${segmentId} not found in nrcs rundown`)

				segmentsToInsert.push(nrcsSegment)

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

	// Now we can insert the new ones in descending order
	segmentsToInsert.sort((a, b) => nrcsSegmentIds.indexOf(b.externalId) - nrcsSegmentIds.indexOf(a.externalId))
	for (const nrcsSegment of segmentsToInsert) {
		const segmentIndex = nrcsSegmentIds.indexOf(nrcsSegment.externalId)
		const beforeSegmentId = segmentIndex !== -1 ? nrcsSegmentIds[segmentIndex + 1] ?? null : null

		mutableIngestRundown.replaceSegment(transformSegmentAndPartPayloads(nrcsSegment, options), beforeSegmentId)
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

		// Perform the inserts last, so that we can ensure they happen in a sensible order
		const partsToInsert: IngestPart[] = []

		for (const [partId, change] of Object.entries<IncomingIngestPartChange | undefined>(
			segmentChange.partsChanges
		)) {
			if (!change) continue

			const nrcsPart = nrcsPartMap.get(partId)
			const mutablePart = mutableSegment.getPart(partId)

			switch (change) {
				case IncomingIngestPartChange.Inserted: {
					if (!nrcsPart) throw new Error(`Segment ${partId} not found in nrcs rundown`)

					partsToInsert.push(nrcsPart)
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

		// Now we can insert them in descending order
		partsToInsert.sort((a, b) => nrcsPartIds.indexOf(b.externalId) - nrcsPartIds.indexOf(a.externalId))
		for (const nrcsPart of partsToInsert) {
			const partIndex = nrcsPartIds.indexOf(nrcsPart.externalId)
			const beforePartId = partIndex !== -1 ? nrcsPartIds[partIndex + 1] ?? null : null

			mutableSegment.replacePart(transformPartPayload(nrcsPart, options), beforePartId)
		}
	}

	if (segmentChange.partOrderChanged) {
		// Figure out which segments don't have a new rank, and will need interpolating
		const missingNewRank: Array<{ partId: string; afterId: string | null }> = []
		const partIdRanksInSegment = normalizeArrayToMap(nrcsSegment.parts, 'externalId')
		mutableSegment.parts.forEach((part, i) => {
			if (!partIdRanksInSegment.has(part.externalId)) {
				missingNewRank.push({
					partId: part.externalId,
					afterId: i > 0 ? mutableSegment.parts[i - 1].externalId : null,
				})
			}
		})

		// Run through the segments in reverse order, so that we can insert them in the correct order
		for (let i = nrcsSegment.parts.length - 1; i >= 0; i--) {
			const nrcsPart = nrcsSegment.parts[i]
			const beforeNrcsPart: IngestPart | undefined = nrcsSegment.parts[i + 1]

			mutableSegment.movePartBefore(nrcsPart.externalId, beforeNrcsPart?.externalId ?? null)
		}

		// Run through the segments without a defined rank, and ensure they are positioned after the same segment as before
		for (const segmentInfo of missingNewRank) {
			mutableSegment.movePartAfter(segmentInfo.partId, segmentInfo.afterId)
		}
	}
}
