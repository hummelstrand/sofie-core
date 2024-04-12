import {
	IngestRundown,
	NrcsIngestChangeDetails,
	IngestDefaultChangesOptions,
	NrcsIngestRundownChangeDetails,
	MutableIngestRundown,
	NrcsIngestSegmentChangeDetails,
	IngestSegment,
	NrcsIngestSegmentChangeDetailsEnum,
	MutableIngestSegment,
	NrcsIngestSegmentChangeDetailsObject,
	NrcsIngestPartChangeDetails,
	IngestPart,
	MutableIngestPart,
} from '@sofie-automation/blueprints-integration'
import { assertNever, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { ReadonlyDeep } from 'type-fest'

export function defaultApplyIngestChanges<TRundownPayload, TSegmentPayload, TPartPayload>(
	mutableIngestRundown: MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>,
	nrcsRundown: IngestRundown,
	changes: NrcsIngestChangeDetails,
	options: IngestDefaultChangesOptions<TRundownPayload, TSegmentPayload, TPartPayload>
): void {
	if (changes.source !== 'ingest')
		throw new Error(`Changes passed to defaultApplyIngestChanges must be from ingest source`)

	const payloadTransformers = new PayloadTransformers(options, mutableIngestRundown)

	let regenerateAllContents = false

	switch (changes.rundownChanges) {
		case NrcsIngestRundownChangeDetails.Regenerate: {
			mutableIngestRundown.replacePayload(
				payloadTransformers.transformRundownPayload(nrcsRundown, mutableIngestRundown)
			)

			mutableIngestRundown.setName(nrcsRundown.name)
			mutableIngestRundown.removeAllSegments()
			mutableIngestRundown.forceFullRegenerate()
			regenerateAllContents = true

			// TODO - segment renames need to be preserved through this route

			break
		}
		case NrcsIngestRundownChangeDetails.Payload: {
			mutableIngestRundown.replacePayload(
				payloadTransformers.transformRundownPayload(nrcsRundown, mutableIngestRundown)
			)

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
			mutableIngestRundown.replaceSegment(
				payloadTransformers.transformPayloadsOnSegmentAndParts(
					nrcsSegment,
					mutableIngestRundown.getSegment(nrcsSegment.externalId)
				),
				null
			)

			// TODO - segment renames should be preserved?
		}
	} else {
		// Propogate segment changes
		if (changes.segmentChanges) {
			applyAllSegmentChanges(mutableIngestRundown, nrcsRundown, changes.segmentChanges, payloadTransformers)
		}

		if (changes.segmentOrderChanged) {
			applySegmentOrder(mutableIngestRundown, nrcsRundown)
		}
	}
}

function applySegmentOrder<TRundownPayload, TSegmentPayload, TPartPayload>(
	mutableIngestRundown: MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>,
	nrcsRundown: IngestRundown
) {
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

		// If the Segment doesn't exist, ignore it
		if (!mutableIngestRundown.getSegment(nrcsSegment.externalId)) continue

		// Find the first valid segment after this one
		let beforeNrcsSegmentId: string | null = null
		for (let o = i + 1; o < nrcsRundown.segments.length; o++) {
			const otherSegment = nrcsRundown.segments[o]
			if (mutableIngestRundown.getSegment(otherSegment.externalId)) {
				beforeNrcsSegmentId = otherSegment.externalId
				break
			}
		}

		mutableIngestRundown.moveSegmentBefore(nrcsSegment.externalId, beforeNrcsSegmentId)
	}

	// Run through the segments without a defined rank, and ensure they are positioned after the same segment as before
	for (const segmentInfo of missingNewRank) {
		mutableIngestRundown.moveSegmentAfter(segmentInfo.segmentId, segmentInfo.afterId)
	}
}

function applyAllSegmentChanges<TRundownPayload, TSegmentPayload, TPartPayload>(
	mutableIngestRundown: MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>,
	nrcsRundown: IngestRundown,
	changes: Record<string, NrcsIngestSegmentChangeDetails>,
	payloadTransformers: PayloadTransformers<TRundownPayload, TSegmentPayload, TPartPayload>
) {
	const nrcsSegmentMap = normalizeArrayToMap(nrcsRundown.segments, 'externalId')
	const nrcsSegmentIds = nrcsRundown.segments.map((s) => s.externalId)

	// Perform the inserts last, so that we can ensure they happen in a sensible order
	const segmentsToInsert: IngestSegment[] = []

	// Perform any renames before any other changes
	applySegmentRenames(mutableIngestRundown, changes)

	// Apply changes and delete segments
	for (const [segmentId, change] of Object.entries<NrcsIngestSegmentChangeDetails | undefined>(changes)) {
		if (!change) continue

		const nrcsSegment = nrcsSegmentMap.get(segmentId)
		applyChangesForSingleSegment(
			mutableIngestRundown,
			nrcsSegment,
			segmentsToInsert,
			segmentId,
			change,
			payloadTransformers
		)
	}

	// Now we can insert the new ones in descending order
	segmentsToInsert.sort((a, b) => nrcsSegmentIds.indexOf(b.externalId) - nrcsSegmentIds.indexOf(a.externalId))
	for (const nrcsSegment of segmentsToInsert) {
		const segmentIndex = nrcsSegmentIds.indexOf(nrcsSegment.externalId)
		const beforeSegmentId = segmentIndex !== -1 ? nrcsSegmentIds[segmentIndex + 1] ?? null : null

		mutableIngestRundown.replaceSegment(
			payloadTransformers.transformPayloadsOnSegmentAndParts(
				nrcsSegment,
				mutableIngestRundown.getSegment(nrcsSegment.externalId)
			),
			beforeSegmentId
		)
	}
}

function applySegmentRenames<TRundownPayload, TSegmentPayload, TPartPayload>(
	mutableIngestRundown: MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>,
	changes: Record<string, NrcsIngestSegmentChangeDetails>
) {
	for (const [segmentId, change] of Object.entries<NrcsIngestSegmentChangeDetails | undefined>(changes)) {
		if (!change) continue

		if (change && typeof change === 'object' && change.oldExternalId) {
			const mutableSegment = mutableIngestRundown.getSegment(change.oldExternalId)
			if (!mutableSegment) throw new Error(`Segment ${change.oldExternalId} not found in rundown`)

			mutableIngestRundown.renameSegment(change.oldExternalId, segmentId)
		}
	}
}

function applyChangesForSingleSegment<TRundownPayload, TSegmentPayload, TPartPayload>(
	mutableIngestRundown: MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>,
	nrcsSegment: IngestSegment | undefined,
	segmentsToInsert: IngestSegment[],
	segmentId: string,
	change: NrcsIngestSegmentChangeDetails,
	payloadTransformers: PayloadTransformers<TRundownPayload, TSegmentPayload, TPartPayload>
) {
	const mutableSegment = mutableIngestRundown.getSegment(segmentId)

	switch (change) {
		case NrcsIngestSegmentChangeDetailsEnum.Inserted: {
			if (!nrcsSegment) throw new Error(`Segment ${segmentId} not found in nrcs rundown`)

			segmentsToInsert.push(nrcsSegment)

			break
		}
		case NrcsIngestSegmentChangeDetailsEnum.Deleted: {
			mutableIngestRundown.removeSegment(segmentId)

			break
		}
		default: {
			if (!mutableSegment) throw new Error(`Segment ${segmentId} not found in rundown`)
			if (!nrcsSegment) throw new Error(`Segment ${segmentId} not found in nrcs rundown`)

			applyChangesObjectForSingleSegment(mutableSegment, nrcsSegment, change, payloadTransformers)

			break
		}
	}
}

function applyChangesObjectForSingleSegment<TRundownPayload, TSegmentPayload, TPartPayload>(
	mutableSegment: MutableIngestSegment<TSegmentPayload, TPartPayload>,
	nrcsSegment: IngestSegment,
	segmentChange: NrcsIngestSegmentChangeDetailsObject,
	payloadTransformers: PayloadTransformers<TRundownPayload, TSegmentPayload, TPartPayload>
) {
	if (segmentChange.payloadChanged) {
		mutableSegment.replacePayload(payloadTransformers.transformSegmentPayload(nrcsSegment, mutableSegment))
		mutableSegment.setName(nrcsSegment.name)
	}

	if (segmentChange.partsChanges) {
		const nrcsPartMap = normalizeArrayToMap(nrcsSegment.parts, 'externalId')
		const nrcsPartIds = nrcsSegment.parts.map((s) => s.externalId)

		// Perform the inserts last, so that we can ensure they happen in a sensible order
		const partsToInsert: IngestPart[] = []

		for (const [partId, change] of Object.entries<NrcsIngestPartChangeDetails | undefined>(
			segmentChange.partsChanges
		)) {
			if (!change) continue

			const nrcsPart = nrcsPartMap.get(partId)
			applyChangesForPart(mutableSegment, nrcsPart, partsToInsert, partId, change, payloadTransformers)
		}

		// Now we can insert them in descending order
		partsToInsert.sort((a, b) => nrcsPartIds.indexOf(b.externalId) - nrcsPartIds.indexOf(a.externalId))
		for (const nrcsPart of partsToInsert) {
			const partIndex = nrcsPartIds.indexOf(nrcsPart.externalId)
			const beforePartId = partIndex !== -1 ? nrcsPartIds[partIndex + 1] ?? null : null

			mutableSegment.replacePart(
				payloadTransformers.transformPayloadOnPart(nrcsPart, mutableSegment.getPart(nrcsPart.externalId)),
				beforePartId
			)
		}
	}

	if (segmentChange.partOrderChanged) {
		applyPartOrder(mutableSegment, nrcsSegment)
	}
}

function applyChangesForPart<TRundownPayload, TSegmentPayload, TPartPayload>(
	mutableSegment: MutableIngestSegment<TSegmentPayload, TPartPayload>,
	nrcsPart: IngestPart | undefined,
	partsToInsert: IngestPart[],
	partId: string,
	change: NrcsIngestPartChangeDetails,
	payloadTransformers: PayloadTransformers<TRundownPayload, TSegmentPayload, TPartPayload>
) {
	const mutablePart = mutableSegment.getPart(partId)

	switch (change) {
		case NrcsIngestPartChangeDetails.Inserted: {
			if (!nrcsPart) throw new Error(`Part ${partId} not found in nrcs rundown`)

			// Batch the inserts to be performed last
			partsToInsert.push(nrcsPart)
			break
		}
		case NrcsIngestPartChangeDetails.Deleted: {
			mutableSegment.removePart(partId)

			break
		}
		case NrcsIngestPartChangeDetails.Updated: {
			if (!mutablePart) throw new Error(`Part ${partId} not found in segment`)
			if (!nrcsPart) throw new Error(`Part ${partId} not found in nrcs segment`)

			mutablePart.replacePayload(payloadTransformers.transformPartPayload(nrcsPart, mutablePart))
			mutablePart.setName(nrcsPart.name)

			break
		}
		default: {
			assertNever(change)
		}
	}
}

function applyPartOrder(mutableSegment: MutableIngestSegment, nrcsSegment: IngestSegment) {
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

		// If the Part doesn't exist, ignore it
		if (!mutableSegment.getPart(nrcsPart.externalId)) continue

		// Find the first valid segment after this one
		let beforeNrcsPartId: string | null = null
		for (let o = i + 1; o < nrcsSegment.parts.length; o++) {
			const otherPart = nrcsSegment.parts[o]
			if (mutableSegment.getPart(otherPart.externalId)) {
				beforeNrcsPartId = otherPart.externalId
				break
			}
		}

		mutableSegment.movePartBefore(nrcsPart.externalId, beforeNrcsPartId)
	}

	// Run through the segments without a defined rank, and ensure they are positioned after the same segment as before
	for (const segmentInfo of missingNewRank) {
		mutableSegment.movePartAfter(segmentInfo.partId, segmentInfo.afterId)
	}
}

class PayloadTransformers<TRundownPayload, TSegmentPayload, TPartPayload> {
	readonly #options: IngestDefaultChangesOptions<TRundownPayload, TSegmentPayload, TPartPayload>
	readonly #initialMutableParts = new Map<string, MutableIngestPart<TPartPayload>>()
	readonly #initialMutableSegments = new Map<string, MutableIngestSegment<TSegmentPayload, TPartPayload>>()

	constructor(
		options: IngestDefaultChangesOptions<TRundownPayload, TSegmentPayload, TPartPayload>,
		mutableIngestRundown: MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>
	) {
		this.#options = options

		// Collect all of the Part payloads before any operation was run
		for (const segment of mutableIngestRundown.segments) {
			this.#initialMutableSegments.set(segment.externalId, segment)

			for (const part of segment.parts) {
				this.#initialMutableParts.set(part.externalId, part)
			}
		}
	}

	transformRundownPayload(
		nrcsRundown: IngestRundown,
		mutableIngestRundown: MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>
	): ReadonlyDeep<TRundownPayload> | TRundownPayload {
		return this.#options.transformRundownPayload(nrcsRundown.payload, mutableIngestRundown.payload)
	}

	transformSegmentPayload(
		nrcsSegment: IngestSegment,
		mutableSegment: MutableIngestSegment<TSegmentPayload, TPartPayload>
	): ReadonlyDeep<TSegmentPayload> | TSegmentPayload {
		return this.#options.transformSegmentPayload(nrcsSegment.payload, mutableSegment?.payload)
	}

	transformPartPayload(
		nrcsPart: IngestPart,
		mutablePart: MutableIngestPart<TPartPayload>
	): ReadonlyDeep<TPartPayload> | TPartPayload {
		return this.#options.transformPartPayload(nrcsPart.payload, mutablePart?.payload)
	}

	transformPayloadsOnSegmentAndParts(
		segment: IngestSegment,
		mutableSegment: MutableIngestSegment<TSegmentPayload, TPartPayload> | undefined
	): IngestSegment {
		return {
			...segment,
			payload: this.#options.transformSegmentPayload(
				segment.payload,
				mutableSegment ? mutableSegment.payload : this.#initialMutableSegments.get(segment.externalId)?.payload
			),
			parts: segment.parts.map((part) =>
				this.transformPayloadOnPart(part, mutableSegment?.getPart(part.externalId))
			),
		}
	}
	transformPayloadOnPart(part: IngestPart, mutablePart: MutableIngestPart<TPartPayload> | undefined): IngestPart {
		return {
			...part,
			payload: this.#options.transformPartPayload(
				part.payload,
				mutablePart ? mutablePart.payload : this.#initialMutableParts.get(part.externalId)?.payload
			),
		}
	}
}
