import {
	IngestRundown,
	IncomingIngestChange,
	IngestDefaultChangesOptions,
	IncomingIngestRundownChange,
	MutableIngestRundown,
} from '@sofie-automation/blueprints-integration'
import { assertNever } from '@sofie-automation/corelib/dist/lib'

export function defaultApplyChanges<TRundownPayload, TSegmentPayload, TPartPayload>(
	mutableIngestRundown: MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>,
	nrcsRundown: IngestRundown,
	changes: IncomingIngestChange,
	options: IngestDefaultChangesOptions<TRundownPayload, TSegmentPayload, TPartPayload>
): void {
	if (changes.source !== 'ingest') throw new Error(`Changes passed to defaultApplyChanges must be from ingest source`)

	let regenerateAllContents = false

	switch (changes.rundownChanges) {
		case IncomingIngestRundownChange.Regenerate: {
			// Future: should this be able to merge?
			mutableIngestRundown.replacePayload(options.transformRundownPayload(nrcsRundown.payload))

			mutableIngestRundown.setName(nrcsRundown.name)
			mutableIngestRundown.removeAllSegments()
			regenerateAllContents = true

			break
		}
		case IncomingIngestRundownChange.Payload: {
			// Future: should this be able to merge?
			mutableIngestRundown.replacePayload(options.transformRundownPayload(nrcsRundown.payload))

			mutableIngestRundown.setName(nrcsRundown.name)
			break
		}
		case undefined:
		case null:
			// No changes
			break
		default:
			assertNever(changes.rundownChanges)
	}

	// TODO - other portions

	if (regenerateAllContents) {
		// TODO?
	}
}
