import { ResolvedPieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	ABSessionAssignment,
	ABSessionAssignments,
	DBRundownPlaylist,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { endTrace, sendTrace, startTrace } from '@sofie-automation/corelib/dist/influxdb'
import { WrappedShowStyleBlueprint } from '../../blueprints/cache'
import { ReadonlyDeep } from 'type-fest'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs'
import { getCurrentTime } from '../../lib'
import { resolveAbAssignmentsFromRequests } from './abPlaybackResolver'
import { calculateSessionTimeRanges } from './abPlaybackSessions'
import { applyAbPlayerObjectAssignments } from './applyAssignments'
import { AbSessionHelper } from './abSessionHelper'
import { ShowStyleContext } from '../../blueprints/context'
import { logger } from '../../logging'
import { ABPlayerDefinition } from '@sofie-automation/blueprints-integration'
import { PlayoutModel } from '../model/PlayoutModel'

/**
 * Resolve and apply AB-playback for the given timeline
 * @param context Context of the job
 * @param abSessionHelper Helper for generation sessionId
 * @param blueprint Blueprint of the currently playing ShowStyle
 * @param showStyle The currently playing ShowStyle
 * @param playoutModel The current playout model
 * @param resolvedPieces All the PieceInstances on the timeline, resolved to have 'accurate' playback timings
 * @param timelineObjects The current timeline
 * @returns New AB assignments to be persisted on the playlist for the next call
 */
export async function applyAbPlaybackForTimeline(
	context: JobContext,
	abSessionHelper: AbSessionHelper,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
	playoutModel: PlayoutModel,
	resolvedPieces: ResolvedPieceInstance[],
	timelineObjects: OnGenerateTimelineObjExt[]
): Promise<Record<string, ABSessionAssignments>> {
	if (!blueprint.blueprint.getAbResolverConfiguration) return {}
	const playlist = playoutModel.playlist as DBRundownPlaylist

	const blueprintContext = new ShowStyleContext(
		{
			name: playlist.name,
			identifier: `playlistId=${playlist._id},previousPartInstance=${playlist.previousPartInfo?.partInstanceId},currentPartInstance=${playlist.currentPartInfo?.partInstanceId},nextPartInstance=${playlist.nextPartInfo?.partInstanceId}`,
		},
		context.studio,
		context.getStudioBlueprintConfig(),
		showStyle,
		context.getShowStyleBlueprintConfig(showStyle)
	)

	const previousAbSessionAssignments: Record<string, ABSessionAssignments> = playlist.assignedAbSessions || {}
	const newAbSessionsResult: Record<string, ABSessionAssignments> = {}

	const span = context.startSpan('blueprint.abPlaybackResolver')
	const influxTrace = startTrace('blueprints:abPlaybackResolver')

	const now = getCurrentTime()

	const abConfiguration = blueprint.blueprint.getAbResolverConfiguration(blueprintContext)

	for (const [poolName, players] of Object.entries<ABPlayerDefinition[]>(abConfiguration.pools)) {
		// Filter out offline devices
		const filteredPlayers = abPoolFilterDisabled(context, poolName, players)

		const assingmentsToPlayer: Record<string, number> = {}
		// If a player has been disabled in the pool, clear the old assignments
		Object.values<ABSessionAssignment | undefined>(previousAbSessionAssignments[poolName]).forEach((assignment) => {
			if (assignment) {
				assingmentsToPlayer[assignment.playerId] = (assingmentsToPlayer[assignment.playerId] || 0) + 1
			}
			if (!filteredPlayers.find((player) => player.playerId === assignment?.playerId)) {
				previousAbSessionAssignments[poolName] = {}
			}
		})
		// If a player are free and multiple sessions are assigned to one player, clear the old assignments:
		Object.values<number>(assingmentsToPlayer).forEach((numberOfAssingments) => {
			if (numberOfAssingments > 1 && players.length >= numberOfAssingments) {
				previousAbSessionAssignments[poolName] = {}
			}
		})

		const previousAssignmentMap: ABSessionAssignments = previousAbSessionAssignments[poolName] || {}
		const sessionRequests = calculateSessionTimeRanges(
			abSessionHelper,
			resolvedPieces,
			timelineObjects,
			previousAssignmentMap,
			poolName
		)

		const assignments = resolveAbAssignmentsFromRequests(
			abConfiguration.resolverOptions,
			filteredPlayers.map((player) => player.playerId),
			sessionRequests,
			now
		)

		logger.silly(`ABPlayback resolved sessions for "${poolName}": ${JSON.stringify(assignments)}`)
		if (assignments.failedRequired.length > 0) {
			logger.warn(
				`ABPlayback failed to assign sessions for "${poolName}": ${JSON.stringify(assignments.failedRequired)}`
			)
		}
		if (assignments.failedOptional.length > 0) {
			logger.info(
				`ABPlayback failed to assign optional sessions for "${poolName}": ${JSON.stringify(
					assignments.failedOptional
				)}`
			)
		}

		newAbSessionsResult[poolName] = applyAbPlayerObjectAssignments(
			abSessionHelper,
			blueprintContext,
			abConfiguration,
			timelineObjects,
			previousAssignmentMap,
			assignments.requests,
			poolName
		)
	}

	sendTrace(endTrace(influxTrace))
	if (span) span.end()

	return newAbSessionsResult
}

function abPoolFilterDisabled(
	context: JobContext,
	poolName: string,
	players: ABPlayerDefinition[]
): ABPlayerDefinition[] {
	const poolDisabling = context.studio.abPoolsDisabling[poolName]
	return players.filter((player) => {
		if (poolDisabling) {
			const disabled = poolDisabling.players[player.playerId].disabled
			if (disabled) {
				logger.info(`${context.studio._id} - AB Pool ${poolName} playerId : ${player.playerId} are disabled`)
				return false
			}
		}
		return true
	})
}
