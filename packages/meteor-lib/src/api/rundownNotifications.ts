import type { TrackedNote } from '@sofie-automation/corelib/dist/dataModel/Notes.js'
import type {
	AdLibActionId,
	BucketAdLibActionId,
	BucketAdLibId,
	BucketId,
	PartId,
	PieceId,
	PieceInstanceId,
	RundownBaselineAdLibActionId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids.js'
import type { PieceContentStatusObj } from './pieceContentStatus.js'
import type { ProtectedString } from '@sofie-automation/corelib/dist/protectedString.js'
import type { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage.js'

export type UISegmentPartNoteId = ProtectedString<'UISegmentPartNote'>
export interface UISegmentPartNote {
	_id: UISegmentPartNoteId
	playlistId: RundownPlaylistId
	rundownId: RundownId
	segmentId: SegmentId

	note: TrackedNote
}

export type UIPieceContentStatusId = ProtectedString<'UIPieceContentStatus'>
export interface UIPieceContentStatus {
	_id: UIPieceContentStatusId

	segmentRank: number
	partRank: number

	rundownId: RundownId
	partId: PartId | undefined
	segmentId: SegmentId | undefined

	pieceId: PieceId | AdLibActionId | RundownBaselineAdLibActionId | PieceInstanceId
	isPieceInstance: boolean

	name: string | ITranslatableMessage
	segmentName: string | undefined

	status: PieceContentStatusObj
}

export type UIBucketContentStatusId = ProtectedString<'UIBucketContentStatus'>
export interface UIBucketContentStatus {
	_id: UIBucketContentStatusId

	bucketId: BucketId
	docId: BucketAdLibActionId | BucketAdLibId

	name: string | ITranslatableMessage

	status: PieceContentStatusObj
}
