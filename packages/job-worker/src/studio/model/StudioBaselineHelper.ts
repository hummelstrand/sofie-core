import { JobContext } from '../../jobs'
import {
	ExpectedPackageDB,
	ExpectedPackageDBFromStudioBaselineObjects,
	ExpectedPackageDBType,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemStudio } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { saveIntoDb } from '../../db/changes'
import { StudioRouteBehavior, StudioRouteSet } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { logger } from '../../logging'
import {
	WrappedOverridableItem,
	useOverrideOpHelperBackend,
	getAllCurrentItemsFromOverrides,
} from '@sofie-automation/corelib/dist/overrideOpHelperBackend'
import { ObjectWithOverrides, SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

export class StudioBaselineHelper {
	readonly #context: JobContext

	#pendingExpectedPackages: ExpectedPackageDBFromStudioBaselineObjects[] | undefined
	#pendingExpectedPlayoutItems: ExpectedPlayoutItemStudio[] | undefined
	#routeSetActive: Record<string, boolean> = {}

	constructor(context: JobContext) {
		this.#context = context
	}

	hasChanges(): boolean {
		return (
			!!this.#pendingExpectedPackages ||
			!!this.#pendingExpectedPlayoutItems ||
			Object.keys(this.#routeSetActive).length > 0
		)
	}

	setExpectedPackages(packages: ExpectedPackageDBFromStudioBaselineObjects[]): void {
		this.#pendingExpectedPackages = packages
	}
	setExpectedPlayoutItems(playoutItems: ExpectedPlayoutItemStudio[]): void {
		this.#pendingExpectedPlayoutItems = playoutItems
	}

	async saveAllToDatabase(): Promise<void> {
		await Promise.all([
			this.#pendingExpectedPlayoutItems
				? saveIntoDb(
						this.#context,
						this.#context.directCollections.ExpectedPlayoutItems,
						{ studioId: this.#context.studioId, baseline: 'studio' },
						this.#pendingExpectedPlayoutItems
				  )
				: undefined,
			this.#pendingExpectedPackages
				? saveIntoDb<ExpectedPackageDB>(
						this.#context,
						this.#context.directCollections.ExpectedPackages,
						{
							studioId: this.#context.studioId,
							fromPieceType: ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS,
						},
						this.#pendingExpectedPackages
				  )
				: undefined,
			Object.keys(this.#routeSetActive).length > 0
				? this.#context.directCollections.Studios.update(
						{
							_id: this.#context.studioId,
						},
						{
							$set: this.#routeSetActive,
						}
				  )
				: undefined,
		])

		this.#pendingExpectedPlayoutItems = undefined
		this.#pendingExpectedPackages = undefined
		this.#routeSetActive = {}
	}

	updateRouteSetActive(routeSetId: string, isActive: boolean): void {
		const studio = this.#context.studio
		logger.debug(`switchRouteSet "${studio._id}" "${routeSetId}"=${isActive}`)

		const routeSets = getAllCurrentItemsFromOverrides(studio.routeSets, null)
		const routeSet = Object.values<WrappedOverridableItem<StudioRouteSet>>(routeSets).find((routeSet) => {
			return (routeSet.id = routeSetId)
		})

		// This is not correct as it should use:
		// this.#routeSetActive[] in some way.
		// And save the Array with changes on the next saveAllToDatabase()
		const saveOverrides = (newOps: SomeObjectOverrideOp[]) => {
			logger.debug(`saveOverrides "${studio._id}" "${routeSetId}"=${isActive}`)
			logger.debug(`---------------------------------------------------------------`)
			logger.alert(`NewOps: ${JSON.stringify(newOps)}`)
			// this.#routeSetActive['routeSets.overrides'] = newOps
			this.#context.directCollections.Studios.update(
				{ _id: studio._id },
				{
					$set: {
						'routeSets.overrides': newOps,
					},
				}
			).catch((err) => {
				logger.error(`Error updating studio "${studio._id}"`, err)
			})
		}

		const overrideHelper = useOverrideOpHelperBackend(
			saveOverrides,
			studio.routeSets as ObjectWithOverrides<Record<string, StudioRouteSet>>
		)

		if (routeSet === undefined) throw new Error(`RouteSet "${routeSetId}" not found!`)

		if (routeSet.computed?.behavior === StudioRouteBehavior.ACTIVATE_ONLY && isActive === false)
			throw new Error(`RouteSet "${routeSetId}" is ACTIVATE_ONLY`)

		overrideHelper.setItemValue(routeSetId, `active`, isActive)

		// Deactivate other routeSets in the same exclusivity group:
		if (routeSet.computed?.exclusivityGroup && isActive === true) {
			for (const [otherRouteSetId, otherRouteSet] of Object.entries<WrappedOverridableItem<StudioRouteSet>>(
				routeSets
			)) {
				if (otherRouteSetId === routeSetId) continue
				if (otherRouteSet.computed?.exclusivityGroup === routeSet.computed?.exclusivityGroup) {
					overrideHelper.setItemValue(otherRouteSetId, `active`, false)
				}
			}
		}
	}
}
