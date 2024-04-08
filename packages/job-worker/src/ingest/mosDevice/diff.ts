import { JobContext } from '../../jobs'
import { ReadonlyDeep } from 'type-fest'
import { IngestModel } from '../model/IngestModel'
import { LocalIngestRundown, LocalIngestSegment } from '../ingestCache'
import { getSegmentId } from '../lib'
import _ = require('underscore')
import { clone, deleteAllUndefinedProperties, normalizeArrayFunc } from '@sofie-automation/corelib/dist/lib'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	IncomingIngestChange,
	IncomingIngestSegmentChange,
	IncomingIngestSegmentChangeEnum,
	IngestSegment,
} from '@sofie-automation/blueprints-integration'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { CommitIngestData } from '../lock'

/**
 * Update the Ids of Segments based on new Ingest data
 * This assumes that no segments/parts were added or removed between the two LocalIngestRundowns provided
 * @param context Context of the job being run
 * @param ingestModel Ingest model for Rundown being updated
 * @param oldIngestRundown Last known ingest data
 * @param newIngestRundown New ingest data
 * @returns Map of the SegmentId changes
 */
export function diffAndUpdateSegmentIds(
	context: JobContext,
	ingestModel: IngestModel,
	oldIngestRundown: ReadonlyDeep<LocalIngestRundown>,
	newIngestRundown: ReadonlyDeep<LocalIngestRundown>
): CommitIngestData['renamedSegments'] {
	const span = context.startSpan('mosDevice.ingest.diffAndApplyChanges')

	const oldSegments = ingestModel.getOrderedSegments().map((segment) => ({
		externalId: segment.segment.externalId,
		externalModified: segment.segment.externalModified,
		_rank: segment.segment._rank,
	}))

	const oldSegmentEntries = compileSegmentEntries(oldIngestRundown.segments)
	const newSegmentEntries = compileSegmentEntries(newIngestRundown.segments)
	const segmentDiff = diffSegmentEntries(oldSegmentEntries, newSegmentEntries, oldSegments)

	// Updated segments that has had their segment.externalId changed:
	const renamedSegments = applyExternalIdDiff(ingestModel, segmentDiff, false)

	span?.end()
	return renamedSegments
}

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

	// /** Reference to segments which only had their ranks updated */
	// onlyRankChanged: { [segmentExternalId: string]: number } // contains the new rank

	// /** Reference to segments which has been REMOVED, but it looks like there is an ADDED segment that is closely related to the removed one */
	// externalIdChanged: { [removedSegmentExternalId: string]: string } // contains the added segment's externalId

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

	// nocommit implement something for externalIdChanged

	return {
		source: 'ingest',
		segmentChanges,
		segmentOrderChanged: Object.keys(segmentDiff.onlyRankChanged).length > 0,
	}
}

/**
 * Apply the externalId renames from a DiffSegmentEntries
 * @param ingestModel Ingest model of the rundown being updated
 * @param segmentDiff Calculated Diff
 * @returns Map of the SegmentId changes
 */
// nocommit: This needs to be rewritten and reused elsewhere
export function applyExternalIdDiff(
	ingestModel: IngestModel,
	segmentDiff: Pick<DiffSegmentEntries, 'externalIdChanged' | 'onlyRankChanged'>,
	canDiscardParts: boolean
): CommitIngestData['renamedSegments'] {
	// Updated segments that has had their segment.externalId changed:
	const renamedSegments = new Map<SegmentId, SegmentId>()
	for (const [oldSegmentExternalId, newSegmentExternalId] of Object.entries<string>(segmentDiff.externalIdChanged)) {
		const oldSegmentId = getSegmentId(ingestModel.rundownId, oldSegmentExternalId)
		const newSegmentId = getSegmentId(ingestModel.rundownId, newSegmentExternalId)

		// Track the rename
		renamedSegments.set(oldSegmentId, newSegmentId)

		// If the segment doesnt exist (it should), then there isn't a segment to rename
		const oldSegment = ingestModel.getSegment(oldSegmentId)
		if (!oldSegment) continue

		if (ingestModel.getSegment(newSegmentId)) {
			// If the new SegmentId already exists, we need to discard the old one rather than trying to merge it.
			// This can only be done if the caller is expecting to regenerate Segments
			const canDiscardPartsForSegment = canDiscardParts && !segmentDiff.onlyRankChanged[oldSegmentExternalId]
			if (!canDiscardPartsForSegment) {
				throw new Error(`Cannot merge Segments with only rank changes`)
			}

			// Remove the old Segment and it's contents, the new one will be generated shortly
			ingestModel.removeSegment(oldSegmentId)
		} else {
			// Perform the rename
			ingestModel.changeSegmentId(oldSegmentId, newSegmentId)
		}
	}

	return renamedSegments
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
