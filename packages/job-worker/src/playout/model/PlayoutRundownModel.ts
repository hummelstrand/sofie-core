import { PartId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ReadonlyDeep } from 'type-fest'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { PlayoutSegmentModel } from './PlayoutSegmentModel'

/**
 * Wrap a Rundown and its Segments in a readonly and simplified view for Playout operations
 */
export interface PlayoutRundownModel {
	/**
	 * The Rundown properties
	 */
	readonly Rundown: ReadonlyDeep<DBRundown>
	/**
	 * All the Segments in the Rundown
	 * Sorted by their rank
	 */
	readonly Segments: readonly PlayoutSegmentModel[]

	/**
	 * The RundownBaselineObjs for this Rundown
	 */
	readonly BaselineObjects: ReadonlyDeep<RundownBaselineObj[]>

	/**
	 * Get a Segment which belongs to this Rundown
	 * @param id Id of the Segment
	 */
	getSegment(id: SegmentId): PlayoutSegmentModel | undefined

	/**
	 * Get all the SegmentIds in this Rundown
	 * Sorted by the Segment ranks
	 */
	getSegmentIds(): SegmentId[]

	/**
	 * Get all the PartIds in this Rundown
	 * Sorted by the Segment and Part ranks
	 */
	getAllPartIds(): PartId[]

	/**
	 * All the Parts in the Rundown
	 * Sorted by the Segment and Part ranks
	 */
	getAllOrderedParts(): ReadonlyDeep<DBPart>[]

	/**
	 * Insert the Scratchpad Segment for this Rundown
	 * Throws if the segment already exists
	 */
	insertScratchpadSegment(): SegmentId
	/**
	 * Remove the Scratchpad Segment for this Rundown
	 * @returns true if the Segment was found
	 */
	removeScratchpadSegment(): boolean
	/**
	 * Get the Scratchpad Segment for this Rundown, if it exists
	 */
	getScratchpadSegment(): PlayoutSegmentModel | undefined
	/**
	 * Set the rank of the Scratchpad Segment in this Rundown
	 * Throws if the segment does not exists
	 * @param rank New rank
	 */
	setScratchpadSegmentRank(rank: number): void
}
