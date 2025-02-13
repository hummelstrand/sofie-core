import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { Collection } from '../wsHandler'
import { CollectionBase } from '../collectionBase'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import * as _ from 'underscore'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

const THROTTLE_PERIOD_MS = 200

export class SegmentsHandler
	extends CollectionBase<DBSegment[], CollectionName.Segments>
	implements Collection<DBSegment[]>
{
	private throttledNotify: (data: DBSegment[]) => void

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.Segments, logger, coreHandler)
		this.throttledNotify = _.throttle(this.notify.bind(this), THROTTLE_PERIOD_MS, { leading: true, trailing: true })
	}

	setSegments(segments: DBSegment[]): void {
		this.logUpdateReceived('segments', segments.length)
		this._collectionData = segments
		this.throttledNotify(this._collectionData)
	}
}
