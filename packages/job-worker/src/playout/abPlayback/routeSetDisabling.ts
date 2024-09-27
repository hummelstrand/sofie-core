import type { ABPlayerDefinition } from '@sofie-automation/blueprints-integration'
import type { StudioRouteSet } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { logger } from '../../logging'

interface MembersOfRouteSets {
	poolName: string
	playerId: string | number
	disabled: boolean
}

export function findPlayersInRouteSets(routeSets: Record<string, StudioRouteSet>): MembersOfRouteSets[] {
	const players: MembersOfRouteSets[] = []
	for (const [_key, routeSet] of Object.entries<StudioRouteSet>(routeSets)) {
		routeSet.abPlayers.forEach((abPlayer) => {
			players.push({
				playerId: abPlayer.playerId,
				poolName: abPlayer.poolName,
				disabled: !routeSet.active,
			})
		})
	}
	return players
}

export function abPoolFilterDisabled(
	poolName: string,
	players: ABPlayerDefinition[],
	membersOfRouteSets: MembersOfRouteSets[]
): ABPlayerDefinition[] {
	if (membersOfRouteSets.length == 0) return players

	// Filter out any disabled players:
	return players.filter((player) => {
		const disabled = membersOfRouteSets.find(
			(abPlayer) => abPlayer.playerId === player.playerId && abPlayer.poolName === poolName
		)?.disabled
		if (disabled) {
			logger.info(`AB Pool ${poolName} playerId : ${player.playerId} are disabled`)
			return false
		}
		return true
	})
}
