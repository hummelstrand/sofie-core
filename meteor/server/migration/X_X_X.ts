import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { Studios } from '../collections'
import { convertObjectIntoOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
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
		id: `add abPlayers to routeSetsWithOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({ routeSetsWithOverrides: { $exists: true } })

			for (const studio of studios) {
				// iterate over routeSetsWithOverrides.defaults and check if abPlayers is missing
				const routeSets = studio.routeSetsWithOverrides.defaults
				if (!routeSets) return 'routeSetsWithOverrides.defaults is missing'
				for (const routeSet of Object.values<any>(routeSets)) {
					if (!routeSet.abPlayers) {
						return 'abPlayers is missing in routeSetsWithOverrides.defaults'
					}
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({ routeSetExclusivityGroups: { $exists: true } })

			for (const studio of studios) {
				const routeSets = studio.routeSetsWithOverrides
				// iterate over routeSetsWithOverrides.defaults and check if abPlayers is missing
				// if missing add it to the routeSet
				for (const routeSet of Object.values<any>(routeSets.defaults)) {
					if (!routeSet.abPlayers) {
						routeSet.abPlayers = {}
					}
				}
				await Studios.updateAsync(studio._id, {
					$set: {
						routeSetsWithOverrides: routeSets,
					},
				})
			}
		},
	},
])
