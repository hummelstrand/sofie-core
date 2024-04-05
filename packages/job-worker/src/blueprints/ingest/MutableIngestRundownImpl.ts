import {
	IngestSegment,
	type IncomingIngestChange,
	type IngestDefaultChangesOptions,
	type IngestRundown,
	type MutableIngestRundown,
	MutableIngestSegment,
	MutableIngestPart,
} from '@sofie-automation/blueprints-integration'
import { clone, omit } from '@sofie-automation/corelib/dist/lib'
import { ReadonlyDeep } from 'type-fest'
import _ = require('underscore')
import { MutableIngestSegmentImpl } from './MutableIngestSegmentImpl'
import { defaultApplyIngestChanges } from './defaultApplyIngestChanges'

export class MutableIngestRundownImpl<TRundownPayload = unknown, TSegmentPayload = unknown, TPartPayload = unknown>
	implements MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>
{
	readonly ingestRundown: Omit<IngestRundown, 'segments'>
	#hasChanges = false

	readonly #segments: MutableIngestSegmentImpl<TSegmentPayload, TPartPayload>[]

	get hasChanges(): boolean {
		return this.#hasChanges
	}

	constructor(ingestRundown: IngestRundown) {
		this.ingestRundown = omit(ingestRundown, 'segments')
		this.#segments = ingestRundown.segments.map((segment) => new MutableIngestSegmentImpl(segment))
	}

	get segments(): MutableIngestSegmentImpl<TSegmentPayload, TPartPayload>[] {
		return [...this.#segments]
	}

	get externalId(): string {
		return this.ingestRundown.externalId
	}

	get type(): string {
		return this.ingestRundown.type
	}

	get name(): string {
		return this.ingestRundown.name
	}

	// get rank(): number {
	// 	return this.#ingestPart.rank
	// }

	get payload(): ReadonlyDeep<TRundownPayload> {
		if (!this.ingestRundown.payload) {
			throw new Error('Rundown payload is not set')
		}

		return this.ingestRundown.payload
	}

	setName(name: string): void {
		if (this.ingestRundown.name !== name) {
			this.ingestRundown.name = name
			this.#hasChanges = true
		}
	}

	replacePayload(payload: ReadonlyDeep<TRundownPayload> | TRundownPayload): void {
		if (!_.isEqual(this.ingestRundown.payload, payload)) {
			this.ingestRundown.payload = clone(payload)
			this.#hasChanges = true
		}
	}

	setPayloadProperty<TKey extends keyof TRundownPayload>(key: TKey, value: TRundownPayload[TKey]): void {
		if (!this.ingestRundown.payload) {
			throw new Error('Rundown payload is not set')
		}

		if (!_.isEqual(this.ingestRundown.payload[key], value)) {
			this.ingestRundown.payload[key] = clone(value)
			this.#hasChanges = true
		}
	}

	findPart(id: string): MutableIngestPart<TPartPayload> | undefined {
		for (const segment of this.#segments) {
			const part = segment.getPart(id)
			if (part) return part
		}

		return undefined
	}

	findPartAndSegment(partExternalId: string):
		| {
				part: MutableIngestPart<TPartPayload>
				segment: MutableIngestSegment<TSegmentPayload, TPartPayload>
		  }
		| undefined {
		for (const segment of this.#segments) {
			const part = segment.getPart(partExternalId)
			if (part) return { part, segment }
		}
		return undefined
	}

	getSegment(id: string): MutableIngestSegment<TSegmentPayload, TPartPayload> | undefined {
		return this.#segments.find((s) => s.externalId === id)
	}

	replaceSegment(
		segment: IngestSegment,
		beforeSegmentExternalId: string | null
	): MutableIngestSegment<TSegmentPayload, TPartPayload> {
		this.removeSegment(segment.externalId)

		const newSegment = new MutableIngestSegmentImpl<TSegmentPayload, TPartPayload>(segment)

		if (beforeSegmentExternalId) {
			const beforeIndex = this.#segments.findIndex((s) => s.externalId === beforeSegmentExternalId)
			if (beforeIndex === -1) throw new Error(`Segment "${beforeSegmentExternalId}" not found`)

			this.#segments.splice(beforeIndex, 0, newSegment)
		} else {
			this.#segments.push(newSegment)
		}

		return newSegment
	}

	removeSegment(id: string): boolean {
		const existingIndex = this.#segments.findIndex((s) => s.externalId === id)
		if (existingIndex !== -1) {
			this.#segments.splice(existingIndex, 1)

			return true
		} else {
			return false
		}
	}

	removeAllSegments(): void {
		// TODO - track what was deleted?
		this.#segments.length = 0
	}

	defaultApplyIngestChanges(
		nrcsRundown: IngestRundown,
		changes: IncomingIngestChange,
		options?: IngestDefaultChangesOptions<TRundownPayload, TSegmentPayload, TPartPayload>
	): void {
		defaultApplyIngestChanges(this, nrcsRundown, changes, {
			transformRundownPayload: (payload) => payload as TRundownPayload,
			transformSegmentPayload: (payload) => payload as TSegmentPayload,
			transformPartPayload: (payload) => payload as TPartPayload,
			...options,
		})
	}
}
