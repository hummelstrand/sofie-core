import { SegmentDisplayMode, SegmentTimingInfo } from '@sofie-automation/blueprints-integration'
import { SegmentId, RundownId } from './Ids'
import { SegmentNote } from './Notes'
import { CoreUserEditingDefinitionAction } from './Rundown'

export enum SegmentOrphanedReason {
	/** Segment is deleted from the NRCS but we still need it */
	DELETED = 'deleted',
	/** Segment should be hidden, but it is still playing */
	HIDDEN = 'hidden',
	/** Segment is owned by playout, and is for AdlibTesting in its rundown */
	ADLIB_TESTING = 'adlib-testing',
}

/** A "Title" in NRK Lingo / "Stories" in ENPS Lingo. */
export interface DBSegment {
	_id: SegmentId
	/** Position inside rundown */
	_rank: number
	/** ID of the source object in the gateway */
	externalId: string
	/** The rundown this segment belongs to */
	rundownId: RundownId

	/** User-presentable name (Slug) for the Title */
	name: string
	/** Arbitraty data storage for internal use in the blueprints */
	privateData?: unknown
	/** Arbitraty data relevant for other systems, made available to them through APIs */
	publicData?: unknown
	/** Hide the Segment in the UI */
	isHidden?: boolean
	/** User-facing identifier that can be used by the User to identify the contents of a segment in the Rundown source system */
	identifier?: string

	/** Show the minishelf of the segment */
	showShelf?: boolean
	/** Segment display mode. Default mode is *SegmentDisplayMode.Timeline* */
	displayAs?: SegmentDisplayMode

	/** Contains properties related to the timing of the segment */
	segmentTiming?: SegmentTimingInfo

	/** Is the segment in an unsynced state? */
	orphaned?: SegmentOrphanedReason

	/** Holds notes (warnings / errors) thrown by the blueprints during creation */
	notes?: Array<SegmentNote>

	/** States for UserEdits, could be lock from NRCS updates,
	 * lock from user changes,
	 * or removedByUser
	 * */
	userEditStates?: Record<string, boolean>
	/**
	 * User editing definitions for this segment
	 */
	userEdits?: CoreUserEditingDefinitionAction[]
}
