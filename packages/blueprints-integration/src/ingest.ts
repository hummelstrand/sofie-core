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

export enum NrcsIngestPartChangeDetails {
	Inserted = 'inserted',
	Deleted = 'deleted',
	Payload = 'payload',
	// Rank = 'rank',
}
export enum NrcsIngestSegmentChangeDetailsEnum {
	Inserted = 'inserted', // nocommit: or "replaced" / "upsert"?
	Deleted = 'deleted',
	// Contents = 'contents',
	// ContentsOrder = 'contentsOrder',
	// Payload = 'payload',
	// Rank = 'rank',
}
export enum NrcsIngestRundownChangeDetails {
	// Deleted = 'deleted',
	// nocommit: describe these
	Payload = 'payload',
	// CoreData = 'coreData',
	Regenerate = 'regenerate',
}

export interface NrcsIngestSegmentChangeDetailsObject {
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
	partsChanges?: Record<string, NrcsIngestPartChangeDetails>
}

export type NrcsIngestSegmentChangeDetails = NrcsIngestSegmentChangeDetailsEnum | NrcsIngestSegmentChangeDetailsObject

export interface NrcsIngestChangeDetails {
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
	rundownChanges?: NrcsIngestRundownChangeDetails | null

	/**
	 * Describes the changes to the segments in the rundown
	 */
	segmentChanges?: Record<string, NrcsIngestSegmentChangeDetails>
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

	/**
	 * Search for a Part through the whole IngestRundown
	 * @param partExternalId externalId of the Part
	 */
	findPart(partExternalId: string): MutableIngestPart<TPartPayload> | undefined

	/**
	 * Search for a Part through the whole IngestRundown
	 * @param partExternalId externalId of the Part
	 * @returns The part and segment that the part belongs to
	 */
	findPartAndSegment(partExternalId: string):
		| {
				part: MutableIngestPart<TPartPayload>
				segment: MutableIngestSegment<TSegmentPayload, TPartPayload>
		  }
		| undefined

	getSegment(segmentExternalId: string): MutableIngestSegment<TSegmentPayload, TPartPayload> | undefined

	/**
	 * Move a segment to a new position in the rundown
	 * @param segmentExternalId externalId of the Segment to move
	 * @param beforeSegmentExternalId externalId of the Segment to position before. If null, position at the end
	 */
	moveSegmentBefore(segmentExternalId: string, beforeSegmentExternalId: string | null): void

	/**
	 * Move a segment to a new position in the rundown
	 * @param segmentExternalId externalId of the Segment to move
	 * @param afterSegmentExternalId externalId of the Segment to position after. If null, position at the beginning
	 */
	moveSegmentAfter(segmentExternalId: string, afterSegmentExternalId: string | null): void

	/**
	 * Replace a Segment in the Rundown with a new one. If the Segment does not already exist, it will be inserted.
	 * This will replace all of the Parts in the Segment as well, along with the payload and other properties of the Segment.
	 * @param segment the new IngestSegment to insert
	 * @param beforeSegmentExternalId externalId of the Segment to position before. If null, position at the end
	 * @returns the new MutableIngestSegment
	 */
	replaceSegment(
		segment: Omit<IngestSegment, 'rank'>,
		beforeSegmentExternalId: string | null
	): MutableIngestSegment<TSegmentPayload, TPartPayload>

	// nocommit - better naming of this method?
	renameSegment(
		oldSegmentExternalId: string,
		newSegmentExternalId: string
	): MutableIngestSegment<TSegmentPayload, TPartPayload>

	/**
	 * Remove a Segment from the Rundown
	 * @param segmentExternalId externalId of the Segment to remove
	 * @returns true if the segment was removed, false if it was not found
	 */
	removeSegment(segmentExternalId: string): boolean

	/**
	 * Remove all Segments from the Rundown
	 */
	removeAllSegments(): void

	/**
	 * Force the whole Rundown to be re-run through the ingest blueprints, even if there are no changes
	 */
	forceFullRegenerate(): void

	/**
	 * Set name of the Rundown
	 */
	setName(name: string): void

	replacePayload(payload: ReadonlyDeep<TRundownPayload> | TRundownPayload): void

	setPayloadProperty<TKey extends keyof TRundownPayload>(key: TKey, value: TRundownPayload[TKey]): void
	// nocommit: is this better than exposing the payload property?
	// getPayloadProperty<TKey extends keyof TRundownPayload>(key: TKey, value: TRundownPayload[TKey]): void
	// clearPayload<TKey extends keyof TRundownPayload>(key: TKey, value: TRundownPayload[TKey]): void

	/**
	 * Perform the default syncing of changes from the ingest data to the rundown.
	 * This may be overly agressive at removing any changes made by user operations.
	 * If you are using user operations, you may need to perform some pre and post fixups to ensure changes aren't wiped unnecessarily.
	 * @param ingestRundown NRCS version of the IngestRundown to copy from
	 * @param changes A description of the changes that have been made to the rundown and should be propogated
	 * @param options Options for how to apply the changes
	 */
	defaultApplyIngestChanges(
		ingestRundown: IngestRundown,
		changes: NrcsIngestChangeDetails,
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

	/**
	 * Get a Part from the Segment
	 * @param partExternalId externalId of the Part
	 */
	getPart(partExternalId: string): MutableIngestPart<TPartPayload> | undefined

	/**
	 * Move a part to a new position in the segment
	 * @param partExternalId externalId of the Part to move
	 * @param beforePartExternalId externalId of the Part to position before. If null, position at the end
	 */
	movePartBefore(partExternalId: string, beforePartExternalId: string | null): void

	/**
	 * Move a part to a new position in the segment
	 * @param partExternalId externalId of the Part to move
	 * @param afterPartExternalId externalId of the Part to position after. If null, position at the beginning
	 */
	movePartAfter(partExternalId: string, afterPartExternalId: string | null): void

	/**
	 * Replace a Part in the Segment with a new one. If the Part does not already exist, it will be inserted.
	 * This will replace the payload and other properties of the Part.
	 * @param ingestPart the new IngestPart to insert
	 * @param beforePartExternalId externalId of the Part to position before. If null, position at the end
	 * @returns the new MutableIngestPart
	 */
	replacePart(
		ingestPart: Omit<IngestPart, 'rank'>,
		beforePartExternalId: string | null
	): MutableIngestPart<TPartPayload>

	/**
	 * Remove a Part from the Segment
	 * @param partExternalId externalId of the Part to remove
	 * @returns true if the part was removed, false if it was not found
	 */
	removePart(partExternalId: string): boolean

	/**
	 * Force this segment to be regenerated, even if there are no changes
	 */
	forceRegenerate(): void

	/**
	 * Set the name of the Segment
	 */
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

	/**
	 * Set the name of the Part
	 */
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
	/**
	 * A custom transform for the payload of a Rundown.
	 * Typically this will translate from a NRCS native structure to a javascript friendly structure.
	 */
	transformRundownPayload: TransformPayloadFunction<TRundownPayload>
	/**
	 * A custom transform for the payload of a Segment.
	 * Typically this will translate from a NRCS native structure to a javascript friendly structure.
	 */
	transformSegmentPayload: TransformPayloadFunction<TSegmentPayload>
	/**
	 * A custom transform for the payload of a Part.
	 * Typically this will translate from a NRCS native structure to a javascript friendly structure.
	 */
	transformPartPayload: TransformPayloadFunction<TPartPayload>
}
