import type { IngestSegment, MutableIngestPart, MutableIngestSegment } from '@sofie-automation/blueprints-integration'
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

	// TODO - part mutation/replacement
}
