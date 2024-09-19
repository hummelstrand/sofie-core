import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { Studios } from '../collections'
import { convertObjectIntoOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import {
	StudioRouteSet,
	StudioRouteSetExclusivityGroup,
	StudioPackageContainer,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import { Rundowns } from '../collections'
import { RundownOrphanedReason, RundownSource } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PeripheralDeviceId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */

interface RemovedRundownProps {
	/** The peripheral device the rundown originates from */
	peripheralDeviceId?: PeripheralDeviceId
	restoredFromSnapshotId?: RundownId
	externalNRCSName: string
}

export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	{
		id: `Rundowns without source`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await Rundowns.findFetchAsync({
				source: { $exists: false },
			})

			if (objects.length > 0) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await Rundowns.findFetchAsync({
				source: { $exists: false },
			})
			for (const obj of objects) {
				const oldPartialObj = obj as any as RemovedRundownProps

				let newSource: RundownSource = {
					type: 'http', // Fallback
				}
				if (oldPartialObj.peripheralDeviceId) {
					newSource = {
						type: 'nrcs',
						peripheralDeviceId: oldPartialObj.peripheralDeviceId,
						nrcsName: oldPartialObj.externalNRCSName,
					}
				} else if (oldPartialObj.restoredFromSnapshotId) {
					newSource = {
						type: 'snapshot',
						rundownId: oldPartialObj.restoredFromSnapshotId,
					}
				}

				await Rundowns.mutableCollection.updateAsync(obj._id, {
					$set: {
						source: newSource,
					},
					$unset: {
						peripheralDeviceId: 1,
						externalNrcsName: 1,
						restoredFromSnapshotId: 1,
					},
				})
			}
		},
	},
	{
		id: `Rundowns remove orphaned FROM_SNAPSHOT`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await Rundowns.findFetchAsync({
				orphaned: 'from-snapshot' as any,
			})

			if (objects.length > 0) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			await Rundowns.mutableCollection.updateAsync(
				{
					orphaned: 'from-snapshot' as any,
				},
				{
					$set: {
						orphaned: RundownOrphanedReason.DELETED,
					},
				},
				{
					multi: true,
				}
			)
		},
	},
	{
		id: `convert routesets to ObjectWithOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({ routeSets: { $exists: true } })

			for (const studio of studios) {
				//@ts-expect-error routeSets is not typed as ObjectWithOverrides
				if (studio.routeSets) {
					return 'routesets must be converted to an ObjectWithOverrides'
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({ routeSets: { $exists: true } })

			for (const studio of studios) {
				//@ts-expect-error routeSets is not typed as ObjectWithOverrides
				if (!studio.routeSets) continue
				//@ts-expect-error routeSets is not typed as ObjectWithOverrides
				const oldRouteSets = studio.routeSets as any as Record<string, StudioRouteSet>

				const newRouteSets = convertObjectIntoOverrides(oldRouteSets)

				await Studios.updateAsync(studio._id, {
					$set: {
						routeSetsWithOverrides: newRouteSets,
					},
					$unset: {
						routeSets: 1,
					},
				})
			}
		},
	},
	{
		id: `convert routeSetExclusivityGroups to ObjectWithOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({ routeSetExclusivityGroups: { $exists: true } })

			for (const studio of studios) {
				//@ts-expect-error routeSetExclusivityGroups is not typed as ObjectWithOverrides
				if (studio.routeSetExclusivityGroups) {
					return 'routesets must be converted to an ObjectWithOverrides'
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({ routeSetExclusivityGroups: { $exists: true } })

			for (const studio of studios) {
				//@ts-expect-error routeSetExclusivityGroups is not typed as ObjectWithOverrides
				if (!studio.routeSetExclusivityGroups) return
				//@ts-expect-error routeSetExclusivityGroups is not typed as ObjectWithOverrides
				const oldRouteSetExclusivityGroups = studio.routeSetExclusivityGroups as any as Record<
					string,
					StudioRouteSetExclusivityGroup
				>

				const newRouteSetExclusivityGroups = convertObjectIntoOverrides(oldRouteSetExclusivityGroups)

				await Studios.updateAsync(studio._id, {
					$set: {
						routeSetExclusivityGroupsWithOverrides: newRouteSetExclusivityGroups,
					},
					$unset: {
						routeSetExclusivityGroups: 1,
					},
				})
			}
		},
	},
	{
		id: `convert packageContainers to ObjectWithOverrides and add abPlayers object`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({ packageContainers: { $exists: true } })

			for (const studio of studios) {
				//@ts-expect-error packageContainers is not typed as ObjectWithOverrides
				if (studio.packageContainers) {
					return 'packageContainers must be converted to an ObjectWithOverrides'
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({ packageContainers: { $exists: true } })

			for (const studio of studios) {
				//@ts-expect-error packageContainers is not typed as ObjectWithOverrides
				if (!studio.packageContainers) continue
				//@ts-expect-error packageContainers is not typed as ObjectWithOverrides
				const oldPackageContainers = studio.packageContainers as any as Record<string, StudioPackageContainer>

				const newPackageContainers = convertObjectIntoOverrides(oldPackageContainers)

				await Studios.updateAsync(studio._id, {
					$set: {
						packageContainersWithOverrides: newPackageContainers,
					},
					$unset: {
						packageContainers: 1,
					},
				})
			}
		},
	},
])
