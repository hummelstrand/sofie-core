import {
	IngestPart,
	IngestRundown,
	IngestSegment,
	NrcsIngestChangeDetails,
	NrcsIngestPartChangeDetails,
	NrcsIngestSegmentChangeDetails,
	NrcsIngestSegmentChangeDetailsEnum,
} from '@sofie-automation/blueprints-integration'
import { Complete, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import _ = require('underscore')

export function wipGroupRundownForMos(
	nrcsIngestRundown: IngestRundown,
	sourceChanges: NrcsIngestChangeDetails,
	oldNrcsIngestRundown: IngestRundown | undefined
): {
	nrcsIngestRundown: IngestRundown
	changes: NrcsIngestChangeDetails
} {
	// Only valid for mos for now..
	if (nrcsIngestRundown.type !== 'mos') {
		return {
			nrcsIngestRundown,
			changes: sourceChanges,
		}
	}

	const oldCombinedIngestRundown = oldNrcsIngestRundown ? groupIngestRundown(oldNrcsIngestRundown) : undefined
	const oldIngestSegments = normalizeArrayToMap(oldCombinedIngestRundown?.segments || [], 'externalId')
	// const oldSegmentIds = new Set<string>(oldCombinedIngestRundown?.segments?.map((s) => s.externalId))

	const partChanges = new Map<string, NrcsIngestPartChangeDetails>()
	if (sourceChanges.segmentChanges) {
		for (const segment of nrcsIngestRundown.segments) {
			const segmentChanges = sourceChanges.segmentChanges[segment.externalId]
			if (!segmentChanges) continue

			for (const part of segment.parts) {
				switch (segmentChanges) {
					case NrcsIngestSegmentChangeDetailsEnum.Inserted:
						partChanges.set(part.externalId, NrcsIngestPartChangeDetails.Inserted)
						break
					case NrcsIngestSegmentChangeDetailsEnum.Deleted:
						partChanges.set(part.externalId, NrcsIngestPartChangeDetails.Deleted)
						break
					default:
						if (typeof segmentChanges !== 'object')
							throw new Error(`Unexpected segment change for "${segment.externalId}": ${segmentChanges}`)

						// Note: this is not a perfect representation of the possible changes,
						// but it should handle everything that our mos implementation does
						partChanges.set(part.externalId, NrcsIngestPartChangeDetails.Updated)

						break
				}
			}
		}
	}

	const combinedIngestRundown = groupIngestRundown(nrcsIngestRundown)

	const segmentChanges: Record<string, NrcsIngestSegmentChangeDetails> = {}

	// Track any segment changes
	for (const segment of combinedIngestRundown.segments) {
		const oldIngestSegment = oldIngestSegments.get(segment.externalId)
		if (!oldIngestSegment) {
			segmentChanges[segment.externalId] = NrcsIngestSegmentChangeDetailsEnum.Inserted
		} else {
			const segmentPartChanges: Record<string, NrcsIngestPartChangeDetails> = {}

			const newPartIds = new Set(segment.parts.map((p) => p.externalId))
			const oldPartMap = normalizeArrayToMap(oldIngestSegment.parts, 'externalId')

			for (const part of segment.parts) {
				const oldPart = oldPartMap.get(part.externalId)
				if (!oldPart) {
					segmentPartChanges[part.externalId] = NrcsIngestPartChangeDetails.Inserted
				} else {
					const partChange = partChanges.get(part.externalId)
					if (partChange !== undefined) {
						segmentPartChanges[part.externalId] = partChange
					}
					// console.log('part', part.externalId, partChange)
				}
			}
			for (const oldPart of oldIngestSegment.parts) {
				if (!newPartIds.has(oldPart.externalId)) {
					segmentPartChanges[oldPart.externalId] = NrcsIngestPartChangeDetails.Deleted
				}
			}
			// TODO

			// console.log(
			// 	'check order',
			// 	segment.parts.map((p) => ({ id: p.externalId, rank: p.rank })),
			// 	oldIngestSegment.parts.map((p) => ({ id: p.externalId, rank: p.rank })),
			// 	comparePartOrder(segment.parts, oldIngestSegment.parts)
			// )

			const partOrderChanged = comparePartOrder(segment.parts, oldIngestSegment.parts)
			if (partOrderChanged || Object.keys(segmentPartChanges).length > 0) {
				segmentChanges[segment.externalId] = {
					partChanges: segmentPartChanges,
					partOrderChanged,
				}
			}
		}
	}

	// Track any segment deletions
	if (oldCombinedIngestRundown) {
		const newSegmentIds = new Set(combinedIngestRundown.segments.map((s) => s.externalId))
		for (const oldSegment of oldCombinedIngestRundown.segments) {
			if (!newSegmentIds.has(oldSegment.externalId)) {
				segmentChanges[oldSegment.externalId] = NrcsIngestSegmentChangeDetailsEnum.Deleted
			}
		}
	}

	// TODO - populate segmentChanges

	/**
	 * What about creating a lookup where 'changes' for each part is stored
	 * then we can iterate through everything and see if any part in the segment has changes
	 * not sure how 'renames' will fit into this though
	 */

	// console.log('res rundown', JSON.stringify(combinedIngestRundown, undefined, 4))
	// console.log(
	// 	'check changes',
	// 	JSON.stringify(segmentChanges, undefined, 4),
	// 	'from,',
	// 	JSON.stringify(sourceChanges.segmentChanges, undefined, 4)
	// )

	return {
		nrcsIngestRundown: combinedIngestRundown,
		changes: {
			source: 'ingest',
			rundownChanges: sourceChanges.rundownChanges,
			segmentOrderChanged: true, // Maybe this could be optimised, but that will be quite a bit of effort
			segmentChanges,
		} satisfies Complete<NrcsIngestChangeDetails>,
	}
}

function comparePartOrder(ingestParts: IngestPart[], oldIngestParts: IngestPart[]): boolean {
	if (ingestParts.length !== oldIngestParts.length) return true

	for (let i = 0; i < ingestParts.length; i++) {
		if (ingestParts[i].externalId !== oldIngestParts[i].externalId) return true
	}

	return false
}

function groupIngestRundown(ingestRundown: IngestRundown): IngestRundown {
	const annotatedIngestParts = getAnnotatedIngestParts(ingestRundown)
	const segments = groupPartsIntoIngestSegments(ingestRundown.externalId, annotatedIngestParts)

	return {
		...ingestRundown,
		segments,
	}
}

interface AnnotatedIngestPart {
	externalId: string
	segmentName: string
	ingest: IngestPart
}

function getSegmentExternalId(rundownExternalId: string, ingestPart: IngestPart): string {
	return `${rundownExternalId}_${ingestPart.name.split(';')[0]}_${ingestPart.externalId}`
}

/** Group IngestParts together into something that could be Segments */
function groupIngestParts(parts: AnnotatedIngestPart[]): { name: string; parts: IngestPart[] }[] {
	const groupedParts: { name: string; parts: IngestPart[] }[] = []
	for (const part of parts) {
		const lastSegment = _.last(groupedParts)
		if (lastSegment && lastSegment.name === part.segmentName) {
			lastSegment.parts.push(part.ingest)
		} else {
			groupedParts.push({ name: part.segmentName, parts: [part.ingest] })
		}
	}

	// Ensure ranks are correct
	for (const group of groupedParts) {
		for (let i = 0; i < group.parts.length; i++) {
			group.parts[i].rank = i
		}
	}

	return groupedParts
}
function groupedPartsToSegments(
	rundownExternalId: string,
	groupedParts: { name: string; parts: IngestPart[] }[]
): IngestSegment[] {
	return groupedParts.map(
		(grp, i) =>
			({
				externalId: getSegmentExternalId(rundownExternalId, grp.parts[0]),
				name: grp.name,
				rank: i,
				parts: grp.parts,
			} satisfies IngestSegment)
	)
}

function groupPartsIntoIngestSegments(
	rundownExternalId: string,
	newIngestParts: AnnotatedIngestPart[]
): IngestSegment[] {
	// Group the parts and make them into Segments:
	const newGroupedParts = groupIngestParts(newIngestParts)
	return groupedPartsToSegments(rundownExternalId, newGroupedParts)
}

function getAnnotatedIngestParts(ingestRundown: IngestRundown): AnnotatedIngestPart[] {
	const ingestParts: AnnotatedIngestPart[] = []
	for (const ingestSegment of ingestRundown.segments) {
		// nocommit: group these better
		const segmentName = ingestSegment.name.split(';')[0] || ingestSegment.name

		for (const ingestPart of ingestSegment.parts) {
			ingestParts.push({
				externalId: ingestPart.externalId,
				segmentName: segmentName,
				ingest: ingestPart,
			})
		}
	}

	return ingestParts
}
