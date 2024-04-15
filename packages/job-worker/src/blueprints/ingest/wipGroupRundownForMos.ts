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
	ingestChanges: NrcsIngestChangeDetails
	changedSegmentExternalIds: Record<string, string>
} {
	// Only valid for mos rundowns
	if (nrcsIngestRundown.type !== 'mos') {
		return {
			nrcsIngestRundown,
			ingestChanges: sourceChanges,
			changedSegmentExternalIds: {},
		}
	}

	const oldCombinedIngestRundown = oldNrcsIngestRundown
		? groupPartsIntoNewIngestRundown(oldNrcsIngestRundown)
		: undefined

	const allPartChanges = findAllPartsWithChanges(nrcsIngestRundown, sourceChanges)

	const combinedIngestRundown = groupPartsIntoNewIngestRundown(nrcsIngestRundown)

	const segmentChanges = calculateSegmentChanges(oldCombinedIngestRundown, combinedIngestRundown, allPartChanges)

	const changedSegmentExternalIds = oldCombinedIngestRundown
		? calculateSegmentExternalIdChanges(oldCombinedIngestRundown, combinedIngestRundown)
		: {}
	const segmentOrderChanged = oldCombinedIngestRundown
		? compareSegmentOrder(combinedIngestRundown.segments, oldCombinedIngestRundown.segments)
		: true

	return {
		nrcsIngestRundown: combinedIngestRundown,
		ingestChanges: {
			source: 'ingest',
			rundownChanges: sourceChanges.rundownChanges,
			segmentOrderChanged,
			segmentChanges,
		} satisfies Complete<NrcsIngestChangeDetails>,
		changedSegmentExternalIds,
	}
}

function findAllPartsWithChanges(
	nrcsIngestRundown: IngestRundown,
	sourceChanges: NrcsIngestChangeDetails
): Map<string, NrcsIngestPartChangeDetails> {
	if (!sourceChanges.segmentChanges) return new Map()

	const partChanges = new Map<string, NrcsIngestPartChangeDetails>() // nocommit, should this be changed to a simple set?

	for (const segment of nrcsIngestRundown.segments) {
		const segmentChanges = sourceChanges.segmentChanges[segment.externalId]
		if (!segmentChanges) continue

		for (const part of segment.parts) {
			switch (segmentChanges) {
				case NrcsIngestSegmentChangeDetailsEnum.Inserted:
					// partChanges.set(part.externalId, NrcsIngestPartChangeDetails.Inserted)
					break
				case NrcsIngestSegmentChangeDetailsEnum.Deleted:
					// partChanges.set(part.externalId, NrcsIngestPartChangeDetails.Deleted)
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

	return partChanges
}

function calculateSegmentChanges(
	oldCombinedIngestRundown: IngestRundown | undefined,
	combinedIngestRundown: IngestRundown,
	allPartChanges: Map<string, NrcsIngestPartChangeDetails>
): Record<string, NrcsIngestSegmentChangeDetails> {
	const oldIngestSegments = normalizeArrayToMap(oldCombinedIngestRundown?.segments || [], 'externalId')

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
					const partChange = allPartChanges.get(part.externalId)
					if (partChange !== undefined) {
						segmentPartChanges[part.externalId] = partChange
					}
				}
			}
			for (const oldPart of oldIngestSegment.parts) {
				if (!newPartIds.has(oldPart.externalId)) {
					segmentPartChanges[oldPart.externalId] = NrcsIngestPartChangeDetails.Deleted
				}
			}

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

	return segmentChanges
}

function compareSegmentOrder(ingestSegments: IngestSegment[], oldIngestSegments: IngestSegment[]): boolean {
	if (ingestSegments.length !== oldIngestSegments.length) return true

	for (let i = 0; i < ingestSegments.length; i++) {
		if (ingestSegments[i].externalId !== oldIngestSegments[i].externalId) return true
	}

	return false
}

function comparePartOrder(ingestParts: IngestPart[], oldIngestParts: IngestPart[]): boolean {
	if (ingestParts.length !== oldIngestParts.length) return true

	for (let i = 0; i < ingestParts.length; i++) {
		if (ingestParts[i].externalId !== oldIngestParts[i].externalId) return true
	}

	return false
}

function groupPartsIntoNewIngestRundown(ingestRundown: IngestRundown): IngestRundown {
	const groupedParts: { name: string; parts: IngestPart[] }[] = []

	for (const ingestSegment of ingestRundown.segments) {
		// nocommit: group these better
		const segmentName = ingestSegment.name.split(';')[0] || ingestSegment.name

		for (const ingestPart of ingestSegment.parts) {
			const lastSegment = _.last(groupedParts)
			if (lastSegment && lastSegment.name === segmentName) {
				lastSegment.parts.push(ingestPart)
			} else {
				groupedParts.push({ name: segmentName, parts: [ingestPart] })
			}
		}
	}

	// Ensure ranks are correct
	for (const group of groupedParts) {
		for (let i = 0; i < group.parts.length; i++) {
			group.parts[i].rank = i
		}
	}

	const segments = groupedParts.map(
		(grp, i) =>
			({
				externalId: getSegmentExternalId(ingestRundown.externalId, grp.parts[0]),
				name: grp.name,
				rank: i,
				parts: grp.parts,
			} satisfies IngestSegment)
	)

	return {
		...ingestRundown,
		segments,
	}
}

function getSegmentExternalId(rundownExternalId: string, ingestPart: IngestPart): string {
	return `${rundownExternalId}_${ingestPart.name.split(';')[0]}_${ingestPart.externalId}`
}

function calculateSegmentExternalIdChanges(
	oldIngestRundown: IngestRundown,
	newIngestRundown: IngestRundown
): Record<string, string> {
	const segmentExternalIdChanges: Record<string, string> = {}

	const oldIngestSegmentMap = normalizeArrayToMap(oldIngestRundown.segments, 'externalId')
	const newIngestSegmentMap = normalizeArrayToMap(newIngestRundown.segments, 'externalId')

	const removedSegments = oldIngestRundown.segments.filter((s) => !newIngestSegmentMap.has(s.externalId))
	let addedSegments = newIngestRundown.segments.filter((s) => !oldIngestSegmentMap.has(s.externalId))

	if (removedSegments.length === 0 || addedSegments.length === 0) return {}

	for (const removedSegment of removedSegments) {
		let newSegmentExternalId: string | undefined

		// try finding "it" in the added, using name
		// Future: this may not be particularly accurate, as multiple could have been formed
		newSegmentExternalId = addedSegments.find((se) => se.name === removedSegment.name)?.externalId

		if (!newSegmentExternalId) {
			// second try, match with any parts:
			newSegmentExternalId = addedSegments.find((se) => {
				for (const part of removedSegment.parts) {
					if (se.parts.find((p) => p.externalId === part.externalId)) {
						return true
					}
				}

				return false
			})?.externalId
		}
		if (newSegmentExternalId) {
			segmentExternalIdChanges[removedSegment.externalId] = newSegmentExternalId

			// Ensure the same id doesn't get used multiple times
			addedSegments = addedSegments.filter((s) => s.externalId !== newSegmentExternalId)
		}
	}

	return segmentExternalIdChanges
}
