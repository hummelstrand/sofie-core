/* tslint:disable:no-use-before-declare */
import { PackageInfo } from '../../coreSystem'
import { StudioContentAccess } from '../../security/studio'
import { shouldUpdateStudioBaselineInner } from '@sofie-automation/corelib/dist/studio/baseline'
import { Blueprints, RundownPlaylists, Timeline } from '../../collections'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { QueueStudioJob } from '../../worker/worker'

export namespace ServerPlayoutAPI {
	export async function shouldUpdateStudioBaseline(access: StudioContentAccess): Promise<string | false> {
		const { studio } = access

		// This is intentionally not in a lock/queue, as doing so will cause it to block playout performance, and being wrong is harmless

		if (studio) {
			const activePlaylists = await RundownPlaylists.findFetchAsync(
				{ studioId: studio._id, activationId: { $exists: true } },
				{ fields: { _id: 1 } }
			)
			if (activePlaylists.length > 0) return false

			const [timeline, blueprint] = await Promise.all([
				Timeline.findOneAsync(studio._id),
				studio.blueprintId
					? Blueprints.findOneAsync(studio.blueprintId, { fields: { blueprintVersion: 1 } })
					: null,
			])
			if (blueprint === undefined) return 'missingBlueprint'

			return shouldUpdateStudioBaselineInner(PackageInfo.version, studio, timeline ?? null, blueprint)
		} else {
			return false
		}
	}

	export async function switchRouteSet(
		access: StudioContentAccess,
		routeSetId: string,
		state: boolean
	): Promise<void> {
		const queuedJob = await QueueStudioJob(StudioJobs.SwitchRouteSet, access.studioId, {
			routeSetId,
			state,
		})
		await queuedJob.complete
	}
}
