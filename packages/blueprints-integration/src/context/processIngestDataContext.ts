import { IngestRundown } from '@sofie-automation/shared-lib/dist/peripheralDevice/ingest'
import type { ICommonContext } from './baseContext'
import { IngestDefaultChangesOptions, MutableIngestRundown, NrcsIngestChangeDetails } from '../ingest'

export interface IProcessIngestDataContext extends ICommonContext {
	/**
	 * Perform the default syncing of changes from the ingest data to the rundown.
	 * This may be overly agressive at removing any changes made by user operations.
	 * If you are using user operations, you may need to perform some pre and post fixups to ensure changes aren't wiped unnecessarily.
	 * @param ingestRundown NRCS version of the IngestRundown to copy from
	 * @param ingestChanges A description of the changes that have been made to the rundown and should be propogated
	 * @param options Options for how to apply the changes
	 */
	defaultApplyIngestChanges<TRundownPayload, TSegmentPayload, TPartPayload>(
		mutableIngestRundown: MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>,
		ingestRundown: IngestRundown,
		ingestChanges: NrcsIngestChangeDetails,
		options?: IngestDefaultChangesOptions<TRundownPayload, TSegmentPayload, TPartPayload>
	): void

	groupPartsInMosRundownAndChanges(
		ingestRundown: IngestRundown,
		previousIngestRundown: IngestRundown | undefined,
		ingestChanges: NrcsIngestChangeDetails
	): GroupPartsInMosRundownAndChangesResult
}

export interface GroupPartsInMosRundownAndChangesResult {
	nrcsIngestRundown: IngestRundown
	ingestChanges: NrcsIngestChangeDetails
	changedSegmentExternalIds: Record<string, string>
}
