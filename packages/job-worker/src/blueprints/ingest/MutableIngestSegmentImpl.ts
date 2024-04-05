import type {
	IngestPart,
	IngestSegment,
	MutableIngestPart,
	MutableIngestSegment,
} from '@sofie-automation/blueprints-integration'
import { clone, omit } from '@sofie-automation/corelib/dist/lib'
import { ReadonlyDeep } from 'type-fest'
import _ = require('underscore')
import { MutableIngestPartImpl } from './MutableIngestPartImpl'

export class MutableIngestSegmentImpl<TSegmentPayload = unknown, TPartPayload = unknown>
	implements MutableIngestSegment<TSegmentPayload, TPartPayload>
{
	readonly ingestSegment: Omit<IngestSegment, 'parts'>
	#hasChanges = false

	readonly #parts: MutableIngestPartImpl<TPartPayload>[]

	get hasChanges(): boolean {
		return this.#hasChanges
	}

	constructor(ingestSegment: IngestSegment) {
		this.ingestSegment = omit(ingestSegment, 'parts')
		this.#parts = ingestSegment.parts.map((part) => new MutableIngestPartImpl(part))
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

	get payload(): ReadonlyDeep<TSegmentPayload> {
		if (!this.ingestSegment.payload) {
			throw new Error('Segment payload is not set')
		}

		return this.ingestSegment.payload
	}

	getPart(id: string): MutableIngestPart<TPartPayload> | undefined {
		return this.#parts.find((part) => part.ingestPart.externalId === id)
	}

	replacePart(part: IngestPart, beforePartExternalId: string | null): MutableIngestPart<TPartPayload> {
		this.removePart(part.externalId)

		const newPart = new MutableIngestPartImpl<TPartPayload>(part)

		if (beforePartExternalId) {
			const beforeIndex = this.#parts.findIndex((s) => s.externalId === beforePartExternalId)
			if (beforeIndex === -1) throw new Error(`Part "${beforePartExternalId}" not found`)

			this.#parts.splice(beforeIndex, 0, newPart)
		} else {
			this.#parts.push(newPart)
		}

		this.#hasChanges = true // TODO - should this be here?

		return newPart
	}

	removePart(id: string): boolean {
		const index = this.#parts.findIndex((part) => part.ingestPart.externalId === id)
		if (index === -1) {
			return false
		}

		this.#parts.splice(index, 1)
		this.#hasChanges = true // TODO - should this be here?

		return true
	}

	setName(name: string): void {
		if (this.ingestSegment.name !== name) {
			this.ingestSegment.name = name
			this.#hasChanges = true
		}
	}

	replacePayload(payload: ReadonlyDeep<TSegmentPayload> | TSegmentPayload): void {
		if (!_.isEqual(this.ingestSegment.payload, payload)) {
			this.ingestSegment.payload = clone(payload)
			this.#hasChanges = true
		}
	}

	setPayloadProperty<TKey extends keyof TSegmentPayload>(key: TKey, value: TSegmentPayload[TKey]): void {
		if (!this.ingestSegment.payload) {
			throw new Error('Segment payload is not set')
		}

		if (!_.isEqual(this.ingestSegment.payload[key], value)) {
			this.ingestSegment.payload[key] = clone(value)
			this.#hasChanges = true
		}
	}
}
