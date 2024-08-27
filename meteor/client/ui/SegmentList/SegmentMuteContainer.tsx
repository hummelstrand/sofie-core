import React, { useEffect, useRef } from 'react'
import { meteorSubscribe } from '../../../lib/api/pubsub'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import {
	withResolvedSegment,
	IResolvedSegmentProps,
	ITrackedResolvedSegmentProps,
} from '../SegmentContainer/withResolvedSegment'
import { SpeechSynthesiser } from '../../lib/speechSynthesis'
import { unprotectString } from '../../../lib/lib'
import { LIVELINE_HISTORY_SIZE as TIMELINE_LIVELINE_HISTORY_SIZE } from '../SegmentTimeline/SegmentTimelineContainer'
import { PartInstances, Parts, Segments } from '../../collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { SegmentMute } from './SegmentMute'

export const LIVELINE_HISTORY_SIZE = TIMELINE_LIVELINE_HISTORY_SIZE

interface IProps extends IResolvedSegmentProps {
	id: string
}

export const SegmentMuteContainer = withResolvedSegment<IProps>(function SegmentListContainer({
	rundownId,
	rundownIdsBefore,
	segmentId,
	segmentsIdsBefore,
	...props
}: IProps & ITrackedResolvedSegmentProps) {
	const partIds = useTracker(
		() =>
			Parts.find(
				{
					segmentId,
				},
				{
					fields: {
						_id: 1,
					},
				}
			).map((part) => part._id),
		[segmentId]
	)

	useSubscription(CorelibPubSub.pieces, [rundownId], partIds ?? [])

	const partInstanceIds = useTracker(
		() =>
			PartInstances.find(
				{
					segmentId: segmentId,
					reset: {
						$ne: true,
					},
				},
				{
					fields: {
						_id: 1,
						part: 1,
					},
				}
			).map((instance) => instance._id),
		[segmentId]
	)

	useSubscription(CorelibPubSub.pieceInstances, [rundownId], partInstanceIds ?? [], {})

	useTracker(() => {
		const segment = Segments.findOne(segmentId, {
			fields: {
				rundownId: 1,
				_rank: 1,
			},
		})
		segment &&
			meteorSubscribe(
				CorelibPubSub.piecesInfiniteStartingBefore,
				rundownId,
				Array.from(segmentsIdsBefore.values()),
				Array.from(rundownIdsBefore.values())
			)
	}, [segmentId, rundownId, segmentsIdsBefore.values(), rundownIdsBefore.values()])

	const isLiveSegment = useTracker(
		() => {
			if (!props.playlist.currentPartInfo || !props.playlist.activationId) {
				return false
			}

			const currentPartInstance = PartInstances.findOne(props.playlist.currentPartInfo.partInstanceId)
			if (!currentPartInstance) {
				return false
			}

			return currentPartInstance.segmentId === segmentId
		},
		[segmentId, props.playlist.activationId, props.playlist.currentPartInfo?.partInstanceId],
		false
	)

	const isNextSegment = useTracker(
		() => {
			if (!props.playlist.nextPartInfo || !props.playlist.activationId) {
				return false
			}

			const partInstance = PartInstances.findOne(props.playlist.nextPartInfo.partInstanceId, {
				fields: {
					segmentId: 1,
					'part._id': 1,
				} as any,
			})
			if (!partInstance) {
				return false
			}

			return partInstance.segmentId === segmentId
		},
		[segmentId, props.playlist.activationId, props.playlist.nextPartInfo?.partInstanceId],
		false
	)

	const currentPartWillAutoNext = useTracker(
		() => {
			if (!props.playlist.currentPartInfo || !props.playlist.activationId) {
				return false
			}

			const currentPartInstance = PartInstances.findOne(props.playlist.currentPartInfo.partInstanceId, {
				fields: {
					'part.autoNext': 1,
					'part.expectedDuration': 1,
				} as any,
			})
			if (!currentPartInstance) {
				return false
			}

			return !!(currentPartInstance.part.autoNext && currentPartInstance.part.expectedDuration)
		},
		[segmentId, props.playlist.activationId, props.playlist.currentPartInfo?.partInstanceId],
		false
	)

	useEffect(() => {
		SpeechSynthesiser.init()
	}, [])

	const segmentRef = useRef<HTMLDivElement | null>(null)

	if (props.segmentui === undefined || props.segmentui.isHidden) {
		return null
	}

	return (
		<SegmentMute
			id={props.id}
			ref={segmentRef}
			key={unprotectString(props.segmentui._id)}
			segment={props.segmentui}
			parts={props.parts}
			playlist={props.playlist}
			currentPartWillAutoNext={currentPartWillAutoNext}
			segmentNoteCounts={props.segmentNoteCounts}
			isLiveSegment={isLiveSegment}
			isNextSegment={isNextSegment}
			isQueuedSegment={props.playlist.queuedSegmentId === props.segmentui._id}
			showCountdownToSegment={props.showCountdownToSegment}
			fixedSegmentDuration={props.fixedSegmentDuration ?? false}
			hasAlreadyPlayed={props.hasAlreadyPlayed}
			onContextMenu={props.onContextMenu}
			onSwitchViewMode={props.onSwitchViewMode}
			onHeaderNoteClick={props.onHeaderNoteClick}
			onPieceDoubleClick={props.onPieceDoubleClick}
		/>
	)
})
