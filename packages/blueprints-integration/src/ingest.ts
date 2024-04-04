import { IngestRundown } from '@sofie-automation/shared-lib/dist/peripheralDevice/ingest'
import { IBlueprintRundownDBData } from './documents'
import { ReadonlyDeep } from 'type-fest'

export {
	IngestPart,
	IngestPlaylist,
	IngestRundown,
	IngestSegment,
	IngestAdlib,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/ingest'

/** The IngesteRundown is extended with data from Core */
export interface ExtendedIngestRundown extends IngestRundown {
	coreData: IBlueprintRundownDBData | undefined
}

export enum IncomingIngestPartChange {
	Deleted = 'deleted',
	Payload = 'payload',
	Rank = 'rank',
}
export enum IncomingIngestSegmentChange {
	Deleted = 'deleted',
	// Contents = 'contents',
	ContentsOrder = 'contentsOrder',
	Payload = 'payload',
	// Rank = 'rank',
}
export enum IncomingIngestRundownChange {
	// Deleted = 'deleted',
	Payload = 'payload',
	CoreData = 'coreData',
	Regenerate = 'regenerate',
}

export interface IncomingIngestChange {
	/** Indicate that this change is from ingest operations */
	source: 'ingest'

	/**
	 * True when the rank of any segment in the rundown has changed.
	 * Expressing what exactly has changed non-trivial particularly how to represent that in this structure, so for now we just have a simple boolean.
	 */
	segmentOrderChanged?: boolean

	/**
	 * Describes the changes to the rundown itself
	 */
	rundownChanges?: IncomingIngestRundownChange

	/**
	 * Describes the changes to the segments in the rundown
	 */
	segmentChanges?: Record<string, IncomingIngestSegmentChange>

	/**
	 * Descibes the changes to the parts in the rundown
	 */
	partsChanged?: Record<string, IncomingIngestPartChange>
}

export interface MutableIngestRundown<TRundownPayload = unknown, TSegmentPayload = unknown, TPartPayload = unknown> {
	/** Id of the rundown as reported by the ingest gateway. Must be unique for each rundown owned by the gateway */
	readonly externalId: string
	/** Name of the rundown */
	readonly name: string

	/** Something that identified the data source. eg "spreadsheet", "mos" */
	readonly type: string

	/** Payload of rundown metadata. For use by other blueprints methods */
	readonly payload?: ReadonlyDeep<TRundownPayload>

	// TODO - split payload into 'private' and 'public'? ie, one for `getRundown` and one for `getSegment`, so that we can affect the rundown generation without regenerating all of the segments.
	// Or should we expect this blueprint stage to copy any needed properties into each of the segment/part payloads?

	/** Array of segmsnts in this rundown */
	readonly segments: ReadonlyArray<MutableIngestSegment<TSegmentPayload, TPartPayload>>
}

export interface MutableIngestSegment<TSegmentPayload = unknown, TPartPayload = unknown> {
	/** Id of the segment as reported by the ingest gateway. Must be unique for each segment in the rundown */
	readonly externalId: string
	/** Name of the segment */
	readonly name: string
	/** Rank of the segment within the rundown */
	readonly rank: number

	/** Payload of segment metadata. For use by other blueprints methods */
	readonly payload?: ReadonlyDeep<TSegmentPayload>

	/** Array of parts in this segment */
	readonly parts: ReadonlyArray<MutableIngestPart<TPartPayload>>
}

export interface MutableIngestPart<TPartPayload = unknown> {
	/** Id of the part as reported by the ingest gateway. Must be unique for each part in the rundown */
	readonly externalId: string
	/** Name of the part */
	readonly name: string
	/** Rank of the part within the segment */
	readonly rank: number

	/** Payload of the part. For use by other blueprints methods */
	readonly payload?: ReadonlyDeep<TPartPayload>
}
