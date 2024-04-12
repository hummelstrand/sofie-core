import { IngestPropsBase } from '@sofie-automation/corelib/dist/worker/ingest'
import { JobContext } from '../jobs'
import { IngestUpdateOperationFunction, runIngestUpdateOperation } from './runOperation'

export function wrapMosIngestJob<TData extends IngestPropsBase>(
	fcn: (context: JobContext, data: TData) => IngestUpdateOperationFunction | null
): (context: JobContext, data: TData) => Promise<void> {
	return async (context, data) => {
		const executeFcn = fcn(context, data)
		if (!executeFcn) return

		return runIngestUpdateOperation(context, data, (ingestRundown) => {
			if (ingestRundown && ingestRundown.type !== 'mos') {
				throw new Error(`Rundown "${data.rundownExternalId}" is not a MOS rundown`)
			}

			return executeFcn(ingestRundown)
		})
	}
}

export function wrapGenericIngestJob<TData extends IngestPropsBase>(
	fcn: (context: JobContext, data: TData) => IngestUpdateOperationFunction | null
): (context: JobContext, data: TData) => Promise<void> {
	return async (context, data) => {
		const executeFcn = fcn(context, data)
		if (!executeFcn) return

		return runIngestUpdateOperation(context, data, (ingestRundown) => {
			// nocommit, we can't do this for all operations, as some need to be usable by mos rundowns
			// if (ingestRundown && ingestRundown.type === 'mos') {
			// 	throw new Error(`Rundown "${data.rundownExternalId}" is a MOS rundown`)
			// }

			return executeFcn(ingestRundown)
		})
	}
}
