import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { Studios } from '../collections'
import { convertObjectIntoOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { StudioPackageContainer } from '@sofie-automation/corelib/dist/dataModel/Studio'

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
