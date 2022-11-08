import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import {
	PartId,
	PartInstanceId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { UISegmentPartNote } from '../../lib/api/rundownNotifications'
import { DBPartInstance, PartInstances } from '../../lib/collections/PartInstances'
import { DBPart, Parts } from '../../lib/collections/Parts'
import { Rundown, Rundowns } from '../../lib/collections/Rundowns'
import { DBSegment, Segment, SegmentOrphanedReason, Segments } from '../../lib/collections/Segments'
import { generateTranslation, groupByToMap, literal, protectString } from '../../lib/lib'
import { MongoQuery } from '../../lib/typings/meteor'
import {
	CustomPublishCollection,
	meteorCustomPublish,
	ReactiveMongoObserverGroup,
	setUpCollectionOptimizedObserver,
	TriggerUpdate,
} from '../lib/customPublication'
import { logger } from '../logging'
import { resolveCredentials } from '../security/lib/credentials'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { RundownPlaylistReadAccess } from '../security/rundownPlaylist'

interface UISegmentPartNotesArgs {
	readonly playlistId: RundownPlaylistId
}

interface UISegmentPartNotesState {
	rundownToNRCSName: Map<RundownId, string>
	segmentCache: Map<SegmentId, Pick<DBSegment, SegmentFields>>
	partsCache: Map<PartId, Pick<DBPart, PartFields>>
	deletePartInstancesCache: Map<PartInstanceId, Pick<DBPartInstance, PartInstanceFields>>
}

interface UISegmentPartNotesUpdateProps {
	invalidateRundownIds: RundownId[]
	invalidateSegmentIds: SegmentId[]
	invalidatePartIds: PartId[]
	invalidatePartInstanceIds: PartInstanceId[]
}

type RundownFields = '_id' | 'playlistId' | 'externalNRCSName'
const rundownFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<RundownFields>>({
	_id: 1,
	playlistId: 1,
	externalNRCSName: 1,
})

type SegmentFields = '_id' | '_rank' | 'rundownId' | 'name' | 'notes' | 'orphaned'
const segmentFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<SegmentFields>>({
	_id: 1,
	_rank: 1,
	rundownId: 1,
	name: 1,
	notes: 1,
	orphaned: 1,
})

type PartFields = '_id' | '_rank' | 'segmentId' | 'rundownId' | 'notes' | 'title' | 'invalid' | 'invalidReason'
const partFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<PartFields>>({
	_id: 1,
	_rank: 1,
	segmentId: 1,
	rundownId: 1,
	notes: 1,
	title: 1,
	invalid: 1,
	invalidReason: 1,
})

type PartInstanceFields = '_id' | 'segmentId' | 'rundownId' | 'orphaned' | 'reset' | 'part'
const partInstanceFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<PartInstanceFields>>({
	_id: 1,
	segmentId: 1,
	rundownId: 1,
	orphaned: 1,
	reset: 1,
	// @ts-expect-error Deep not supported
	'part.title': 1,
})

async function setupUISegmentPartNotesPublicationObservers(
	args: ReadonlyDeep<UISegmentPartNotesArgs>,
	triggerUpdate: TriggerUpdate<UISegmentPartNotesUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	const trackRundownChange = (id: RundownId): Partial<UISegmentPartNotesUpdateProps> => ({
		invalidateRundownIds: [id],
	})
	const trackSegmentChange = (id: SegmentId): Partial<UISegmentPartNotesUpdateProps> => ({
		invalidateSegmentIds: [id],
	})
	const trackPartChange = (id: PartId): Partial<UISegmentPartNotesUpdateProps> => ({
		invalidatePartIds: [id],
	})
	const trackPartInstanceChange = (id: PartInstanceId): Partial<UISegmentPartNotesUpdateProps> => ({
		invalidatePartInstanceIds: [id],
	})

	// Second level of reactivity
	const rundownContentsObserver = ReactiveMongoObserverGroup(async () => {
		const rundownIds = (
			await Rundowns.findFetchAsync({ playlistId: args.playlistId }, { projection: { _id: 1 } })
		).map((rd) => rd._id)

		return [
			Segments.find({ rundownId: { $in: rundownIds } }, { fields: segmentFieldSpecifier }).observeChanges({
				added: (id) => triggerUpdate(trackSegmentChange(id)),
				changed: (id) => triggerUpdate(trackSegmentChange(id)),
				removed: (id) => triggerUpdate(trackSegmentChange(id)),
			}),
			Parts.find({ rundownId: { $in: rundownIds } }, { fields: partFieldSpecifier }).observeChanges({
				added: (id) => triggerUpdate(trackPartChange(id)),
				changed: (id) => triggerUpdate(trackPartChange(id)),
				removed: (id) => triggerUpdate(trackPartChange(id)),
			}),
			PartInstances.find(
				{ rundownId: { $in: rundownIds }, reset: { $ne: true }, orphaned: 'deleted' },
				{ fields: partInstanceFieldSpecifier }
			).observeChanges({
				added: (id) => triggerUpdate(trackPartInstanceChange(id)),
				changed: (id) => triggerUpdate(trackPartInstanceChange(id)),
				removed: (id) => triggerUpdate(trackPartInstanceChange(id)),
			}),
		]
	})

	// Set up observers:
	return [
		Rundowns.find({ playlistId: args.playlistId }, { fields: rundownFieldSpecifier }).observeChanges({
			added: (id) => {
				rundownContentsObserver.restart()
				triggerUpdate(trackRundownChange(id))
			},
			changed: (id) => {
				// We don't need to invalidate the observer, as we get added/removed when a document matches/unmatches out query
				triggerUpdate(trackRundownChange(id))
			},
			removed: (id) => {
				rundownContentsObserver.restart()
				triggerUpdate(trackRundownChange(id))
			},
		}),

		rundownContentsObserver,
	]
}

async function manipulateUISegmentPartNotesPublicationData(
	args: UISegmentPartNotesArgs,
	state: Partial<UISegmentPartNotesState>,
	collection: CustomPublishCollection<UISegmentPartNote>,
	updateProps: Partial<ReadonlyDeep<UISegmentPartNotesUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	// Ensure the rundownToNRCSName map exists and is updated with any changes
	state.rundownToNRCSName = await updateRundownToNRCSNameMap(
		args,
		state.rundownToNRCSName,
		updateProps?.invalidateRundownIds
	)

	// Determine which RundownIds have changed, and need to be completely regenerated
	const allRundownIds = Array.from(state.rundownToNRCSName.keys())
	const changedRundownIds = updateProps?.invalidateRundownIds ?? allRundownIds

	// Load any segments that have changed
	const [newSegmentsCache, updatedSegmentIds, invalidatedSegmentIds] = await updateSegmentsCache(
		state.segmentCache,
		allRundownIds,
		changedRundownIds as RundownId[],
		updateProps?.invalidateSegmentIds
	)
	state.segmentCache = newSegmentsCache

	// Load any parts that have changed
	const [newPartsCache, segmentIdsWithPartChanges] = await updatePartsCache(
		state.partsCache,
		allRundownIds,
		invalidatedSegmentIds,
		updateProps?.invalidatePartIds
	)
	state.partsCache = newPartsCache

	// Load any partInstances that have changed
	const [newPartInstancesCache, segmentIdsWithPartInstanceChanges] = await updatePartInstancesCache(
		state.deletePartInstancesCache,
		allRundownIds,
		invalidatedSegmentIds,
		updateProps?.invalidatePartInstanceIds
	)
	state.deletePartInstancesCache = newPartInstancesCache

	// We know that `collection` does diffing when 'commiting' all of the changes we have made
	// meaning that for anything we will call `replace()` on, we can `remove()` it first for no extra cost

	const updateAll = !updateProps
	if (updateAll) {
		// Remove all the notes
		collection.remove(null)

		const updateData = compileUpdateNotesData(
			state.rundownToNRCSName,
			state.partsCache,
			state.deletePartInstancesCache
		)

		for (const segment of state.segmentCache.values()) {
			updateNotesForSegment(args, updateData, collection, segment)
		}
	} else {
		const regenerateForSegmentIds = new Set([
			...updatedSegmentIds,
			...invalidatedSegmentIds,
			...segmentIdsWithPartChanges,
			...segmentIdsWithPartInstanceChanges,
		])

		// Remove ones from segments being regenerated
		collection.remove((doc) => regenerateForSegmentIds.has(doc.segmentId))

		// Generate notes for each segment
		for (const segmentId of regenerateForSegmentIds) {
			const segment = state.segmentCache.get(segmentId)

			const updateData = compileUpdateNotesData(
				state.rundownToNRCSName,
				state.partsCache,
				state.deletePartInstancesCache
			)

			if (segment) {
				updateNotesForSegment(args, updateData, collection, segment)
			} else {
				// Notes have already been removed
			}
		}
	}
}

interface UpdateNotesData {
	rundownToNRCSName: Map<RundownId, string>
	parts: Map<SegmentId, Pick<DBPart, PartFields>[]>
	deletedPartInstances: Map<SegmentId, Pick<DBPartInstance, PartInstanceFields>[]>
}
function compileUpdateNotesData(
	rundownToNRCSName: Map<RundownId, string>,
	partsCache: Map<PartId, Pick<DBPart, PartFields>>,
	deletePartInstancesCache: Map<PartInstanceId, Pick<DBPartInstance, PartInstanceFields>>
): UpdateNotesData {
	return {
		rundownToNRCSName,
		parts: groupByToMap(partsCache.values(), 'segmentId'),
		deletedPartInstances: groupByToMap(deletePartInstancesCache.values(), 'segmentId'),
	}
}

function updateNotesForSegment(
	args: UISegmentPartNotesArgs,
	state: UpdateNotesData,
	collection: CustomPublishCollection<UISegmentPartNote>,
	segment: Pick<DBSegment, SegmentFields>
) {
	const notesForSegment = getBasicNotesForSegment(
		args.playlistId,
		segment,
		state.rundownToNRCSName.get(segment.rundownId) ?? 'NRCS',
		state.parts.get(segment._id) ?? [],
		state.deletedPartInstances.get(segment._id) ?? []
	)

	// Insert generated notes
	for (const note of notesForSegment) {
		collection.replace(note)
	}
}

function getBasicNotesForSegment(
	playlistId: RundownPlaylistId,
	segment: Pick<Segment, SegmentFields>,
	nrcsName: string,
	parts: Pick<DBPart, PartFields>[],
	partInstances: Pick<DBPartInstance, PartInstanceFields>[]
): Array<UISegmentPartNote> {
	const notes: Array<UISegmentPartNote> = []

	if (segment.notes) {
		notes.push(
			...segment.notes.map((note, i) =>
				literal<UISegmentPartNote>({
					_id: protectString(`${segment._id}_segment_${i}`),
					playlistId,
					rundownId: segment.rundownId,
					segmentId: segment._id,
					note: {
						rank: segment._rank,
						...note,
						origin: {
							...note.origin,
							segmentId: segment._id,
							rundownId: segment.rundownId,
							name: note.origin.name || segment.name,
						},
					},
				})
			)
		)
	}

	if (segment.orphaned) {
		let message: ITranslatableMessage
		switch (segment.orphaned) {
			case SegmentOrphanedReason.DELETED:
				message = generateTranslation('Segment no longer exists in {{nrcs}}', {
					nrcs: nrcsName,
				})
				break
			case SegmentOrphanedReason.HIDDEN:
				message = generateTranslation('Segment was hidden in {{nrcs}}', {
					nrcs: nrcsName,
				})
				break
		}
		notes.push({
			_id: protectString(`${segment._id}_segment_orphaned`),
			playlistId,
			rundownId: segment.rundownId,
			segmentId: segment._id,
			note: {
				type: NoteSeverity.WARNING,
				message,
				rank: segment._rank,
				origin: {
					segmentId: segment._id,
					rundownId: segment.rundownId,
					name: segment.name,
				},
			},
		})
	} else {
		const deletedPartInstances = partInstances.filter((p) => p.orphaned === 'deleted' && !p.reset)
		if (deletedPartInstances.length > 0) {
			notes.push({
				_id: protectString(`${segment._id}_partinstances_deleted`),
				playlistId,
				rundownId: segment.rundownId,
				segmentId: segment._id,
				note: {
					type: NoteSeverity.WARNING,
					message: generateTranslation('The following parts no longer exist in {{nrcs}}: {{partNames}}', {
						nrcs: nrcsName,
						partNames: deletedPartInstances.map((p) => p.part.title).join(', '),
					}),
					rank: segment._rank,
					origin: {
						segmentId: segment._id,
						rundownId: segment.rundownId,
						name: segment.name,
					},
				},
			})
		}
	}

	for (const part of parts) {
		const commonOrigin = {
			segmentId: part.segmentId,
			partId: part._id,
			rundownId: part.rundownId,
			segmentName: segment.name,
		}

		if (part.invalidReason) {
			notes.push({
				_id: protectString(`${segment._id}_part_${part._id}_invalid`),
				playlistId,
				rundownId: segment.rundownId,
				segmentId: segment._id,
				note: {
					type: part.invalidReason.severity ?? NoteSeverity.ERROR,
					message: part.invalidReason.message,
					rank: segment._rank,
					origin: {
						...commonOrigin,
						name: part.title,
					},
				},
			})
		}

		if (part.notes && part.notes.length > 0) {
			notes.push(
				...part.notes.map((n, i) =>
					literal<UISegmentPartNote>({
						_id: protectString(`${segment._id}_part_${part._id}_${i}`),
						playlistId,
						rundownId: segment.rundownId,
						segmentId: segment._id,
						note: {
							...n,
							rank: segment._rank,
							origin: {
								...n.origin,
								...commonOrigin,
								name: n.origin.name || part.title,
							},
						},
					})
				)
			)
		}
	}

	return notes
}

async function updateRundownToNRCSNameMap(
	args: UISegmentPartNotesArgs,
	existingMap: UISegmentPartNotesState['rundownToNRCSName'] | undefined,
	changedIds: ReadonlyDeep<RundownId[]> | undefined
): Promise<UISegmentPartNotesState['rundownToNRCSName']> {
	if (!existingMap) {
		// Ensure the rundownToNRCSName map exists

		const rundowns = (await Rundowns.findFetchAsync(
			{ playlistId: args.playlistId },
			{ projection: rundownFieldSpecifier }
		)) as Pick<Rundown, RundownFields>[]

		const newMap: UISegmentPartNotesState['rundownToNRCSName'] = new Map()
		for (const rundown of rundowns) {
			newMap.set(rundown._id, rundown.externalNRCSName)
		}

		return newMap
	}

	if (changedIds && changedIds.length > 0) {
		// Remove them from the state, so that we detect deletions
		for (const id of changedIds) {
			existingMap.delete(id)
		}
		const docs = (await Rundowns.findFetchAsync(
			{ _id: { $in: changedIds as RundownId[] }, playlistId: args.playlistId },
			{ projection: rundownFieldSpecifier }
		)) as Pick<Rundown, RundownFields>[]
		for (const doc of docs) {
			existingMap.set(doc._id, doc.externalNRCSName)
		}
	}

	return existingMap
}

async function updateSegmentsCache(
	existingMap: UISegmentPartNotesState['segmentCache'] | undefined,
	allRundownIds: RundownId[],
	changedRundownIds: RundownId[],
	changedSegmentIds: ReadonlyDeep<SegmentId[]> | undefined
): Promise<[newMap: UISegmentPartNotesState['segmentCache'], changedIds: SegmentId[], invalidatedIds: SegmentId[]]> {
	// Create a fresh map
	if (!existingMap) {
		const segments = (await Segments.findFetchAsync(
			{ rundownId: { $in: allRundownIds } },
			{ projection: segmentFieldSpecifier }
		)) as Pick<DBSegment, SegmentFields>[]

		const newMap: UISegmentPartNotesState['segmentCache'] = new Map()
		for (const segment of segments) {
			newMap.set(segment._id, segment)
		}

		const allIds = segments.map((s) => s._id)
		return [newMap, allIds, allIds]
	}

	// Segments that have simply changed
	const updatedSegmentIds = new Set<SegmentId>()
	// Segments that were added or removed, and need dependents to be reloaded
	const invalidatedSegmentIds = new Set<SegmentId>()

	const updateSegmentsForQuery = async (query: MongoQuery<DBSegment>) => {
		const fetchedSegmentIds = new Set<SegmentId>()
		const segments = (await Segments.findFetchAsync(query, { projection: segmentFieldSpecifier })) as Pick<
			DBSegment,
			SegmentFields
		>[]
		for (const segment of segments) {
			if (existingMap.has(segment._id)) {
				updatedSegmentIds.add(segment._id)
			} else {
				invalidatedSegmentIds.add(segment._id)
			}

			existingMap.set(segment._id, segment)
			fetchedSegmentIds.add(segment._id)
		}

		return fetchedSegmentIds
	}

	// Reload Segments for any Rundowns that have changed
	if (changedRundownIds.length > 0) {
		const fetchedSegmentIds = await updateSegmentsForQuery({
			$and: [{ rundownId: { $in: changedRundownIds } }, { rundownId: { $in: allRundownIds } }],
		})

		// Check for deletions
		const changedRundownIdsSet = new Set(changedRundownIds)
		for (const [id, segment] of existingMap.entries()) {
			if (changedRundownIdsSet.has(segment.rundownId) && !fetchedSegmentIds.has(segment._id)) {
				invalidatedSegmentIds.add(id)
				existingMap.delete(id)
			}
		}
	}

	// Reload any Segments that have changed
	if (changedSegmentIds && changedSegmentIds.length > 0) {
		const fetchedSegmentIds = await updateSegmentsForQuery({
			_id: { $in: changedSegmentIds as SegmentId[] },
			rundownId: { $in: allRundownIds },
		})

		// Remove them from the cache, so that we detect deletions
		for (const id of changedSegmentIds) {
			if (!fetchedSegmentIds.has(id)) {
				// It may have changed
				invalidatedSegmentIds.add(id)
				existingMap.delete(id)
			}
		}
	}

	return [existingMap, Array.from(updatedSegmentIds), Array.from(invalidatedSegmentIds)]
}

async function updatePartsCache(
	existingMap: UISegmentPartNotesState['partsCache'] | undefined,
	allRundownIds: RundownId[],
	invalidatedSegmentIds: SegmentId[],
	changedPartIds: ReadonlyDeep<PartId[]> | undefined
): Promise<[newMap: UISegmentPartNotesState['partsCache'], affectedSegmentIds: SegmentId[]]> {
	// Create a fresh map
	if (!existingMap) {
		const parts = (await Parts.findFetchAsync(
			{ rundownId: { $in: allRundownIds } },
			{ projection: partFieldSpecifier }
		)) as Pick<DBPart, PartFields>[]

		const newMap: UISegmentPartNotesState['partsCache'] = new Map()
		const affectedSegmentIds = new Set<SegmentId>()
		for (const part of parts) {
			newMap.set(part._id, part)
			affectedSegmentIds.add(part.segmentId)
		}

		return [newMap, Array.from(affectedSegmentIds)]
	}

	// Segments that have been affected by any document changes/updates
	const affectedSegmentIds = new Set<SegmentId>()

	// Reload Parts for any Rundowns that have been invalidated
	if (invalidatedSegmentIds.length > 0) {
		// We don't need to track these in affectedSegmentIds, as that is implied

		// Remove them from the cache, so that we detect deletions
		const changedSegmentIdsSet = new Set(invalidatedSegmentIds)
		for (const [id, part] of existingMap.entries()) {
			if (changedSegmentIdsSet.has(part.segmentId)) {
				existingMap.delete(id)
			}
		}

		const parts = (await Parts.findFetchAsync(
			{ segmentId: { $in: invalidatedSegmentIds }, rundownId: { $in: allRundownIds } },
			{ projection: partFieldSpecifier }
		)) as Pick<DBPart, PartFields>[]
		for (const part of parts) {
			existingMap.set(part._id, part)
		}
	}

	// Reload any Segments that have changed
	if (changedPartIds && changedPartIds.length > 0) {
		const fetchedPartIds = new Set<PartId>()

		const parts = (await Parts.findFetchAsync(
			{ _id: { $in: changedPartIds as PartId[] }, rundownId: { $in: allRundownIds } },
			{ projection: partFieldSpecifier }
		)) as Pick<DBPart, PartFields>[]
		for (const part of parts) {
			// Part could have moved across segments
			const existing = existingMap.get(part._id)
			if (existing) {
				affectedSegmentIds.add(existing.segmentId)
			}

			affectedSegmentIds.add(part.segmentId)
			existingMap.set(part._id, part)
			fetchedPartIds.add(part._id)
		}

		// Remove them from the cache, so that we detect deletions
		for (const id of changedPartIds) {
			if (!fetchedPartIds.has(id)) {
				const existing = existingMap.get(id)
				if (existing) {
					affectedSegmentIds.add(existing.segmentId)
					existingMap.delete(id)
				}
			}
		}
	}

	return [existingMap, Array.from(affectedSegmentIds)]
}

async function updatePartInstancesCache(
	existingMap: UISegmentPartNotesState['deletePartInstancesCache'] | undefined,
	allRundownIds: RundownId[],
	invalidatedSegmentIds: SegmentId[],
	changedPartInstanceIds: ReadonlyDeep<PartInstanceId[]> | undefined
): Promise<[newMap: UISegmentPartNotesState['deletePartInstancesCache'], affectedSegmentIds: SegmentId[]]> {
	// Create a fresh map
	if (!existingMap) {
		const partInstances = (await PartInstances.findFetchAsync(
			{ rundownId: { $in: allRundownIds } },
			{ projection: partInstanceFieldSpecifier }
		)) as Pick<DBPartInstance, PartInstanceFields>[]

		const newMap: UISegmentPartNotesState['deletePartInstancesCache'] = new Map()
		const affectedSegmentIds = new Set<SegmentId>()
		for (const part of partInstances) {
			newMap.set(part._id, part)
			affectedSegmentIds.add(part.segmentId)
		}

		return [newMap, Array.from(affectedSegmentIds)]
	}

	// Segments that have been affected by any document changes/updates
	const affectedSegmentIds = new Set<SegmentId>()

	// Reload Parts for any Rundowns that have been invalidated
	if (invalidatedSegmentIds.length > 0) {
		// We don't need to track these in affectedSegmentIds, as that is implied

		// Remove them from the cache, so that we detect deletions
		const changedSegmentIdsSet = new Set(invalidatedSegmentIds)
		for (const [id, part] of existingMap.entries()) {
			if (changedSegmentIdsSet.has(part.segmentId)) {
				existingMap.delete(id)
			}
		}

		const partInstances = (await PartInstances.findFetchAsync(
			{ segmentId: { $in: invalidatedSegmentIds }, rundownId: { $in: allRundownIds } },
			{ projection: partInstanceFieldSpecifier }
		)) as Pick<DBPartInstance, PartInstanceFields>[]
		for (const part of partInstances) {
			existingMap.set(part._id, part)
		}
	}

	// Reload any Segments that have changed
	if (changedPartInstanceIds && changedPartInstanceIds.length > 0) {
		const fetchedPartInstanceIds = new Set<PartInstanceId>()

		const partInstances = (await PartInstances.findFetchAsync(
			{ _id: { $in: changedPartInstanceIds as PartInstanceId[] }, rundownId: { $in: allRundownIds } },
			{ projection: partInstanceFieldSpecifier }
		)) as Pick<DBPartInstance, PartInstanceFields>[]
		for (const part of partInstances) {
			// Part could have moved across segments
			const existing = existingMap.get(part._id)
			if (existing) {
				affectedSegmentIds.add(existing.segmentId)
			}

			affectedSegmentIds.add(part.segmentId)
			existingMap.set(part._id, part)
			fetchedPartInstanceIds.add(part._id)
		}

		// Remove them from the cache, so that we detect deletions
		for (const id of changedPartInstanceIds) {
			if (!fetchedPartInstanceIds.has(id)) {
				const existing = existingMap.get(id)
				if (existing) {
					affectedSegmentIds.add(existing.segmentId)
					existingMap.delete(id)
				}
			}
		}
	}

	return [existingMap, Array.from(affectedSegmentIds)]
}

meteorCustomPublish(
	PubSub.uiSegmentPartNotes,
	CustomCollectionName.UISegmentPartNotes,
	async function (pub, playlistId: RundownPlaylistId | null) {
		const cred = await resolveCredentials({ userId: this.userId, token: undefined })

		if (
			playlistId &&
			(!cred ||
				NoSecurityReadAccess.any() ||
				(await RundownPlaylistReadAccess.rundownPlaylistContent(playlistId, cred)))
		) {
			await setUpCollectionOptimizedObserver<
				UISegmentPartNote,
				UISegmentPartNotesArgs,
				UISegmentPartNotesState,
				UISegmentPartNotesUpdateProps
			>(
				`pub_${PubSub.uiSegmentPartNotes}_${playlistId}`,
				{ playlistId },
				setupUISegmentPartNotesPublicationObservers,
				manipulateUISegmentPartNotesPublicationData,
				pub
			)
		} else {
			logger.warn(`Pub.${CustomCollectionName.UISegmentPartNotes}: Not allowed: "${playlistId}"`)
		}
	}
)
