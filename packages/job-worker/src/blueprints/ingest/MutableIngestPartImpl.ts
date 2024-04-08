import type { IngestPart, MutableIngestPart } from '@sofie-automation/blueprints-integration'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { ReadonlyDeep } from 'type-fest'
import _ = require('underscore')

export class MutableIngestPartImpl<TPartPayload = unknown> implements MutableIngestPart<TPartPayload> {
	readonly ingestPart: IngestPart
	#hasChanges = false

	get hasChanges(): boolean {
		return this.#hasChanges
	}

	constructor(ingestPart: IngestPart, hasChanges = false) {
		this.ingestPart = ingestPart
		this.#hasChanges = hasChanges
	}

	get externalId(): string {
		return this.ingestPart.externalId
	}

	get name(): string {
		return this.ingestPart.name
	}

	// get rank(): number {
	// 	return this.#ingestPart.rank
	// }

	get payload(): ReadonlyDeep<TPartPayload> | undefined {
		//if (!this.ingestPart.payload) {
		//	throw new Error('Part payload is not set')
		//}

		return this.ingestPart.payload
	}

	setName(name: string): void {
		if (this.ingestPart.name !== name) {
			this.ingestPart.name = name
			this.#hasChanges = true
		}
	}

	replacePayload(payload: ReadonlyDeep<TPartPayload> | TPartPayload): void {
		if (!_.isEqual(this.ingestPart.payload, payload)) {
			this.ingestPart.payload = clone(payload)
			this.#hasChanges = true
		}
	}

	setPayloadProperty<TKey extends keyof TPartPayload>(key: TKey, value: TPartPayload[TKey]): void {
		if (!this.ingestPart.payload) {
			throw new Error('Part payload is not set')
		}

		if (!_.isEqual(this.ingestPart.payload[key], value)) {
			this.ingestPart.payload[key] = clone(value)
			this.#hasChanges = true
		}
	}
}
