import { RundownId, SegmentId, IngestDataCacheObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	IngestDataCacheObj,
	IngestCacheType,
	IngestDataCacheObjRundown,
	IngestDataCacheObjSegment,
	IngestDataCacheObjPart,
} from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { getCurrentTime } from '../lib'
import _ = require('underscore')
import { IngestRundown, IngestSegment, IngestPart } from '@sofie-automation/blueprints-integration'
import { JobContext } from '../jobs'
import { getPartId, getSegmentId } from './lib'
import { SetOptional } from 'type-fest'
import { groupByToMap, normalizeArrayToMap, omit } from '@sofie-automation/corelib/dist/lib'
import { AnyBulkWriteOperation } from 'mongodb'
import { diffAndReturnLatestObjects } from './model/implementation/utils'
import { ICollection } from '../db'

interface LocalIngestBase {
	modified: number
}
export interface LocalIngestRundown extends IngestRundown, LocalIngestBase {
	segments: LocalIngestSegment[]
}
export interface LocalIngestSegment extends IngestSegment, LocalIngestBase {
	parts: LocalIngestPart[]
}
export interface LocalIngestPart extends IngestPart, LocalIngestBase {}
export function isLocalIngestRundown(o: IngestRundown | LocalIngestRundown): o is LocalIngestRundown {
	return 'modified' in o
}
export function makeNewIngestRundown(ingestRundown: SetOptional<IngestRundown, 'segments'>): LocalIngestRundown {
	return {
		...ingestRundown,
		segments: ingestRundown.segments ? _.map(ingestRundown.segments, makeNewIngestSegment) : [],
		modified: getCurrentTime(),
	}
}
export function makeNewIngestSegment(ingestSegment: IngestSegment): LocalIngestSegment {
	return {
		...ingestSegment,
		parts: _.map(ingestSegment.parts, makeNewIngestPart),
		modified: getCurrentTime(),
	}
}
export function makeNewIngestPart(ingestPart: IngestPart): LocalIngestPart {
	return { ...ingestPart, modified: getCurrentTime() }
}

export class RundownIngestDataCache {
	readonly #changedDocumentIds = new Set<IngestDataCacheObjId>()

	private constructor(
		private readonly context: JobContext,
		private readonly collection: ICollection<IngestDataCacheObj>,
		private readonly rundownId: RundownId,
		private documents: IngestDataCacheObj[]
	) {}

	static async create(
		context: JobContext,
		collection: ICollection<IngestDataCacheObj>,
		rundownId: RundownId
	): Promise<RundownIngestDataCache> {
		const docs = await collection.findFetch({ rundownId })

		return new RundownIngestDataCache(context, collection, rundownId, docs)
	}

	isEmpty(): boolean {
		return this.documents.length === 0
	}

	fetchRundown(): LocalIngestRundown | undefined {
		const span = this.context.startSpan('ingest.ingestCache.loadCachedRundownData')

		const cachedRundown = this.documents.find(
			(e): e is IngestDataCacheObjRundown => e.type === IngestCacheType.RUNDOWN
		)
		if (!cachedRundown) {
			span?.end()
			return undefined
		}

		const ingestRundown: LocalIngestRundown = {
			...cachedRundown.data,
			modified: cachedRundown.modified,
			segments: [],
		}

		const hasSegmentId = (obj: IngestDataCacheObj): obj is IngestDataCacheObjSegment | IngestDataCacheObjPart => {
			return !!obj.segmentId
		}

		const segmentMap = groupByToMap(this.documents.filter(hasSegmentId), 'segmentId')
		for (const objs of segmentMap.values()) {
			const segmentEntry = objs.find((e): e is IngestDataCacheObjSegment => e.type === IngestCacheType.SEGMENT)
			if (segmentEntry) {
				const ingestSegment: LocalIngestSegment = {
					...segmentEntry.data,
					modified: segmentEntry.modified,
					parts: [],
				}

				for (const entry of objs) {
					if (entry.type === IngestCacheType.PART) {
						const ingestPart: LocalIngestPart = {
							...entry.data,
							modified: entry.modified,
						}

						ingestSegment.parts.push(ingestPart)
					}
				}

				ingestSegment.parts = _.sortBy(ingestSegment.parts, (s) => s.rank)
				ingestRundown.segments.push(ingestSegment)
			}
		}

		ingestRundown.segments = _.sortBy(ingestRundown.segments, (s) => s.rank)

		span?.end()
		return ingestRundown
	}

	update(ingestRundown: LocalIngestRundown): void {
		const generator = new RundownIngestDataCacheGenerator(this.rundownId)
		const cacheEntries: IngestDataCacheObj[] = generator.generateCacheForRundown(ingestRundown)

		this.documents = diffAndReturnLatestObjects(this.#changedDocumentIds, this.documents, cacheEntries)
	}

	delete(): void {
		// Mark each document for deletion
		for (const doc of this.documents) {
			this.#changedDocumentIds.add(doc._id)
		}

		this.documents = []
	}

	removeAllOtherDocuments(documentIdsToKeep: IngestDataCacheObjId[]): void {
		const documentIdsToKeepSet = new Set<IngestDataCacheObjId>(documentIdsToKeep)

		const newDocuments: IngestDataCacheObj[] = []
		for (const document of this.documents) {
			if (!documentIdsToKeepSet.has(document._id)) {
				this.#changedDocumentIds.add(document._id)
			} else {
				newDocuments.push(document)
			}
		}
		this.documents = newDocuments
	}

	replaceDocuments(changedCacheObjects: IngestDataCacheObj[]): void {
		const newDocumentsMap = normalizeArrayToMap(this.documents, '_id')

		for (const newDocument of changedCacheObjects) {
			this.#changedDocumentIds.add(newDocument._id)
			newDocumentsMap.set(newDocument._id, newDocument)
		}

		this.documents = Array.from(newDocumentsMap.values())
	}

	async saveToDatabase(): Promise<void> {
		if (this.#changedDocumentIds.size === 0) return

		const documentsMap = normalizeArrayToMap(this.documents, '_id')

		const updates: AnyBulkWriteOperation<IngestDataCacheObj>[] = []
		const removedIds: IngestDataCacheObjId[] = []
		for (const changedId of this.#changedDocumentIds) {
			const newDoc = documentsMap.get(changedId)
			if (!newDoc) {
				removedIds.push(changedId)
			} else {
				updates.push({
					replaceOne: {
						filter: {
							_id: changedId,
						},
						replacement: newDoc,
						upsert: true,
					},
				})
			}
		}

		if (removedIds.length) {
			updates.push({
				deleteMany: {
					filter: {
						_id: { $in: removedIds as any },
					},
				},
			})
		}

		await this.collection.bulkWrite(updates)
	}
}

export class RundownIngestDataCacheGenerator {
	constructor(public readonly rundownId: RundownId) {}

	getPartObjectId(partExternalId: string): IngestDataCacheObjId {
		return protectString<IngestDataCacheObjId>(`${this.rundownId}_part_${partExternalId}`)
	}
	getSegmentObjectId(segmentExternalId: string): IngestDataCacheObjId {
		return protectString<IngestDataCacheObjId>(`${this.rundownId}_segment_${segmentExternalId}`)
	}
	getRundownObjectId(): IngestDataCacheObjId {
		return protectString<IngestDataCacheObjId>(unprotectString(this.rundownId))
	}

	generatePartObject(
		segmentId: SegmentId,
		part: SetOptional<LocalIngestPart, 'modified'>,
		modified = 0
	): IngestDataCacheObjPart {
		return {
			_id: this.getPartObjectId(part.externalId),
			type: IngestCacheType.PART,
			rundownId: this.rundownId,
			segmentId: segmentId,
			partId: getPartId(this.rundownId, part.externalId),
			modified,
			data: omit(part, 'modified'),
		}
	}

	generateSegmentObject(
		ingestSegment: SetOptional<LocalIngestSegment, 'parts' | 'modified'>,
		modified = 0
	): IngestDataCacheObjSegment {
		return {
			_id: this.getSegmentObjectId(ingestSegment.externalId),
			type: IngestCacheType.SEGMENT,
			rundownId: this.rundownId,
			segmentId: getSegmentId(this.rundownId, ingestSegment.externalId),
			modified,
			data: {
				...omit(ingestSegment, 'modified'),
				parts: [], // omit the parts, they come as separate objects
			},
		}
	}

	generateRundownObject(
		ingestRundown: SetOptional<LocalIngestRundown, 'segments' | 'modified'>,
		modified = 0
	): IngestDataCacheObjRundown {
		return {
			_id: this.getRundownObjectId(),
			type: IngestCacheType.RUNDOWN,
			rundownId: this.rundownId,
			modified,
			data: {
				...omit(ingestRundown, 'modified'),
				segments: [], // omit the segments, they come as separate objects
			},
		}
	}

	generateCacheForRundown(ingestRundown: LocalIngestRundown): IngestDataCacheObj[] {
		const cacheEntries: IngestDataCacheObj[] = []

		const rundown = this.generateRundownObject(ingestRundown, ingestRundown.modified)
		cacheEntries.push(rundown)

		for (const segment of ingestRundown.segments) {
			cacheEntries.push(...this.generateCacheForSegment(segment))
		}

		return cacheEntries
	}

	private generateCacheForSegment(ingestSegment: LocalIngestSegment): IngestDataCacheObj[] {
		const cacheEntries: Array<IngestDataCacheObjSegment | IngestDataCacheObjPart> = []

		const segment = this.generateSegmentObject(ingestSegment, ingestSegment.modified)
		cacheEntries.push(segment)

		const segmentId = getSegmentId(this.rundownId, ingestSegment.externalId)
		for (const part of ingestSegment.parts) {
			cacheEntries.push(this.generatePartObject(segmentId, part, part.modified))
		}

		return cacheEntries
	}
}
