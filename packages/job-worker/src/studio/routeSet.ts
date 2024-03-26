import { SwitchRouteSetProps } from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs'
import { runJobWithStudioPlayoutModel } from './lock'
import { StudioRouteBehavior, StudioRouteSet } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'

export async function handleSwitchRouteSet(context: JobContext, data: SwitchRouteSetProps): Promise<void> {
	await runJobWithStudioPlayoutModel(context, async (studioPlayoutModel) => {
		// logger.debug(`switchRouteSet "${access.studioId}" "${routeSetId}"=${state}`)
		const routeSetId = data.routeSetId
		const state = data.state
		const studio = context.studio

		if (studio.routeSets[routeSetId] === undefined) throw new Error(`RouteSet "${routeSetId}" not found!`)

		const routeSet = studio.routeSets[routeSetId]
		if (routeSet.behavior === StudioRouteBehavior.ACTIVATE_ONLY && state === false)
			throw new Error(`RouteSet "${routeSetId}" is ACTIVATE_ONLY`)

		studioPlayoutModel.updateRouteSetActive(routeSetId, state)

		if (studio.routeSets[routeSetId].exclusivityGroup && state === true) {
			for (const [otherRouteSetId, otherRouteSet] of Object.entries<ReadonlyObjectDeep<StudioRouteSet>>(
				studio.routeSets
			)) {
				if (otherRouteSetId === routeSetId) return
				if (otherRouteSet.exclusivityGroup === routeSet.exclusivityGroup) {
					studioPlayoutModel.updateRouteSetActive(routeSetId, false)
				}
			}
		}

		// context.directCollections.Studios
		// studioPlayoutModel.updateRouteSetActive(
		// TODO
		// )

		// We want to run them all in parallel
		// await Promise.allSettled(
		// 	tmpPlaylists.map(async (tmpPlaylist) =>
		// 		// Take the playlist lock, to ensure we don't fight something else
		// 		runJobWithPlaylistLock(context, { playlistId: tmpPlaylist._id }, async (playlist) => {
		// 			if (playlist) {
		// 				const rundowns: Pick<DBRundown, '_id'>[] = await context.directCollections.Rundowns.findFetch(
		// 					{ playlistId: playlist._id },
		// 					{ projection: { _id: 1 } }
		// 				)
		// 				if (rundowns.length === 0) {
		// 					await context.directCollections.RundownPlaylists.remove({ _id: playlist._id })
		// 				}
		// 			}
		// 		})
		// 	)
		// )
	})

	// console.log('handleSwitchRouteSet', context, data)

	// return runJobWithPlayoutModel(
	// 	context,
	// 	data,
	// 	async (playoutModel) => {
	// 		const playlist = playoutModel.playlist

	// 		if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
	// 	},
	// 	async (playoutModel) => {
	// 		playoutModel.switchRouteSet(data.routeSetId, data)

	// 		await updateTimeline(context, playoutModel)
	// 	}
	// )
	// return Promise.resolve()
}
