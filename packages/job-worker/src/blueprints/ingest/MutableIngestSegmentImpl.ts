import type {
	IngestPart,
	IngestSegment,
	MutableIngestPart,
	MutableIngestSegment,
} from '@sofie-automation/blueprints-integration'
import { Complete, clone, omit } from '@sofie-automation/corelib/dist/lib'
import { ReadonlyDeep } from 'type-fest'
import _ = require('underscore')
import { MutableIngestPartImpl } from './MutableIngestPartImpl'
import { LocalIngestPart, RundownIngestDataCacheGenerator } from '../../ingest/ingestCache'
import { IngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
import { getSegmentId } from '../../ingest/lib'
import { IngestDataCacheObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export class MutableIngestSegmentImpl<TSegmentPayload = unknown, TPartPayload = unknown>
	implements MutableIngestSegment<TSegmentPayload, TPartPayload>
{
	readonly ingestSegment: Omit<IngestSegment, 'parts'>
	#segmentHasChanges = false
	#partOrderHasChanged = false

	readonly #parts: MutableIngestPartImpl<TPartPayload>[]

	get hasChanges(): boolean {
		return this.#segmentHasChanges
	}

	constructor(ingestSegment: IngestSegment, hasChanges = false) {
		this.ingestSegment = omit(ingestSegment, 'parts')
		this.#parts = [...ingestSegment.parts]
			.sort((a, b) => a.rank - b.rank)
			.map((part) => new MutableIngestPartImpl<TPartPayload>(part, hasChanges))
		this.#segmentHasChanges = hasChanges
	}

	get parts(): MutableIngestPart<TPartPayload>[] {
		return [...this.#parts]
	}

	get externalId(): string {
		return this.ingestSegment.externalId
	}

	get name(): string {
		return this.ingestSegment.name
	}

	// get rank(): number {
	// 	return this.#ingestPart.rank
	// }

	get payload(): ReadonlyDeep<TSegmentPayload> | undefined {
		// if (!this.ingestSegment.payload) {
		//     throw new Error('Segment payload is not set')
		// }

		return this.ingestSegment.payload
	}

	getPart(id: string): MutableIngestPart<TPartPayload> | undefined {
		return this.#parts.find((part) => part.ingestPart.externalId === id)
	}

	replacePart(part: IngestPart, beforePartExternalId: string | null): MutableIngestPart<TPartPayload> {
		this.removePart(part.externalId)

		const newPart = new MutableIngestPartImpl<TPartPayload>(part, true)

		if (beforePartExternalId) {
			const beforeIndex = this.#parts.findIndex((s) => s.externalId === beforePartExternalId)
			if (beforeIndex === -1) throw new Error(`Part "${beforePartExternalId}" not found`)

			this.#parts.splice(beforeIndex, 0, newPart)
		} else {
			this.#parts.push(newPart)
		}

		this.#partOrderHasChanged = true

		return newPart
	}

	removePart(id: string): boolean {
		const index = this.#parts.findIndex((part) => part.ingestPart.externalId === id)
		if (index === -1) {
			return false
		}

		this.#parts.splice(index, 1)
		this.#partOrderHasChanged = true

		return true
	}

	setName(name: string): void {
		if (this.ingestSegment.name !== name) {
			this.ingestSegment.name = name
			this.#segmentHasChanges = true
		}
	}

	replacePayload(payload: ReadonlyDeep<TSegmentPayload> | TSegmentPayload): void {
		if (!_.isEqual(this.ingestSegment.payload, payload)) {
			this.ingestSegment.payload = clone(payload)
			this.#segmentHasChanges = true
		}
	}

	setPayloadProperty<TKey extends keyof TSegmentPayload>(key: TKey, value: TSegmentPayload[TKey]): void {
		if (!this.ingestSegment.payload) {
			throw new Error('Segment payload is not set')
		}

		if (!_.isEqual(this.ingestSegment.payload[key], value)) {
			this.ingestSegment.payload[key] = clone(value)
			this.#segmentHasChanges = true
		}
	}

	intoChangesInfo(generator: RundownIngestDataCacheGenerator): {
		ingestParts: LocalIngestPart[]
		changedCacheObjects: IngestDataCacheObj[]
		allCacheObjectIds: IngestDataCacheObjId[]
		segmentHasChanges: boolean
		partIdsWithChanges: string[]
		partOrderHasChanged: boolean
	} {
		const ingestParts: LocalIngestPart[] = []
		const changedCacheObjects: IngestDataCacheObj[] = []
		const allCacheObjectIds: IngestDataCacheObjId[] = []
		const partIdsWithChanges: string[] = []

		const segmentId = getSegmentId(generator.rundownId, this.ingestSegment.externalId)

		this.#parts.forEach((part, rank) => {
			const ingestPart: Complete<LocalIngestPart> = {
				externalId: part.externalId,
				rank,
				name: part.name,
				payload: part.payload,
				modified: 0,
			}

			allCacheObjectIds.push(generator.getPartObjectId(ingestPart.externalId))
			ingestParts.push(ingestPart)

			if (part.hasChanges) {
				changedCacheObjects.push(generator.generatePartObject2(segmentId, ingestPart))
				partIdsWithChanges.push(ingestPart.externalId)
			}
		})

		return {
			ingestParts,
			changedCacheObjects,
			allCacheObjectIds,
			segmentHasChanges: this.#segmentHasChanges,
			partIdsWithChanges,
			partOrderHasChanged: this.#partOrderHasChanged,
		}
	}
}
