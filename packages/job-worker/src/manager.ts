import { WorkerId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { JobSpec } from './main'

export interface JobManager {
	jobFinished: (
		id: string,
		startedTime: number,
		finishedTime: number,
		error: null | Error | UserError,
		result: any
	) => Promise<void>
	// getNextJob: (queueName: string) => Promise<JobSpec>
	queueJob: (queueName: string, jobName: string, jobData: unknown) => Promise<void>
	subscribeToQueue: (queueName: string, workerId: WorkerId) => JobStream
}

export interface JobStream {
	next(): Promise<JobSpec | null>
	close(): Promise<void>
}
