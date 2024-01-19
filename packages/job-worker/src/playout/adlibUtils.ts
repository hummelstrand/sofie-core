import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { PartInstanceId, PieceId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { assertNever, getRandomId, getRank } from '@sofie-automation/corelib/dist/lib'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { getCurrentTime } from '../lib'
import { JobContext } from '../jobs'
import { PlayoutModel } from './model/PlayoutModel'
import { PlayoutPartInstanceModel } from './model/PlayoutPartInstanceModel'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from './infinites'
import { convertAdLibToGenericPiece } from './pieces'
import { getResolvedPiecesForCurrentPartInstance } from './resolvedPieces'
import { updateTimeline } from './timeline/generate'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { updatePartInstanceRanksAfterAdlib } from '../rundown'
import { selectNextPart } from './selectNextPart'
import { setNextPart } from './setNext'
import { calculateNowOffsetLatency } from './timeline/multi-gateway'
import { logger } from '../logging'
import { ReadonlyDeep } from 'type-fest'
import { PlayoutRundownModel } from './model/PlayoutRundownModel'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { QuickLoopMarkerType } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

export async function innerStartOrQueueAdLibPiece(
	context: JobContext,
	playoutModel: PlayoutModel,
	rundown: PlayoutRundownModel,
	queue: boolean,
	currentPartInstance: PlayoutPartInstanceModel,
	adLibPiece: AdLibPiece | BucketAdLib
): Promise<PartInstanceId | undefined> {
	const span = context.startSpan('innerStartOrQueueAdLibPiece')
	let queuedPartInstanceId: PartInstanceId | undefined
	if (queue || adLibPiece.toBeQueued) {
		const adlibbedPart: Omit<DBPart, 'segmentId' | 'rundownId'> = {
			_id: getRandomId(),
			_rank: 99999, // Corrected in innerStartQueuedAdLib
			externalId: '',
			title: adLibPiece.name,
			expectedDuration: adLibPiece.expectedDuration,
			expectedDurationWithPreroll: adLibPiece.expectedDuration, // Filled in later
		}

		const genericAdlibPiece = convertAdLibToGenericPiece(adLibPiece, true)
		const newPartInstance = await insertQueuedPartWithPieces(
			context,
			playoutModel,
			rundown,
			currentPartInstance,
			adlibbedPart,
			[genericAdlibPiece],
			adLibPiece._id
		)
		queuedPartInstanceId = newPartInstance.partInstance._id

		// syncPlayheadInfinitesForNextPartInstance is handled by setNextPart
	} else {
		const genericAdlibPiece = convertAdLibToGenericPiece(adLibPiece, false)
		currentPartInstance.insertAdlibbedPiece(genericAdlibPiece, adLibPiece._id)

		await syncPlayheadInfinitesForNextPartInstance(
			context,
			playoutModel,
			currentPartInstance,
			playoutModel.nextPartInstance
		)
	}

	await updateTimeline(context, playoutModel)

	if (span) span.end()
	return queuedPartInstanceId
}

export async function innerFindLastPieceOnLayer(
	context: JobContext,
	playoutModel: PlayoutModel,
	sourceLayerId: string[],
	originalOnly: boolean,
	customQuery?: MongoQuery<PieceInstance>
): Promise<PieceInstance | undefined> {
	const span = context.startSpan('innerFindLastPieceOnLayer')
	const rundownIds = playoutModel.getRundownIds()

	const query: MongoQuery<PieceInstance> = {
		...customQuery,
		playlistActivationId: playoutModel.playlist.activationId,
		rundownId: { $in: rundownIds },
		'piece.sourceLayerId': { $in: sourceLayerId },
		plannedStartedPlayback: {
			$exists: true,
		},
	}

	if (originalOnly) {
		// Ignore adlibs if using original only
		query.dynamicallyInserted = {
			$exists: false,
		}
	}

	if (span) span.end()

	// Note: This does not want to use the in-memory model, as we want to search as far back as we can
	// TODO - will this cause problems?
	return context.directCollections.PieceInstances.findOne(query, {
		sort: {
			plannedStartedPlayback: -1,
		},
	})
}

export async function innerFindLastScriptedPieceOnLayer(
	context: JobContext,
	playoutModel: PlayoutModel,
	sourceLayerId: string[],
	customQuery?: MongoQuery<Piece>
): Promise<Piece | undefined> {
	const span = context.startSpan('innerFindLastScriptedPieceOnLayer')

	const playlist = playoutModel.playlist
	const rundownIds = playoutModel.getRundownIds()

	// TODO - this should throw instead of return more?

	if (!playlist.currentPartInfo || !playlist.activationId) {
		return
	}

	const currentPartInstance = playoutModel.currentPartInstance?.partInstance

	if (!currentPartInstance) {
		return
	}

	const query = {
		...customQuery,
		startRundownId: { $in: rundownIds },
		sourceLayerId: { $in: sourceLayerId },
	}

	const pieces: Array<Pick<Piece, '_id' | 'startPartId' | 'enable'>> =
		await context.directCollections.Pieces.findFetch(query, {
			projection: { _id: 1, startPartId: 1, enable: 1 },
		})

	const pieceIdSet = new Set(pieces.map((p) => p.startPartId))
	const part = playoutModel
		.getAllOrderedParts()
		.filter((p) => pieceIdSet.has(p._id) && p._rank <= currentPartInstance.part._rank)
		.reverse()[0]

	if (!part) {
		return
	}

	const partStarted = currentPartInstance.timings?.plannedStartedPlayback
	const nowInPart = partStarted ? getCurrentTime() - partStarted : 0

	const piecesSortedAsc = pieces
		.filter((p) => p.startPartId === part._id && (p.enable.start === 'now' || p.enable.start <= nowInPart))
		.sort((a, b) => {
			if (a.enable.start === 'now' && b.enable.start === 'now') return 0
			if (a.enable.start === 'now') return -1
			if (b.enable.start === 'now') return 1

			return b.enable.start - a.enable.start
		})

	const piece = piecesSortedAsc.shift()
	if (!piece) {
		return
	}

	const fullPiece = await context.directCollections.Pieces.findOne(piece._id)
	if (!fullPiece) return

	if (span) span.end()
	return fullPiece
}

function updateRankForAdlibbedPartInstance(
	context: JobContext,
	playoutModel: PlayoutModel,
	newPartInstance: PlayoutPartInstanceModel
) {
	const currentPartInstance = playoutModel.currentPartInstance
	if (!currentPartInstance) throw new Error('CurrentPartInstance not found')

	// Find the following part, so we can pick a good rank
	const followingPart = selectNextPart(
		context,
		playoutModel.playlist,
		currentPartInstance.partInstance,
		null,
		playoutModel.getAllOrderedSegments(),
		playoutModel.getAllOrderedParts(),
		false, // We want to insert it before any trailing invalid piece
		true // We want to insert it at the end of the loop
	)
	newPartInstance.setRank(
		getRank(
			currentPartInstance.partInstance.part,
			followingPart?.part?.segmentId === newPartInstance.partInstance.segmentId ? followingPart?.part : undefined
		)
	)

	updatePartInstanceRanksAfterAdlib(playoutModel, newPartInstance.partInstance.segmentId)
}

export async function insertQueuedPartWithPieces(
	context: JobContext,
	playoutModel: PlayoutModel,
	rundown: PlayoutRundownModel,
	currentPartInstance: PlayoutPartInstanceModel,
	newPart: Omit<DBPart, 'segmentId' | 'rundownId'>,
	initialPieces: Omit<PieceInstancePiece, 'startPartId'>[],
	fromAdlibId: PieceId | undefined
): Promise<PlayoutPartInstanceModel> {
	const span = context.startSpan('insertQueuedPartWithPieces')

	const newPartFull: DBPart = {
		...newPart,
		segmentId: currentPartInstance.partInstance.segmentId,
		rundownId: currentPartInstance.partInstance.rundownId,
	}

	// Find any rundown defined infinites that we should inherit
	const possiblePieces = await fetchPiecesThatMayBeActiveForPart(context, playoutModel, undefined, newPartFull)
	const infinitePieceInstances = getPieceInstancesForPart(
		context,
		playoutModel,
		currentPartInstance,
		rundown,
		newPartFull,
		possiblePieces,
		protectString('') // Replaced inside playoutModel.insertAdlibbedPartInstance
	)

	const newPartInstance = playoutModel.createAdlibbedPartInstance(
		newPart,
		initialPieces,
		fromAdlibId,
		infinitePieceInstances
	)

	updateRankForAdlibbedPartInstance(context, playoutModel, newPartInstance)

	await setNextPart(context, playoutModel, newPartInstance, false)

	handleQuickLoop(playoutModel, currentPartInstance, newPartInstance)

	if (span) span.end()

	return newPartInstance
}

function handleQuickLoop(
	playoutModel: PlayoutModel,
	currentPartInstance: PlayoutPartInstanceModel,
	newPartInstance: PlayoutPartInstanceModel
) {
	if (
		playoutModel.playlist.quickLoop?.end?.type === QuickLoopMarkerType.PART &&
		(currentPartInstance.partInstance.part._id === playoutModel.playlist.quickLoop?.end?.id ||
			currentPartInstance.partInstance.part._id === playoutModel.playlist.quickLoop?.end?.overridenId)
	) {
		playoutModel.setQuickLoopMarker('end', {
			type: QuickLoopMarkerType.PART,
			id: newPartInstance.partInstance.part._id,
			overridenId: playoutModel.playlist.quickLoop?.end?.overridenId ?? playoutModel.playlist.quickLoop?.end?.id,
		})
	}
}

export function innerStopPieces(
	context: JobContext,
	playoutModel: PlayoutModel,
	sourceLayers: SourceLayers,
	currentPartInstance: PlayoutPartInstanceModel,
	filter: (pieceInstance: ReadonlyDeep<PieceInstance>) => boolean,
	timeOffset: number | undefined
): Array<PieceInstanceId> {
	const span = context.startSpan('innerStopPieces')
	const stoppedInstances: PieceInstanceId[] = []

	const lastStartedPlayback = currentPartInstance.partInstance.timings?.plannedStartedPlayback
	if (lastStartedPlayback === undefined) {
		throw new Error('Cannot stop pieceInstances when partInstance hasnt started playback')
	}

	const resolvedPieces = getResolvedPiecesForCurrentPartInstance(context, sourceLayers, currentPartInstance)
	const offsetRelativeToNow = (timeOffset || 0) + (calculateNowOffsetLatency(context, playoutModel) || 0)
	const stopAt = getCurrentTime() + offsetRelativeToNow
	const relativeStopAt = stopAt - lastStartedPlayback

	for (const resolvedPieceInstance of resolvedPieces) {
		const pieceInstance = resolvedPieceInstance.instance
		if (
			!pieceInstance.userDuration &&
			!pieceInstance.piece.virtual &&
			filter(pieceInstance) &&
			resolvedPieceInstance.resolvedStart !== undefined &&
			resolvedPieceInstance.resolvedStart <= relativeStopAt &&
			!pieceInstance.plannedStoppedPlayback
		) {
			switch (pieceInstance.piece.lifespan) {
				case PieceLifespan.WithinPart:
				case PieceLifespan.OutOnSegmentChange:
				case PieceLifespan.OutOnRundownChange: {
					logger.info(`Blueprint action: Cropping PieceInstance "${pieceInstance._id}" to ${stopAt}`)

					const pieceInstanceModel = playoutModel.findPieceInstance(pieceInstance._id)
					if (pieceInstanceModel) {
						const newDuration: Required<PieceInstance>['userDuration'] = playoutModel.isMultiGatewayMode
							? {
									endRelativeToNow: offsetRelativeToNow,
							  }
							: {
									endRelativeToPart: relativeStopAt,
							  }

						pieceInstanceModel.pieceInstance.setDuration(newDuration)

						stoppedInstances.push(pieceInstance._id)
					} else {
						logger.warn(
							`Blueprint action: Failed to crop PieceInstance "${pieceInstance._id}", it was not found`
						)
					}

					break
				}
				case PieceLifespan.OutOnSegmentEnd:
				case PieceLifespan.OutOnRundownEnd:
				case PieceLifespan.OutOnShowStyleEnd: {
					logger.info(
						`Blueprint action: Cropping PieceInstance "${pieceInstance._id}" to ${stopAt} with a virtual`
					)

					currentPartInstance.insertVirtualPiece(
						relativeStopAt,
						pieceInstance.piece.lifespan,
						pieceInstance.piece.sourceLayerId,
						pieceInstance.piece.outputLayerId
					)

					stoppedInstances.push(pieceInstance._id)
					break
				}
				default:
					assertNever(pieceInstance.piece.lifespan)
			}
		}
	}

	if (span) span.end()
	return stoppedInstances
}
