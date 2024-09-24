import { IngestPart, IngestPlaylist, IngestRundown, IngestSegment } from './ingest'

export interface SofieIngestPlaylist extends IngestPlaylist {
	/** Ingest cache of rundowns in this playlist. */
	rundowns: SofieIngestRundown[]
}
export interface SofieIngestRundown extends IngestRundown {
	/** Array of segments in this rundown */
	segments: SofieIngestSegment[]

	/** States for UserEdits, could be lock from NRCS updates,
	 * lock from user changes,
	 * or removedByUser
	 * */
	userEditStates: Record<string, boolean>
}
export interface SofieIngestSegment extends IngestSegment {
	/** Array of parts in this segment */
	parts: SofieIngestPart[]

	/** States for UserEdits, could be lock from NRCS updates,
	 * lock from user changes,
	 * or removedByUser
	 * */
	userEditStates: Record<string, boolean>
}
export interface SofieIngestPart extends IngestPart {
	/** States for UserEdits, could be lock from NRCS updates,
	 * lock from user changes,
	 * or removedByUser
	 * */
	userEditStates: Record<string, boolean>
}
