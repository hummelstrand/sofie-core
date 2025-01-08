import { IMOSObjectStatus } from '@mos-connection/connector'
import type { MosDeviceStatusesConfig } from '../generated/devices'
import {
	IngestPartPlaybackStatus,
	type IngestPartStatus,
	type IngestRundownStatus,
} from '@sofie-automation/shared-lib/dist/ingest/rundownStatus'

export const MOS_STATUS_UNKNOWN = '' as IMOSObjectStatus // Force the status to be empty, which isn't a valid state in the enum

export type SomeStatusEntry = StoryStatusEntry | ItemStatusEntry

export interface ItemStatusEntry {
	type: 'item'
	rundownExternalId: string
	storyId: string
	itemId: string
	mosStatus: IMOSObjectStatus
}

export interface StoryStatusEntry {
	type: 'story'
	rundownExternalId: string
	storyId: string
	mosStatus: IMOSObjectStatus
}

export function diffStatuses(
	config: MosDeviceStatusesConfig,
	previousStatuses: IngestRundownStatus | undefined,
	newStatuses: IngestRundownStatus | undefined
): SomeStatusEntry[] {
	const rundownExternalId = previousStatuses?.externalId ?? newStatuses?.externalId

	if ((!previousStatuses && !newStatuses) || !rundownExternalId) return []

	const statuses: SomeStatusEntry[] = []

	const previousStories = buildStoriesMap(previousStatuses)
	const newStories = buildStoriesMap(newStatuses)

	// Process any removed stories first
	for (const [storyId, story] of previousStories) {
		if (!newStories.has(storyId)) {
			// The story has been removed
			statuses.push({
				type: 'story',
				rundownExternalId,
				storyId,
				mosStatus: MOS_STATUS_UNKNOWN,
			})

			// Clear any items too
			for (const [itemId, isReady] of Object.entries<boolean | undefined>(story.itemsReady)) {
				if (isReady === undefined) continue

				statuses.push({
					type: 'item',
					rundownExternalId,
					storyId,
					itemId: itemId,
					mosStatus: MOS_STATUS_UNKNOWN,
				})
			}
		}
	}

	// Then any remaining stories in order
	for (const [storyId, status] of newStories) {
		const previousStatus = previousStories.get(storyId)

		const newMosStatus = buildMosStatus(config, status.playbackStatus, status.isReady, newStatuses?.active)
		if (
			newMosStatus !== null &&
			(!previousStatus ||
				buildMosStatus(
					config,
					previousStatus.playbackStatus,
					previousStatus.isReady,
					previousStatuses?.active
				) !== newMosStatus)
		) {
			statuses.push({
				type: 'story',
				rundownExternalId,
				storyId,
				mosStatus: newMosStatus,
			})
		}

		// Diff each item in the story
		const previousItemStatuses = previousStatus?.itemsReady ?? {}
		const allItemIds = new Set<string>([...Object.keys(status.itemsReady), ...Object.keys(previousItemStatuses)])

		for (const itemId of allItemIds) {
			const newReady = status.itemsReady[itemId]
			const previousReady = previousItemStatuses[itemId]

			const newMosStatus =
				newReady !== undefined
					? buildMosStatus(config, status.playbackStatus, newReady, newStatuses?.active)
					: null
			const previousMosStatus =
				previousReady !== undefined && previousStatus
					? buildMosStatus(config, previousStatus.playbackStatus, previousReady, previousStatuses?.active)
					: null

			if ((newMosStatus !== null || previousMosStatus !== null) && previousMosStatus !== newMosStatus) {
				statuses.push({
					type: 'item',
					rundownExternalId,
					storyId,
					itemId,
					mosStatus: newMosStatus ?? MOS_STATUS_UNKNOWN,
				})
			}
		}
	}

	return statuses
}

function buildStoriesMap(state: IngestRundownStatus | undefined): Map<string, IngestPartStatus> {
	const stories = new Map<string, IngestPartStatus>()

	if (state) {
		for (const segment of state.segments) {
			for (const part of segment.parts) {
				stories.set(part.externalId, part)
			}
		}
	}

	return stories
}

function buildMosStatus(
	config: MosDeviceStatusesConfig,
	playbackStatus: IngestPartPlaybackStatus,
	isReady: boolean | null | undefined,
	active: IngestRundownStatus['active'] | undefined
): IMOSObjectStatus | null {
	if (active === 'inactive') return MOS_STATUS_UNKNOWN
	if (active === 'rehearsal' && !config.sendInRehearsal) return null

	switch (playbackStatus) {
		case IngestPartPlaybackStatus.PLAY:
			return IMOSObjectStatus.PLAY
		case IngestPartPlaybackStatus.STOP:
			return IMOSObjectStatus.STOP
		default:
			switch (isReady) {
				case true:
					return IMOSObjectStatus.READY
				case false:
					return IMOSObjectStatus.NOT_READY
				default:
					return MOS_STATUS_UNKNOWN
			}
	}
}
