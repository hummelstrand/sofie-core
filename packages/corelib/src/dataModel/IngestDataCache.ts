import { IngestRundown, IngestSegment, IngestPart } from '@sofie-automation/blueprints-integration'
import { IngestDataCacheObjId, RundownId, SegmentId, PartId } from './Ids'
import { RundownSource } from './Rundown'

export enum IngestCacheType {
	RUNDOWN = 'rundown',
	SEGMENT = 'segment',
	PART = 'part',
}
export type IngestCacheData = IngestRundown | IngestSegment | IngestPart

export interface IngestRundownWithSource extends IngestRundown {
	rundownSource: RundownSource
}

interface IngestDataCacheObjBase {
	_id: IngestDataCacheObjId
	modified: number
	type: IngestCacheType

	/** Id of the Rundown */
	rundownId: RundownId
	segmentId?: SegmentId
	partId?: PartId

	data: IngestCacheData
}

export interface NrcsIngestDataCacheObjRundown extends IngestDataCacheObjBase {
	type: IngestCacheType.RUNDOWN
	rundownId: RundownId
	data: IngestRundownWithSource
}
export interface NrcsIngestDataCacheObjSegment extends IngestDataCacheObjBase {
	type: IngestCacheType.SEGMENT
	rundownId: RundownId
	segmentId: SegmentId

	data: IngestSegment
}
export interface NrcsIngestDataCacheObjPart extends IngestDataCacheObjBase {
	type: IngestCacheType.PART
	rundownId: RundownId
	segmentId: SegmentId
	partId: PartId
	data: IngestPart
}
export type NrcsIngestDataCacheObj =
	| NrcsIngestDataCacheObjRundown
	| NrcsIngestDataCacheObjSegment
	| NrcsIngestDataCacheObjPart

export interface SofieIngestDataCache extends IngestDataCacheObjBase {
	/** States for UserEdits, could be lock from NRCS updates,
	 * lock from user changes,
	 * or removedByUser
	 * */
	userEditStates?: Record<string, boolean>
}

export interface SofieIngestDataCacheObjRundown extends SofieIngestDataCache {
	type: IngestCacheType.RUNDOWN
	rundownId: RundownId
	data: IngestRundownWithSource
}

export interface SofieIngestDataCacheObjSegment extends SofieIngestDataCache {
	type: IngestCacheType.SEGMENT
	rundownId: RundownId
	segmentId: SegmentId
	data: IngestSegment
}

export interface SofieIngestDataCacheObjPart extends SofieIngestDataCache {
	type: IngestCacheType.PART
	rundownId: RundownId
	segmentId: SegmentId
	partId: PartId
	data: IngestPart
}

export type SofieIngestDataCacheObj =
	| SofieIngestDataCacheObjRundown
	| SofieIngestDataCacheObjSegment
	| SofieIngestDataCacheObjPart
