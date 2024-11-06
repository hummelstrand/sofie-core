import type { PackageInfo } from '@sofie-automation/blueprints-integration'
import type { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece.js'
import type { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage.js'

export interface PieceContentStatusObj {
	status: PieceStatusCode
	messages: ITranslatableMessage[]

	freezes: Array<PackageInfo.Anomaly>
	blacks: Array<PackageInfo.Anomaly>
	scenes: Array<number>

	thumbnailUrl: string | undefined
	previewUrl: string | undefined

	packageName: string | null

	contentDuration: number | undefined

	progress: number | undefined
}
