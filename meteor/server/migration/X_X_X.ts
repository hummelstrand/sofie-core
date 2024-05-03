import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { Studios } from '../collections'

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
		id: 'Add abPoolsDisabling to Studios',
		canBeRunAutomatically: true,
		validate: async () => {
			return (
				(await Studios.countDocuments({
					abPoolsDisabling: { $exists: false },
				})) > 0
			)
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({})
			for (const studio of studios) {
				await Studios.updateAsync(studio._id, { $set: { abPoolsDisabling: {} } })
			}
		},
	},
])
