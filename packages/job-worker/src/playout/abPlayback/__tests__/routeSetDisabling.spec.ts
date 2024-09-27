import { StudioRouteBehavior, StudioRouteSet } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { abPoolFilterDisabled, findPlayersInRouteSets } from '../routeSetDisabling'
import { ABPlayerDefinition } from '@sofie-automation/blueprints-integration'
import { clone } from '@sofie-automation/corelib/dist/lib'

describe('route set disabling ab players', () => {
	const POOL_NAME = '_test_'
	function runDisablePlayersFiltering(
		routeSets: Record<string, StudioRouteSet>,
		players: ABPlayerDefinition[]
	): ABPlayerDefinition[] {
		const members = findPlayersInRouteSets(routeSets)
		return abPoolFilterDisabled(POOL_NAME, players, members)
	}

	const DEFAULT_PLAYERS: ABPlayerDefinition[] = [
		{ playerId: 1 },
		{ playerId: 2 },
		{ playerId: 3 },
		{ playerId: 4 },
		{ playerId: 5 },
	]

	test('no routesets', () => {
		const result = runDisablePlayersFiltering({}, DEFAULT_PLAYERS)
		expect(result).toEqual(DEFAULT_PLAYERS)
	})

	describe('single routeset per player', () => {
		const ROUTESETS_SEPARATE: Record<string, StudioRouteSet> = {
			pl1: {
				name: '',
				active: true,
				behavior: StudioRouteBehavior.TOGGLE,
				routes: [],
				abPlayers: [
					{
						poolName: POOL_NAME,
						playerId: 1,
					},
				],
			},
			pl2: {
				name: '',
				active: true,
				behavior: StudioRouteBehavior.TOGGLE,
				routes: [],
				abPlayers: [
					{
						poolName: POOL_NAME,
						playerId: 2,
					},
				],
			},
			pl3: {
				name: '',
				active: true,
				behavior: StudioRouteBehavior.TOGGLE,
				routes: [],
				abPlayers: [
					{
						poolName: POOL_NAME,
						playerId: 3,
					},
				],
			},
		}

		test('active routes', () => {
			const result = runDisablePlayersFiltering(ROUTESETS_SEPARATE, DEFAULT_PLAYERS)
			expect(result).toEqual(DEFAULT_PLAYERS)
		})

		test('inactive routes', () => {
			const routesets = clone(ROUTESETS_SEPARATE)
			routesets['pl3'].active = false

			// deactivate this, but for a different pool
			routesets['pl2'].active = false
			routesets['pl2'].abPlayers[0].poolName = 'ANOTHER'

			const result = runDisablePlayersFiltering(routesets, DEFAULT_PLAYERS)

			const expectedPlayers = DEFAULT_PLAYERS.filter((p) => p.playerId !== 3)
			expect(result).toEqual(expectedPlayers)
		})
	})
})
