import {
	PartInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { check } from 'meteor/check'
import {
	CustomPublishCollection,
	TriggerUpdate,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
} from '../../lib/customPublication'
import { logger } from '../../logging'
import { CustomCollectionName, MeteorPubSub } from '../../../lib/api/pubsub'
import { resolveCredentials } from '../../security/lib/credentials'
import { NoSecurityReadAccess } from '../../security/noSecurity'
import { ContentCache, PartInstanceOmitedFields, createReactiveContentCache } from './reactiveContentCache'
import { ReadonlyDeep } from 'type-fest'
import { LiveQueryHandle } from '../../lib/lib'
import { RundownPlaylists } from '../../collections'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { RundownsObserver } from '../lib/rundownsObserver'
import { RundownContentObserver } from './rundownContentObserver'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { Match } from '../../../lib/check'
import { RundownReadAccess } from '../../security/rundown'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	extractRanks,
	findMarkerPosition,
	modifyPartInstanceForQuickLoop,
	stringsToIndexLookup,
} from '../lib/quickLoop'

interface UIPartInstancesArgs {
	readonly playlistActivationId: RundownPlaylistActivationId
	readonly rundownIds: RundownId[]
}

export interface UIPartInstancesState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface UIPartInstancesUpdateProps {
	newCache: ContentCache

	invalidateSegmentIds: SegmentId[]
	invalidatePartInstanceIds: PartInstanceId[]

	invalidateQuickLoop: boolean
}

type RundownPlaylistFields = '_id' | 'studioId' | 'rundownIdsInOrder'
const rundownPlaylistFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBRundownPlaylist, RundownPlaylistFields>>
>({
	_id: 1,
	studioId: 1,
	rundownIdsInOrder: 1,
})

async function setupUIPartInstancesPublicationObservers(
	args: ReadonlyDeep<UIPartInstancesArgs>,
	triggerUpdate: TriggerUpdate<UIPartInstancesUpdateProps>
): Promise<LiveQueryHandle[]> {
	const playlist = (await RundownPlaylists.findOneAsync(
		{ activationId: args.playlistActivationId },
		{
			projection: rundownPlaylistFieldSpecifier,
		}
	)) as Pick<DBRundownPlaylist, RundownPlaylistFields> | undefined
	if (!playlist) throw new Error(`RundownPlaylist with activationId="${args.playlistActivationId}" not found!`)

	const rundownsObserver = new RundownsObserver(playlist.studioId, playlist._id, (rundownIds) => {
		logger.silly(`Creating new RundownContentObserver`)

		const cache = createReactiveContentCache()

		// Push update
		triggerUpdate({ newCache: cache })

		const obs1 = new RundownContentObserver(playlist.studioId, args.playlistActivationId, rundownIds, cache)

		const innerQueries = [
			cache.Segments.find({}).observeChanges({
				added: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
				changed: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
				removed: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
			}),
			cache.PartInstances.find({}).observe({
				added: (doc) => triggerUpdate({ invalidatePartInstanceIds: [doc._id] }),
				changed: (doc, oldDoc) => {
					if (doc.part._rank !== oldDoc.part._rank) {
						// with part rank change we need to invalidate the entire segment,
						// as the order may affect which unchanged parts are/aren't in quickLoop
						triggerUpdate({ invalidateSegmentIds: [doc.segmentId] })
					} else {
						triggerUpdate({ invalidatePartInstanceIds: [doc._id] })
					}
				},
				removed: (doc) => triggerUpdate({ invalidatePartInstanceIds: [doc._id] }),
			}),
			cache.RundownPlaylists.find({}).observeChanges({
				added: () => triggerUpdate({ invalidateQuickLoop: true }),
				changed: () => triggerUpdate({ invalidateQuickLoop: true }),
				removed: () => triggerUpdate({ invalidateQuickLoop: true }),
			}),
			cache.Studios.find({}).observeChanges({
				added: () => triggerUpdate({ invalidateQuickLoop: true }),
				changed: () => triggerUpdate({ invalidateQuickLoop: true }),
				removed: () => triggerUpdate({ invalidateQuickLoop: true }),
			}),
		]

		return () => {
			obs1.dispose()

			for (const query of innerQueries) {
				query.stop()
			}
		}
	})

	// Set up observers:
	return [rundownsObserver]
}

export async function manipulateUIPartInstancesPublicationData(
	_args: ReadonlyDeep<UIPartInstancesArgs>,
	state: Partial<UIPartInstancesState>,
	collection: CustomPublishCollection<DBPartInstance>,
	updateProps: Partial<ReadonlyDeep<UIPartInstancesUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	if (updateProps?.newCache !== undefined) {
		state.contentCache = updateProps.newCache ?? undefined
	}

	if (!state.contentCache) {
		// Remove all the partInstances
		collection.remove(null)

		return
	}

	const playlist = state.contentCache.RundownPlaylists.findOne({})
	if (!playlist) return

	const studio = state.contentCache.Studios.findOne({})
	if (!studio) return

	const rundownRanks = stringsToIndexLookup(playlist.rundownIdsInOrder as unknown as string[])
	const segmentRanks = extractRanks(state.contentCache.Segments.find({}).fetch())

	const quickLoopStartPosition =
		playlist.quickLoop?.start &&
		findMarkerPosition(
			playlist.quickLoop.start,
			-Infinity,
			state.contentCache.Segments,
			{ partInstances: state.contentCache.PartInstances },
			rundownRanks
		)
	const quickLoopEndPosition =
		playlist.quickLoop?.end &&
		findMarkerPosition(
			playlist.quickLoop.end,
			Infinity,
			state.contentCache.Segments,
			{ partInstances: state.contentCache.PartInstances },
			rundownRanks
		)

	updateProps?.invalidatePartInstanceIds?.forEach((partId) => {
		collection.remove(partId) // if it still exists, it will be replaced in the next step
	})

	const invalidatedSegmentsSet = new Set(updateProps?.invalidateSegmentIds ?? [])
	const invalidatedPartInstancesSet = new Set(updateProps?.invalidatePartInstanceIds ?? [])

	state.contentCache.PartInstances.find({}).forEach((partInstance) => {
		if (
			updateProps?.invalidateQuickLoop ||
			invalidatedSegmentsSet.has(partInstance.segmentId) ||
			invalidatedPartInstancesSet.has(partInstance._id)
		) {
			modifyPartInstanceForQuickLoop(
				partInstance,
				segmentRanks,
				rundownRanks,
				playlist,
				studio,
				quickLoopStartPosition,
				quickLoopEndPosition
			)
			collection.replace(partInstance)
		}
	})
}

meteorCustomPublish(
	MeteorPubSub.uiPartInstances,
	CustomCollectionName.UIPartInstances,
	async function (pub, rundownIds: RundownId[], playlistActivationId: RundownPlaylistActivationId | null) {
		check(rundownIds, [String])
		check(playlistActivationId, Match.Maybe(String))

		const credentials = await resolveCredentials({ userId: this.userId, token: undefined })

		if (
			playlistActivationId &&
			(!credentials ||
				NoSecurityReadAccess.any() ||
				(await RundownReadAccess.rundownContent({ $in: rundownIds }, credentials)))
		) {
			await setUpCollectionOptimizedObserver<
				Omit<DBPartInstance, PartInstanceOmitedFields>,
				UIPartInstancesArgs,
				UIPartInstancesState,
				UIPartInstancesUpdateProps
			>(
				`pub_${MeteorPubSub.uiPartInstances}_${rundownIds.join(',')}_${playlistActivationId}`,
				{ rundownIds, playlistActivationId },
				setupUIPartInstancesPublicationObservers,
				manipulateUIPartInstancesPublicationData,
				pub
			)
		} else {
			logger.warn(`Pub.uiPartInstances: Not allowed: [${rundownIds.join(',')}] "${playlistActivationId}"`)
		}
	}
)
