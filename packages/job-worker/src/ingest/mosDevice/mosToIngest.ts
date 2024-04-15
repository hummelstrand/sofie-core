import { MOS } from '@sofie-automation/corelib'
import { parseMosString, getMosIngestSegmentId } from './lib'
import { IngestSegment } from '@sofie-automation/blueprints-integration'

// export function storiesToIngestParts(
// 	context: JobContext,
// 	rundownId: RundownId,
// 	stories: MOS.IMOSStory[],
// 	undefinedPayload: boolean,
// 	existingIngestParts: AnnotatedIngestPart[]
// ): (AnnotatedIngestPart | null)[] {
// 	const span = context.startSpan('ingest.storiesToIngestParts')

// 	const existingIngestPartsMap = normalizeArray(existingIngestParts, 'externalId')

// 	const parts = stories.map((s, i) => {
// 		if (!s) return null

// 		const externalId = parseMosString(s.ID)
// 		const existingIngestPart = existingIngestPartsMap[externalId]

// 		const name = s.Slug ? parseMosString(s.Slug) : ''
// 		return {
// 			externalId: externalId,
// 			partId: getPartIdFromMosStory(rundownId, s.ID),
// 			segmentName: name.split(';')[0],
// 			ingest: literal<LocalIngestPart>({
// 				externalId: parseMosString(s.ID),
// 				name: name,
// 				rank: i,
// 				payload: undefinedPayload ? undefined : {},
// 				modified: existingIngestPart ? existingIngestPart.ingest.modified : getCurrentTime(),
// 			}),
// 		}
// 	})

// 	span?.end()
// 	return parts
// }

export function mosStoryToIngestSegment(mosStory: MOS.IMOSStory, undefinedPayload: boolean): IngestSegment {
	const externalId = parseMosString(mosStory.ID)

	const name = mosStory.Slug ? parseMosString(mosStory.Slug) : ''
	return {
		externalId: getMosIngestSegmentId(externalId),
		name: name,
		rank: 0, // Set later
		parts: [
			{
				externalId: externalId,
				name: name,
				rank: 0,
				payload: undefinedPayload ? undefined : {},
			},
		],
	}
}
