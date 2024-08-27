import React from 'react'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import classNames from 'classnames'
// import { InView } from 'react-intersection-observer'
import { contextMenuHoldToDisplayTime } from '../../lib/lib'
import { SegmentViewMode } from '../SegmentContainer/SegmentViewModes'
import { PartUi, SegmentNoteCounts, SegmentUi } from '../SegmentContainer/withResolvedSegment'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTranslation } from 'react-i18next'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { IContextMenuContext } from '../RundownView'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { CriticalIconSmall, WarningIconSmall } from '../../lib/ui/icons/notifications'

export function SegmentMuteHeader({
	isDetached,
	isDetachedStick,
	segment,
	highlight,
	segmentNoteCounts,
	isLiveSegment,
	isNextSegment,
	isQueuedSegment,
	useTimeOfDayCountdowns,
	hasAlreadyPlayed,
	getSegmentContext,
	onHeaderNoteClick,
}: Readonly<{
	isDetached: boolean
	isDetachedStick: boolean
	segment: SegmentUi
	playlist: DBRundownPlaylist
	parts: Array<PartUi>
	segmentNoteCounts: SegmentNoteCounts
	highlight: boolean
	isLiveSegment: boolean
	isNextSegment: boolean
	isQueuedSegment: boolean
	useTimeOfDayCountdowns: boolean
	hasAlreadyPlayed: boolean
	showCountdownToSegment: boolean
	fixedSegmentDuration: boolean
	onSwitchViewMode?: (newViewMode: SegmentViewMode) => void
	onTimeUntilClick: () => void
	getSegmentContext: () => IContextMenuContext
	onHeaderNoteClick?: (segmentId: SegmentId, level: NoteSeverity) => void
}>): JSX.Element {
	const { t } = useTranslation()

	const criticalNotes = segmentNoteCounts.criticial
	const warningNotes = segmentNoteCounts.warning

	const contents = (
		<ContextMenuTrigger
			id="segment-timeline-context-menu"
			collect={getSegmentContext}
			attributes={{
				className: 'segment-opl__title segment-opl__muted',
			}}
			holdToDisplay={contextMenuHoldToDisplayTime()}
			renderTag="div"
		>
			<h2
				id={`segment-name-${segment._id}`}
				className={'segment-opl__title__label' + (segment.identifier ? ' identifier' : '')}
				data-identifier={segment.identifier}
			>
				{segment.name}
			</h2>
			{(criticalNotes > 0 || warningNotes > 0) && (
				<div className="segment-opl__notes">
					{criticalNotes > 0 && (
						<div
							className="segment-timeline__title__notes__note segment-timeline__title__notes__note--critical"
							onClick={() => onHeaderNoteClick && onHeaderNoteClick(segment._id, NoteSeverity.ERROR)}
							aria-label={t('Critical problems')}
						>
							<CriticalIconSmall />
							<div className="segment-timeline__title__notes__count">{criticalNotes}</div>
						</div>
					)}
					{warningNotes > 0 && (
						<div
							className="segment-timeline__title__notes__note segment-timeline__title__notes__note--warning"
							onClick={() => onHeaderNoteClick && onHeaderNoteClick(segment._id, NoteSeverity.WARNING)}
							aria-label={t('Warnings')}
						>
							<WarningIconSmall />
							<div className="segment-timeline__title__notes__count">{warningNotes}</div>
						</div>
					)}
				</div>
			)}
		</ContextMenuTrigger>
	)

	return (
		// <InView threshold={1} rootMargin={`-${getHeaderHeight()}px 0px 0px 0px`} onChange={onChange} as="div">
		<>
			{contents}
			{isDetached && (
				<div
					className={classNames('segment-opl__title-float-parent dark', {
						live: isLiveSegment,
						next: !isLiveSegment && isNextSegment,
						queued: isQueuedSegment,
						stick: isDetachedStick,

						'has-played': hasAlreadyPlayed && !isLiveSegment && !isNextSegment,

						'invert-flash': highlight,

						'time-of-day-countdowns': useTimeOfDayCountdowns,
					})}
				>
					{contents}
				</div>
			)}
		</>
		// </InView>
	)
}
