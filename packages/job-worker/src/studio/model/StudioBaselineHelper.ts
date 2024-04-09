import { JobContext } from '../../jobs'
import {
	ExpectedPackageDB,
	ExpectedPackageDBFromStudioBaselineObjects,
	ExpectedPackageDBType,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemStudio } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { saveIntoDb } from '../../db/changes'
import { StudioRouteBehavior, StudioRouteSet } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { logger } from '../../logging'

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
		logger.debug(`switchRouteSet "${studio}" "${routeSetId}"=${isActive}`)

		if (studio.routeSets[routeSetId] === undefined) throw new Error(`RouteSet "${routeSetId}" not found!`)

		const routeSet = studio.routeSets[routeSetId]
		if (routeSet.behavior === StudioRouteBehavior.ACTIVATE_ONLY && isActive === false)
			throw new Error(`RouteSet "${routeSetId}" is ACTIVATE_ONLY`)

		if (studio.routeSets[routeSetId].exclusivityGroup) {
			for (const [otherRouteSetId, otherRouteSet] of Object.entries<ReadonlyObjectDeep<StudioRouteSet>>(
				studio.routeSets
			)) {
				if (otherRouteSetId === routeSetId) continue
				if (otherRouteSet.exclusivityGroup === routeSet.exclusivityGroup) {
					this.#routeSetActive[`routeSets.${routeSetId}.active`] = isActive
				}
			}
		}
	}
}
