import { IngestPropsBase } from '@sofie-automation/corelib/dist/worker/ingest'
import { JobContext } from '../jobs'
import {
	IngestUpdateOperationFunction,
	UpdateIngestRundownResult,
	runCustomIngestUpdateOperation,
	runIngestUpdateOperation,
} from './runOperation'
import { LocalIngestRundown } from './ingestCache'
import { CommitIngestData } from './lock'
import { IngestModel } from './model/IngestModel'

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
	fcn: (
		context: JobContext,
		data: TData,
		oldIngestRundown: LocalIngestRundown | undefined
	) => UpdateIngestRundownResult
): (context: JobContext, data: TData) => Promise<void> {
	return async (context, data) => {
		return runIngestUpdateOperation(context, data, (ingestRundown) => {
			// nocommit, we can't do this for all operations, as some need to be usable by mos rundowns
			// if (ingestRundown && ingestRundown.type === 'mos') {
			// 	throw new Error(`Rundown "${data.rundownExternalId}" is a MOS rundown`)
			// }

			return fcn(context, data, ingestRundown)
		})
	}
}

export function wrapGenericIngestJobWithPrecheck<TData extends IngestPropsBase>(
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

export function wrapCustomIngestJob<TData extends IngestPropsBase>(
	fcn: (
		context: JobContext,
		data: TData,
		ingestModel: IngestModel,
		ingestRundown: LocalIngestRundown
	) => Promise<CommitIngestData | null>
): (context: JobContext, data: TData) => Promise<void> {
	return async (context, data) => {
		return runCustomIngestUpdateOperation(context, data, async (_context, ingestModel, ingestRundown) => {
			return fcn(context, data, ingestModel, ingestRundown)
		})
	}
}
