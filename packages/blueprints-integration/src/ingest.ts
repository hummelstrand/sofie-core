import { IngestPart, IngestRundown, IngestSegment } from '@sofie-automation/shared-lib/dist/peripheralDevice/ingest'
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
	Inserted = 'inserted',
	Deleted = 'deleted',
	Payload = 'payload',
	// Rank = 'rank',
}
export enum IncomingIngestSegmentChangeEnum {
	Inserted = 'inserted', // nocommit: or "replaced" / "upsert"?
	Deleted = 'deleted',
	// Contents = 'contents',
	// ContentsOrder = 'contentsOrder',
	// Payload = 'payload',
	// Rank = 'rank',
}
export enum IncomingIngestRundownChange {
	// Deleted = 'deleted',
	// nocommit: describe these
	Payload = 'payload',
	// CoreData = 'coreData',
	Regenerate = 'regenerate',
}

export interface IncomingIngestSegmentChangeObject {
	/**
	 * If set, this Segment has been renamed from the specified id
	 * @deprecated This is temporary for MOS compatibility
	 */
	oldExternalId?: string

	/**
	 * True when the payload of the segment has changed.
	 */
	payloadChanged?: boolean

	/**
	 * True when the rank of any part in the segment has changed.
	 */
	partOrderChanged?: boolean

	/**
	 * Descibes the changes to the parts in the rundown
	 */
	partsChanges?: Record<string, IncomingIngestPartChange>
}

export type IncomingIngestSegmentChange = IncomingIngestSegmentChangeEnum | IncomingIngestSegmentChangeObject

export interface IncomingIngestChange {
	/** Indicate that this change is from ingest operations */
	source: 'ingest'

	/**
	 * True when the rank of any segment in the rundown has changed.
	 * Expressing what exactly has changed non-trivial particularly how to represent that in this structure,
	 * so for now we just have a simple boolean.
	 * If this is false, no segments have been reordered, added or removed. // nocommit: confirm this
	 */
	segmentOrderChanged?: boolean

	/**
	 * Describes the changes to the rundown itself
	 */
	rundownChanges?: IncomingIngestRundownChange | null

	/**
	 * Describes the changes to the segments in the rundown
	 */
	segmentChanges?: Record<string, IncomingIngestSegmentChange>
}

export type DefaultUserOperations = {
	type: '__sofie-move-segment' // TODO: define properly
}

export interface UserOperationChange<TCustomBlueprintOperations = never> {
	/** Indicate that this change is from user operations */
	source: 'user'

	operation: DefaultUserOperations | TCustomBlueprintOperations
}

export interface MutableIngestRundown<TRundownPayload = unknown, TSegmentPayload = unknown, TPartPayload = unknown> {
	/** Id of the rundown as reported by the ingest gateway. Must be unique for each rundown owned by the gateway */
	readonly externalId: string
	/** Name of the rundown */
	readonly name: string

	/** Something that identified the data source. eg "spreadsheet", "mos" */
	readonly type: string

	/** Payload of rundown metadata. For use by other blueprints methods */
	readonly payload: ReadonlyDeep<TRundownPayload> | undefined

	// nocommit - split payload into 'private' and 'public'? ie, one for `getRundown` and one for `getSegment`, so that we can affect the rundown generation without regenerating all of the segments.
	// Or should we expect this blueprint stage to copy any needed properties into each of the segment/part payloads?

	/** Array of segments in this rundown */
	readonly segments: ReadonlyArray<MutableIngestSegment<TSegmentPayload, TPartPayload>>

	findPart(partExternalId: string): MutableIngestPart<TPartPayload> | undefined

	findPartAndSegment(partExternalId: string):
		| {
				part: MutableIngestPart<TPartPayload>
				segment: MutableIngestSegment<TSegmentPayload, TPartPayload>
		  }
		| undefined

	getSegment(segmentExternalId: string): MutableIngestSegment<TSegmentPayload, TPartPayload> | undefined

	moveSegmentBefore(segmentExternalId: string, beforeSegmentExternalId: string | null): void
	moveSegmentAfter(segmentExternalId: string, afterSegmentExternalId: string | null): void

	replaceSegment(
		segment: Omit<IngestSegment, 'rank'>,
		beforeSegmentExternalId: string | null
	): MutableIngestSegment<TSegmentPayload, TPartPayload>

	// nocommit - better naming of this method?
	renameSegment(
		oldSegmentExternalId: string,
		newSegmentExternalId: string
	): MutableIngestSegment<TSegmentPayload, TPartPayload>

	removeSegment(segmentExternalId: string): boolean

	removeAllSegments(): void

	forceFullRegenerate(): void

	/** Set name of the Rundown */
	setName(name: string): void

	replacePayload(payload: ReadonlyDeep<TRundownPayload> | TRundownPayload): void

	setPayloadProperty<TKey extends keyof TRundownPayload>(key: TKey, value: TRundownPayload[TKey]): void
	// nocommit: is this better than exposing the payload property?
	// getPayloadProperty<TKey extends keyof TRundownPayload>(key: TKey, value: TRundownPayload[TKey]): void
	// clearPayload<TKey extends keyof TRundownPayload>(key: TKey, value: TRundownPayload[TKey]): void

	// :eyes:
	defaultApplyIngestChanges(
		ingestRundown: IngestRundown,
		changes: IncomingIngestChange,
		options?: IngestDefaultChangesOptions<TRundownPayload, TSegmentPayload, TPartPayload>
	): void
}

export interface MutableIngestSegment<TSegmentPayload = unknown, TPartPayload = unknown> {
	/** Id of the segment as reported by the ingest gateway. Must be unique for each segment in the rundown */
	readonly externalId: string
	/** Name of the segment */
	readonly name: string

	/** Payload of segment metadata. For use by other blueprints methods */
	readonly payload: ReadonlyDeep<TSegmentPayload> | undefined

	/** Array of parts in this segment */
	readonly parts: ReadonlyArray<MutableIngestPart<TPartPayload>>

	getPart(partExternalId: string): MutableIngestPart<TPartPayload> | undefined

	movePartBefore(partExternalId: string, beforePartExternalId: string | null): void
	movePartAfter(partExternalId: string, afterPartExternalId: string | null): void

	replacePart(
		ingestPart: Omit<IngestPart, 'rank'>,
		beforePartExternalId: string | null
	): MutableIngestPart<TPartPayload>

	removePart(partExternalId: string): boolean

	/** Force this segment to be regenerated, even if there are no changes */
	forceRegenerate(): void

	/** Set the name of the Segment */
	setName(name: string): void

	replacePayload(payload: ReadonlyDeep<TSegmentPayload> | TSegmentPayload): void

	setPayloadProperty<TKey extends keyof TSegmentPayload>(key: TKey, value: TSegmentPayload[TKey]): void
}

export interface MutableIngestPart<TPartPayload = unknown> {
	/** Id of the part as reported by the ingest gateway. Must be unique for each part in the rundown */
	readonly externalId: string
	/** Name of the part */
	readonly name: string

	/** Payload of the part. For use by other blueprints methods */
	readonly payload: ReadonlyDeep<TPartPayload> | undefined

	/** Set the name of the Part */
	setName(name: string): void

	replacePayload(payload: ReadonlyDeep<TPartPayload> | TPartPayload): void

	setPayloadProperty<TKey extends keyof TPartPayload>(key: TKey, value: TPartPayload[TKey]): void
}

export type TransformPayloadFunction<T> = (payload: any, oldPayload: ReadonlyDeep<T> | undefined) => T | ReadonlyDeep<T>

export interface IngestDefaultChangesOptions<
	TRundownPayload = unknown,
	TSegmentPayload = unknown,
	TPartPayload = unknown
> {
	transformRundownPayload: TransformPayloadFunction<TRundownPayload>
	transformSegmentPayload: TransformPayloadFunction<TSegmentPayload>
	transformPartPayload: TransformPayloadFunction<TPartPayload>
}
