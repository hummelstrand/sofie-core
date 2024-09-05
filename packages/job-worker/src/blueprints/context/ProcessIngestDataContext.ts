import type {
	GroupPartsInMosRundownAndChangesResult,
	IProcessIngestDataContext,
	IngestDefaultChangesOptions,
	IngestRundown,
	IngestSegment,
	MutableIngestRundown,
	NrcsIngestChangeDetails,
} from '@sofie-automation/blueprints-integration'
import { StudioContext } from './StudioContext'
import { defaultApplyIngestChanges } from '../ingest/defaultApplyIngestChanges'
import { groupMosPartsIntoIngestSegments, groupPartsInRundownAndChanges } from '../ingest/groupPartsInRundownAndChanges'

export class ProcessIngestDataContext extends StudioContext implements IProcessIngestDataContext {
	defaultApplyIngestChanges<TRundownPayload, TSegmentPayload, TPartPayload>(
		mutableIngestRundown: MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>,
		nrcsIngestRundown: IngestRundown,
		ingestChanges: NrcsIngestChangeDetails,
		options?: IngestDefaultChangesOptions<TRundownPayload, TSegmentPayload, TPartPayload>
	): void {
		defaultApplyIngestChanges(mutableIngestRundown, nrcsIngestRundown, ingestChanges, {
			transformRundownPayload: (payload) => payload as TRundownPayload,
			transformSegmentPayload: (payload) => payload as TSegmentPayload,
			transformPartPayload: (payload) => payload as TPartPayload,
			...options,
		})
	}

	groupMosPartsInRundownAndChangesWithSeparator(
		ingestRundown: IngestRundown,
		previousIngestRundown: IngestRundown | undefined,
		ingestChanges: NrcsIngestChangeDetails,
		partNameSeparator: string
	): GroupPartsInMosRundownAndChangesResult {
		if (ingestRundown.type !== 'mos') throw new Error('Only supported for mos rundowns')

		return groupPartsInRundownAndChanges(ingestRundown, previousIngestRundown, ingestChanges, (segments) =>
			groupMosPartsIntoIngestSegments(ingestRundown.externalId, segments, partNameSeparator)
		)
	}

	groupPartsInRundownAndChanges(
		ingestRundown: IngestRundown,
		previousIngestRundown: IngestRundown | undefined,
		ingestChanges: NrcsIngestChangeDetails,
		groupPartsIntoSegments: (ingestSegments: IngestSegment[]) => IngestSegment[]
	): GroupPartsInMosRundownAndChangesResult {
		return groupPartsInRundownAndChanges(
			ingestRundown,
			previousIngestRundown,
			ingestChanges,
			groupPartsIntoSegments
		)
	}
}
