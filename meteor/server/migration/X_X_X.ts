import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { Studios } from '../collections'
import {
	convertObjectIntoOverrides,
	isObjectWithOverrides,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { StudioRouteSet, StudioRouteSetExclusivityGroup } from '@sofie-automation/corelib/dist/dataModel/Studio'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */

export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	// Add your migration here

	{
		id: `convert routesets to ObjectWithOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({ routeSets: { $exists: true } })

			for (const studio of studios) {
				// is an plain object
				if (!isObjectWithOverrides(studio.routeSetsWithOverrides)) {
					return 'routesets must be converted to an ObjectWithOverrides'
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({ routeSets: { $exists: true } })

			for (const studio of studios) {
				if (!isObjectWithOverrides(studio.routeSetsWithOverrides)) {
					// studio.routeSets is an plain object
					const oldRouteSets = studio.routeSetsWithOverrides as any as Record<string, StudioRouteSet>

					const newRouteSets = convertObjectIntoOverrides(oldRouteSets)

					await Studios.updateAsync(studio._id, {
						$set: {
							routeSets: newRouteSets,
						},
					})
				}
			}
		},
	},
	{
		id: `convert routeSetExclusivityGroups to ObjectWithOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({ routeSetExclusivityGroups: { $exists: true } })

			for (const studio of studios) {
				// is an plain object
				if (!isObjectWithOverrides(studio.routeSetExclusivityGroupsWithOverrides)) {
					return 'routesets must be converted to an ObjectWithOverrides'
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({ routeSetExclusivityGroups: { $exists: true } })

			for (const studio of studios) {
				if (!isObjectWithOverrides(studio.routeSetExclusivityGroupsWithOverrides)) {
					// studio.routeSets is an plain object
					const oldRouteSetExclusivityGroups = studio.routeSetExclusivityGroupsWithOverrides as any as Record<
						string,
						StudioRouteSetExclusivityGroup
					>

					const newRouteSetExclusivityGroups = convertObjectIntoOverrides(oldRouteSetExclusivityGroups)

					await Studios.updateAsync(studio._id, {
						$set: {
							routeSetExclusivityGroups: newRouteSetExclusivityGroups,
						},
					})
				}
			}
		},
	},
])
