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

export interface IncomingIngestChange {
	/** Indicate that this change is from ingest operations */
	source: 'ingest'

	/**
	 * True when the rank of any segment in the rundown has changed.
	 * Expressing what exactly has changed non-trivial particularly how to represent that in this structure, so for now we just have a simple boolean.
	 */
	segmentOrderChanged?: boolean

	/**
	 * True when the payload of the rundown has changed.
	 * TODO: should this be more specific?
	 */
	rundownPayloadChanged?: boolean

	/**
	 * Contains the ids of the segments that have changed.
	 * TODO: should this be more specific?
	 */
	changedSegmentIds?: string[]

	/**
	 * Contains the ids of the parts that have changed.
	 * TODO: should this be more specific?
	 */
	changedPartIds?: string[]
}

export interface MutableIngestRundown<TRundownPayload = unknown, TSegmentPayload = unknown, TPartPayload = unknown> {
	/** Id of the rundown as reported by the ingest gateway. Must be unique for each rundown owned by the gateway */
	readonly externalId: string
	/** Name of the rundown */
	readonly name: string

	/** Something that identified the data source. eg "spreadsheet", "mos" */
	readonly type: string

	/** Raw payload of rundown metadata. Only used by the blueprints */
	readonly payload?: ReadonlyDeep<TRundownPayload>

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

	/** Raw payload of segment metadata. Only used by the blueprints */
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

	/** Raw payload of the part. Only used by the blueprints */
	readonly payload?: ReadonlyDeep<TPartPayload>
}
