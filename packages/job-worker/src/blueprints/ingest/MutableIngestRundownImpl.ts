import {
	IngestSegment,
	type IncomingIngestChange,
	type IngestDefaultChangesOptions,
	type IngestRundown,
	type MutableIngestRundown,
	MutableIngestSegment,
	MutableIngestPart,
} from '@sofie-automation/blueprints-integration'
import { Complete, clone, normalizeArrayToMap, omit } from '@sofie-automation/corelib/dist/lib'
import { ReadonlyDeep } from 'type-fest'
import _ = require('underscore')
import { MutableIngestSegmentImpl } from './MutableIngestSegmentImpl'
import { defaultApplyIngestChanges } from './defaultApplyIngestChanges'
import { IngestDataCacheObjId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { LocalIngestSegment, RundownIngestDataCacheGenerator } from '../../ingest/ingestCache'
import { IngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
import type { ComputedIngestChanges } from '../../ingest/runOperation'

export interface MutableIngestRundownChanges {
	// define what needs regenerating
	computedChanges: ComputedIngestChanges

	// define what portions of the ingestRundown need saving
	changedCacheObjects: IngestDataCacheObj[]
	allCacheObjectIds: IngestDataCacheObjId[]
}

export class MutableIngestRundownImpl<TRundownPayload = unknown, TSegmentPayload = unknown, TPartPayload = unknown>
	implements MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>
{
	readonly ingestRundown: Omit<IngestRundown, 'segments'>
	#hasChangesToRundown = false
	#segmentOrderChanged = false

	readonly #segments: MutableIngestSegmentImpl<TSegmentPayload, TPartPayload>[]

	get hasChangesToRundown(): boolean {
		return this.#hasChangesToRundown
	}
	get hasChangesToSegmentOrder(): boolean {
		return this.#segmentOrderChanged
	}

	constructor(ingestRundown: IngestRundown, hasChanges = false) {
		this.ingestRundown = omit(ingestRundown, 'segments')
		this.#segments = [...ingestRundown.segments]
			.sort((a, b) => a.rank - b.rank)
			.map((segment) => new MutableIngestSegmentImpl(segment))
		this.#hasChangesToRundown = hasChanges
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

	get payload(): ReadonlyDeep<TRundownPayload> | undefined {
		//if (!this.ingestRundown.payload) {
		//	throw new Error('Rundown payload is not set')
		//}

		return this.ingestRundown.payload
	}

	setName(name: string): void {
		if (this.ingestRundown.name !== name) {
			this.ingestRundown.name = name
			this.#hasChangesToRundown = true
		}
	}

	replacePayload(payload: ReadonlyDeep<TRundownPayload> | TRundownPayload): void {
		if (!_.isEqual(this.ingestRundown.payload, payload)) {
			this.ingestRundown.payload = clone(payload)
			this.#hasChangesToRundown = true
		}
	}

	setPayloadProperty<TKey extends keyof TRundownPayload>(key: TKey, value: TRundownPayload[TKey]): void {
		if (!this.ingestRundown.payload) {
			throw new Error('Rundown payload is not set')
		}

		if (!_.isEqual(this.ingestRundown.payload[key], value)) {
			this.ingestRundown.payload[key] = clone(value)
			this.#hasChangesToRundown = true
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

	moveSegmentBefore(id: string, beforeSegmentExternalId: string | null): void {
		const segment = this.#segments.find((s) => s.externalId === id)
		if (!segment) throw new Error(`Segment "${id}" not found`)

		this.removeSegment(id)

		if (beforeSegmentExternalId) {
			const beforeIndex = this.#segments.findIndex((s) => s.externalId === beforeSegmentExternalId)
			if (beforeIndex === -1) throw new Error(`Segment "${beforeSegmentExternalId}" not found`)

			this.#segments.splice(beforeIndex, 0, segment)
		} else {
			this.#segments.push(segment)
		}

		this.#segmentOrderChanged = true
	}

	moveSegmentAfter(id: string, afterSegmentExternalId: string | null): void {
		const segment = this.#segments.find((s) => s.externalId === id)
		if (!segment) throw new Error(`Segment "${id}" not found`)

		this.removeSegment(id)

		if (afterSegmentExternalId) {
			const beforeIndex = this.#segments.findIndex((s) => s.externalId === afterSegmentExternalId)
			if (beforeIndex === -1) throw new Error(`Segment "${afterSegmentExternalId}" not found`)

			this.#segments.splice(beforeIndex + 1, 0, segment)
		} else {
			this.#segments.unshift(segment)
		}

		this.#segmentOrderChanged = true
	}

	replaceSegment(
		segment: IngestSegment,
		beforeSegmentExternalId: string | null
	): MutableIngestSegment<TSegmentPayload, TPartPayload> {
		const newSegment = new MutableIngestSegmentImpl<TSegmentPayload, TPartPayload>(segment, true)

		this.removeSegment(segment.externalId)

		if (beforeSegmentExternalId) {
			const beforeIndex = this.#segments.findIndex((s) => s.externalId === beforeSegmentExternalId)
			if (beforeIndex === -1) throw new Error(`Segment "${beforeSegmentExternalId}" not found`)

			this.#segments.splice(beforeIndex, 0, newSegment)
		} else {
			this.#segments.push(newSegment)
		}

		this.#segmentOrderChanged = true

		return newSegment
	}

	removeSegment(id: string): boolean {
		const existingIndex = this.#segments.findIndex((s) => s.externalId === id)
		if (existingIndex !== -1) {
			this.#segments.splice(existingIndex, 1)

			this.#segmentOrderChanged = true

			return true
		} else {
			return false
		}
	}

	removeAllSegments(): void {
		this.#segments.length = 0

		this.#segmentOrderChanged = true
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

	intoIngestRundown(
		rundownId: RundownId,
		originalSofieIngestRundown: IngestRundown | undefined
	): MutableIngestRundownChanges {
		const generator = new RundownIngestDataCacheGenerator(rundownId)

		const ingestSegments: LocalIngestSegment[] = []
		const changedCacheObjects: IngestDataCacheObj[] = []
		const allCacheObjectIds: IngestDataCacheObjId[] = []

		const segmentsToRegenerate: LocalIngestSegment[] = []

		const usedSegmentIds = new Set<string>()
		const usedPartIds = new Set<string>()

		this.#segments.forEach((segment, rank) => {
			if (usedSegmentIds.has(segment.externalId)) {
				throw new Error(`Segment "${segment.externalId}" is used more than once`)
			}
			usedSegmentIds.add(segment.externalId)

			const segmentInfo = segment.intoChangesInfo(generator)

			for (const part of segmentInfo.ingestParts) {
				if (usedPartIds.has(part.externalId)) {
					throw new Error(`Part "${part.externalId}" is used more than once`)
				}
				usedPartIds.add(part.externalId)
			}

			const ingestSegment: Complete<LocalIngestSegment> = {
				externalId: segment.externalId,
				rank,
				name: segment.name,
				payload: segment.payload,
				parts: segmentInfo.ingestParts,
				modified: 0,
			}

			ingestSegments.push(ingestSegment)
			allCacheObjectIds.push(generator.getSegmentObjectId(ingestSegment.externalId))

			changedCacheObjects.push(...segmentInfo.changedCacheObjects)
			allCacheObjectIds.push(...segmentInfo.allCacheObjectIds)

			if (segmentInfo.segmentHasChanges) {
				changedCacheObjects.push(generator.generateSegmentObject(ingestSegment))
			}

			if (
				segmentInfo.segmentHasChanges ||
				segmentInfo.partOrderHasChanged ||
				segmentInfo.partIdsWithChanges.length > 0
			) {
				segmentsToRegenerate.push(ingestSegment)
			}
		})

		// Find any removed segments
		const newSegmentIds = new Set(ingestSegments.map((s) => s.externalId))
		const removedSegmentIds = originalSofieIngestRundown
			? originalSofieIngestRundown.segments
					.filter((s) => !newSegmentIds.has(s.externalId))
					.map((s) => s.externalId)
			: []

		// Find any with updated ranks
		const segmentsUpdatedRanks: Record<string, number> = {}
		if (originalSofieIngestRundown) {
			const oldSegmentMap = normalizeArrayToMap(originalSofieIngestRundown.segments, 'externalId')
			ingestSegments.forEach((segment) => {
				const oldRank = oldSegmentMap.get(segment.externalId)
				if (oldRank?.rank !== segment.rank) {
					segmentsUpdatedRanks[segment.externalId] = segment.rank
				}
			})
		}

		// Check if this rundown object has changed
		if (this.#hasChangesToRundown) {
			changedCacheObjects.push(generator.generateRundownObject(this.ingestRundown))
		}
		allCacheObjectIds.push(generator.getRundownObjectId())

		const result: MutableIngestRundownChanges = {
			computedChanges: {
				ingestRundown: {
					...this.ingestRundown,
					segments: ingestSegments,
					modified: 0,
				},

				segmentsToRemove: removedSegmentIds,
				segmentsUpdatedRanks,
				segmentsToRegenerate,
				regenerateRundown: this.#hasChangesToRundown,
			},

			changedCacheObjects,
			allCacheObjectIds,
		}

		return result
	}
}
