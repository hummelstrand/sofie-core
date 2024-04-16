import type {
	GroupPartsInMosRundownAndChangesResult,
	IProcessIngestDataContext,
	IngestDefaultChangesOptions,
	IngestRundown,
	MutableIngestRundown,
	NrcsIngestChangeDetails,
} from '@sofie-automation/blueprints-integration'
import { CommonContext } from './CommonContext'
import { defaultApplyIngestChanges } from '../ingest/defaultApplyIngestChanges'
import { groupPartsInMosRundownAndChanges } from '../ingest/groupPartsInMosRundownAndChanges'

export class ProcessIngestDataContext extends CommonContext implements IProcessIngestDataContext {
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

	groupPartsInMosRundownAndChanges(
		nrcsIngestRundown: IngestRundown,
		previousNrcsIngestRundown: IngestRundown | undefined,
		ingestChanges: NrcsIngestChangeDetails
	): GroupPartsInMosRundownAndChangesResult {
		return groupPartsInMosRundownAndChanges(nrcsIngestRundown, previousNrcsIngestRundown, ingestChanges)
	}
}
