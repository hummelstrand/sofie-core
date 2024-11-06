import type { Time } from '@sofie-automation/shared-lib/dist/lib/lib.js'
import type {
	EvaluationId,
	StudioId,
	RundownPlaylistId,
	SnapshotId,
	OrganizationId,
	UserId,
} from '@sofie-automation/corelib/dist/dataModel/Ids.js'

export interface Evaluation extends EvaluationBase {
	_id: EvaluationId
	organizationId: OrganizationId | null
	userId: UserId | null
	timestamp: Time
}
export interface EvaluationBase {
	studioId: StudioId
	playlistId: RundownPlaylistId
	answers: {
		[key: string]: string
	}
	snapshots?: Array<SnapshotId>
}
