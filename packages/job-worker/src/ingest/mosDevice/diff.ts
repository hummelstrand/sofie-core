import { ReadonlyDeep } from 'type-fest'
import { LocalIngestSegment } from '../ingestCache'
import _ = require('underscore')
import { clone, deleteAllUndefinedProperties, normalizeArrayFunc } from '@sofie-automation/corelib/dist/lib'
import {
	IncomingIngestChange,
	IncomingIngestPartChange,
	IncomingIngestSegmentChange,
	IncomingIngestSegmentChangeEnum,
	IngestSegment,
} from '@sofie-automation/blueprints-integration'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'

export function generateMosIngestDiffTemp(
	oldIngestSegments: LocalIngestSegment[] | undefined,
	newIngestSegments: LocalIngestSegment[]
): IncomingIngestChange {
	// Fetch all existing segments:
	const miniSegments: SegmentMini[] | null =
		oldIngestSegments?.map((segment) => ({
			externalId: segment.externalId,
			externalModified: segment.modified,
			_rank: segment.rank,
		})) ?? null

	const oldSegmentEntries = compileSegmentEntries(oldIngestSegments ?? [])
	const newSegmentEntries = compileSegmentEntries(newIngestSegments)
	const segmentDiff = diffSegmentEntries(oldSegmentEntries, newSegmentEntries, miniSegments)

	const onlyRankChangedSet = new Set(Object.keys(segmentDiff.onlyRankChanged))

	const segmentChanges: Record<string, IncomingIngestSegmentChange> = {}

	for (const id of Object.keys(segmentDiff.removed)) {
		segmentChanges[id] = IncomingIngestSegmentChangeEnum.Deleted
	}
	for (const id of Object.keys(segmentDiff.changed)) {
		if (!onlyRankChangedSet.has(id)) {
			// TODO - should this be more granular?
			segmentChanges[id] = IncomingIngestSegmentChangeEnum.Inserted
		}
	}
	for (const id of Object.keys(segmentDiff.added)) {
		segmentChanges[id] = IncomingIngestSegmentChangeEnum.Inserted
	}

	for (const [oldId, newId] of Object.entries<string>(segmentDiff.externalIdChanged)) {
		if (
			segmentChanges[newId] &&
			segmentChanges[newId] !== IncomingIngestSegmentChangeEnum.Inserted &&
			segmentChanges[newId] !== IncomingIngestSegmentChangeEnum.Deleted
		)
			continue // Not supported for now

		if (segmentChanges[oldId] === IncomingIngestSegmentChangeEnum.Deleted) delete segmentChanges[oldId]

		const partsChanges: Record<string, IncomingIngestPartChange> = {}
		const oldIngestSegment = oldIngestSegments?.find((s) => s.externalId === oldId)
		if (oldIngestSegment) {
			for (const oldPart of oldIngestSegment.parts) {
				partsChanges[oldPart.externalId] = IncomingIngestPartChange.Deleted
			}
		}
		const newIngestSegment = newIngestSegments.find((s) => s.externalId === newId)
		if (newIngestSegment) {
			for (const newPart of newIngestSegment.parts) {
				partsChanges[newPart.externalId] = IncomingIngestPartChange.Inserted
			}
		}

		segmentChanges[newId] = {
			oldExternalId: oldId,
			payloadChanged: true,
			partOrderChanged: true,
			partsChanges,
		}
	}

	return {
		source: 'ingest',
		segmentChanges,
		segmentOrderChanged: Object.keys(segmentDiff.onlyRankChanged).length > 0,
	}
}

/**
 * Object of IngestSegment against their external ids
 */
export type SegmentEntries = { [segmentExternalId: string]: LocalIngestSegment }
/**
 * Convert an array of IngestSegment into SegmentEntries
 */
export function compileSegmentEntries(ingestSegments: ReadonlyDeep<Array<LocalIngestSegment>>): SegmentEntries {
	const segmentEntries: SegmentEntries = {}

	for (const ingestSegment of ingestSegments) {
		if (segmentEntries[ingestSegment.externalId]) {
			throw new Error(`compileSegmentEntries: Non-unique segment external ID: "${ingestSegment.externalId}"`)
		}
		segmentEntries[ingestSegment.externalId] = clone<LocalIngestSegment>(ingestSegment)
	}

	return segmentEntries
}

/**
 * Result of diffing two SegmentEntries
 */
export interface DiffSegmentEntries {
	added: { [segmentExternalId: string]: LocalIngestSegment }
	changed: { [segmentExternalId: string]: LocalIngestSegment }
	removed: { [segmentExternalId: string]: LocalIngestSegment }
	unchanged: { [segmentExternalId: string]: LocalIngestSegment }

	// Note: The objects present below are also present in the collections above

	/** Reference to segments which only had their ranks updated */
	onlyRankChanged: { [segmentExternalId: string]: number } // contains the new rank

	/** Reference to segments which has been REMOVED, but it looks like there is an ADDED segment that is closely related to the removed one */
	externalIdChanged: { [removedSegmentExternalId: string]: string } // contains the added segment's externalId
}

export type SegmentMini = Pick<DBSegment, 'externalId' | 'externalModified' | '_rank'>

/**
 * Perform a diff of SegmentEntries, to calculate what has changed.
 * Considers that the ids of some IngestSegments could have changed
 * @param oldSegmentEntries The last known SegmentEntries
 * @param newSegmentEntries The new SegmentEntries
 * @param oldSegments The Segments in the DB. This allows for maintaining a stable modified timestamp, and ranks
 * @returns DiffSegmentEntries describing the found changes
 */
export function diffSegmentEntries(
	oldSegmentEntries: SegmentEntries,
	newSegmentEntries: SegmentEntries,
	oldSegments: SegmentMini[] | null
): DiffSegmentEntries {
	const diff: DiffSegmentEntries = {
		added: {},
		changed: {},
		removed: {},
		unchanged: {},

		onlyRankChanged: {},
		externalIdChanged: {},
	}
	const oldSegmentMap: { [externalId: string]: SegmentMini } | null =
		oldSegments === null ? null : normalizeArrayFunc(oldSegments, (segment) => segment.externalId)

	_.each(newSegmentEntries, (newSegmentEntry, segmentExternalId) => {
		const oldSegmentEntry = oldSegmentEntries[segmentExternalId] as IngestSegment | undefined
		let oldSegment: SegmentMini | undefined
		if (oldSegmentMap) {
			oldSegment = oldSegmentMap[newSegmentEntry.externalId]
			if (!oldSegment) {
				// Segment has been added
				diff.added[segmentExternalId] = newSegmentEntry
				return
			}
		}
		if (oldSegmentEntry) {
			const modifiedIsEqual = oldSegment ? newSegmentEntry.modified === oldSegment.externalModified : true

			// ensure there are no 'undefined' properties
			deleteAllUndefinedProperties(oldSegmentEntry)
			deleteAllUndefinedProperties(newSegmentEntry)

			// deep compare:
			const ingestContentIsEqual = _.isEqual(_.omit(newSegmentEntry, 'rank'), _.omit(oldSegmentEntry, 'rank'))
			const rankIsEqual = oldSegment
				? newSegmentEntry.rank === oldSegment._rank
				: newSegmentEntry.rank === oldSegmentEntry.rank

			// Compare the modified timestamps:
			if (modifiedIsEqual && ingestContentIsEqual && rankIsEqual) {
				diff.unchanged[segmentExternalId] = newSegmentEntry
			} else {
				// Something has changed
				diff.changed[segmentExternalId] = newSegmentEntry

				// Check if it's only the rank that has changed:
				if (ingestContentIsEqual && !rankIsEqual) {
					diff.onlyRankChanged[segmentExternalId] = newSegmentEntry.rank
				}
			}
		} else {
			// Segment has been added
			diff.added[segmentExternalId] = newSegmentEntry
		}
	})

	_.each(oldSegmentEntries, (oldSegmentEntry, segmentExternalId) => {
		const newSegmentEntry = newSegmentEntries[segmentExternalId] as IngestSegment | undefined
		if (!newSegmentEntry) {
			diff.removed[segmentExternalId] = oldSegmentEntry
		}
	})

	// Handle when the externalId has change
	_.each(diff.removed, (segmentEntry, segmentExternalId) => {
		// try finding "it" in the added, using name
		let newSegmentEntry = _.find(diff.added, (se) => se.name === segmentEntry.name)
		if (!newSegmentEntry) {
			// second try, match with any parts:
			newSegmentEntry = _.find(diff.added, (se) => {
				let found = false
				_.each(segmentEntry.parts, (part) => {
					if (found || _.find(se.parts, (p) => p.externalId === part.externalId)) {
						found = true
					}
				})
				return found
			})
		}
		if (newSegmentEntry) {
			diff.externalIdChanged[segmentExternalId] = newSegmentEntry.externalId
		}
	})

	return diff
}
