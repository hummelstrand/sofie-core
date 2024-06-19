import * as React from 'react'
import { ISourceLayer, NoteSeverity } from '@sofie-automation/blueprints-integration'
import ClassNames from 'classnames'

import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { SegmentTimelineContainer } from './SegmentTimeline/SegmentTimelineContainer'
import { unprotectString } from '../../lib/lib'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { RundownLayoutFilterBase, RundownViewLayout } from '../../lib/collections/RundownLayouts'
import { VirtualElement } from '../lib/VirtualElement'
import { SEGMENT_TIMELINE_ELEMENT_ID } from './SegmentTimeline/SegmentTimeline'
import { PartInstance } from '../../lib/collections/PartInstances'
import { RundownDividerHeader } from './RundownView/RundownDividerHeader'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { BreakSegment } from './SegmentTimeline/BreakSegment'
import { SegmentStoryboardContainer } from './SegmentStoryboard/SegmentStoryboardContainer'
import { SegmentViewMode } from './SegmentContainer/SegmentViewModes'
import { SegmentListContainer } from './SegmentList/SegmentListContainer'
import { IResolvedSegmentProps, PieceUi } from './SegmentContainer/withResolvedSegment'
import { UIStudio } from '../../lib/api/studios'
import { RundownId, SegmentId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UIShowStyleBase } from '../../lib/api/showStyles'
import { SegmentScratchpadContainer } from './SegmentScratchpad/SegmentScratchpadContainer'
import { MatchedSegment } from './RundownView'

const DEFAULT_SEGMENT_VIEW_MODE = SegmentViewMode.Timeline

interface SegmentProps {
	studio: UIStudio | undefined
	showStyleBase: UIShowStyleBase | undefined
	playlist: DBRundownPlaylist
	matchedSegments: MatchedSegment[]
	rundownViewLayout: RundownViewLayout | undefined
	currentPartInstance: PartInstance | undefined
	nextPartInstance: PartInstance | undefined
	rundownPlaylist: DBRundownPlaylist
	studioMode: boolean
	segmentViewModes: { [segmentId: string]: SegmentViewMode }
	rundownDefaultSegmentViewMode: SegmentViewMode | undefined
	followLiveSegments: boolean
	timeScale: number
	rundownsToShowstyles: Map<RundownId, ShowStyleBaseId>
	onContextMenu: (contextMenuContext: any) => void
	onSegmentScroll: () => void
	onSelectPiece: (piece: PieceUi) => void | undefined
	onPieceDoubleClick: (item: PieceUi, e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
	onHeaderNoteClick: (segmentId: SegmentId, level: NoteSeverity) => void
	onSwitchViewMode: (segmentId: SegmentId, viewMode: SegmentViewMode) => void
	miniShelfFilter: RundownLayoutFilterBase | undefined
}

export function RenderSegments({
	studio,
	showStyleBase,
	playlist,
	matchedSegments,
	rundownViewLayout,
	currentPartInstance,
	nextPartInstance,
	studioMode,
	segmentViewModes,
	rundownDefaultSegmentViewMode,
	followLiveSegments,
	timeScale,
	onContextMenu,
	onSegmentScroll,
	rundownsToShowstyles,
	onSelectPiece,
	onPieceDoubleClick,
	onHeaderNoteClick,
	onSwitchViewMode,
	miniShelfFilter,
}: SegmentProps): React.ReactElement {
	if (!matchedSegments) {
		return <React.Fragment />
	}

	let globalIndex = 0
	const rundowns = matchedSegments.map((m) => m.rundown._id)

	return (
		<React.Fragment>
			{matchedSegments.map((rundownAndSegments, rundownIndex, rundownArray) => {
				let currentSegmentIndex = -1
				const rundownIdsBefore = rundowns.slice(0, rundownIndex)
				return (
					<React.Fragment key={unprotectString(rundownAndSegments.rundown._id)}>
						{matchedSegments.length > 1 && !rundownViewLayout?.hideRundownDivider && (
							<RundownDividerHeader
								key={`rundown_${rundownAndSegments.rundown._id}`}
								rundown={rundownAndSegments.rundown}
								playlist={playlist!}
							/>
						)}
						{rundownAndSegments.segments.map((segment, segmentIndex, segmentArray) => {
							if (studio && playlist && showStyleBase) {
								const ownCurrentPartInstance =
									// feed the currentPartInstance into the SegmentTimelineContainer component, if the currentPartInstance
									// is a part of the segment
									(currentPartInstance && currentPartInstance.segmentId === segment._id) ||
									// or the nextPartInstance is a part of this segment, and the currentPartInstance is autoNext
									(nextPartInstance &&
										nextPartInstance.segmentId === segment._id &&
										currentPartInstance &&
										currentPartInstance.part.autoNext)
										? currentPartInstance
										: undefined
								const ownNextPartInstance =
									nextPartInstance && nextPartInstance.segmentId === segment._id ? nextPartInstance : undefined

								if (ownCurrentPartInstance) {
									currentSegmentIndex = segmentIndex
								}

								const isFollowingOnAirSegment = segmentIndex === currentSegmentIndex + 1

								const isLastSegment =
									rundownIndex === rundownArray.length - 1 && segmentIndex === segmentArray.length - 1

								return (
									<ErrorBoundary key={unprotectString(segment._id)}>
										<VirtualElement
											className={ClassNames({
												'segment-timeline-wrapper--hidden': segment.isHidden,
												'segment-timeline-wrapper--shelf': segment.showShelf,
											})}
											id={SEGMENT_TIMELINE_ELEMENT_ID + segment._id}
											margin={'100% 0px 100% 0px'}
											initialShow={globalIndex++ < window.innerHeight / 260}
											placeholderHeight={260}
											placeholderClassName="placeholder-shimmer-element segment-timeline-placeholder"
											width="auto"
										>
											<RenderSegmentComponent
												studio={studio}
												_index={segmentIndex}
												showStyleBase={showStyleBase}
												rundownPlaylist={playlist}
												rundownAndSegments={rundownAndSegments}
												segment={segment}
												studioMode={studioMode}
												isLastSegment={isLastSegment}
												isFollowingOnAirSegment={isFollowingOnAirSegment}
												ownCurrentPartInstance={ownCurrentPartInstance}
												ownNextPartInstance={ownNextPartInstance}
												segmentIdsBeforeSegment={rundownAndSegments.segmentIdsBeforeEachSegment[segmentIndex]}
												rundownIdsBefore={rundownIdsBefore}
												segmentViewModes={segmentViewModes}
												rundownDefaultSegmentViewMode={rundownDefaultSegmentViewMode}
												rundownViewLayout={rundownViewLayout}
												followLiveSegments={followLiveSegments}
												timeScale={timeScale}
												onContextMenu={onContextMenu}
												onSegmentScroll={onSegmentScroll}
												rundownsToShowstyles={rundownsToShowstyles}
												onSelectPiece={onSelectPiece}
												onPieceDoubleClick={onPieceDoubleClick}
												onHeaderNoteClick={onHeaderNoteClick}
												onSwitchViewMode={onSwitchViewMode}
												miniShelfFilter={miniShelfFilter}
											/>
										</VirtualElement>
									</ErrorBoundary>
								)
							}
						})}
						{rundownViewLayout?.showBreaksAsSegments && rundownAndSegments.rundown.endOfRundownIsShowBreak && (
							<BreakSegment breakTime={PlaylistTiming.getExpectedEnd(rundownAndSegments.rundown.timing)} />
						)}
					</React.Fragment>
				)
			})}
		</React.Fragment>
	)
}

interface SegmentComponentProps {
	segment: DBSegment
	_index: number
	rundownAndSegments: MatchedSegment
	rundownPlaylist: DBRundownPlaylist
	studio: UIStudio
	studioMode: boolean
	showStyleBase: UIShowStyleBase
	isLastSegment: boolean
	isFollowingOnAirSegment: boolean
	ownCurrentPartInstance: PartInstance | undefined
	ownNextPartInstance: PartInstance | undefined
	segmentIdsBeforeSegment: Set<SegmentId>
	rundownIdsBefore: RundownId[]
	segmentViewModes: { [segmentId: string]: SegmentViewMode }
	rundownDefaultSegmentViewMode: SegmentViewMode | undefined
	rundownViewLayout: RundownViewLayout | undefined
	followLiveSegments: boolean
	timeScale: number
	onContextMenu: (contextMenuContext: any) => void
	onSegmentScroll: () => void
	rundownsToShowstyles: Map<RundownId, ShowStyleBaseId>
	onSelectPiece: (piece: PieceUi) => void
	onPieceDoubleClick: (item: PieceUi, e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
	onHeaderNoteClick: (segmentId: SegmentId, level: NoteSeverity) => void
	onSwitchViewMode: (segmentId: SegmentId, viewMode: SegmentViewMode) => void
	miniShelfFilter: RundownLayoutFilterBase | undefined
}

function RenderSegmentComponent({
	segment,
	studio,
	showStyleBase,
	rundownAndSegments,
	rundownPlaylist,
	studioMode,
	isLastSegment,
	isFollowingOnAirSegment,
	ownCurrentPartInstance,
	ownNextPartInstance,
	segmentIdsBeforeSegment,
	rundownIdsBefore,
	segmentViewModes,
	rundownDefaultSegmentViewMode,
	rundownViewLayout,
	followLiveSegments,
	timeScale,
	onContextMenu,
	onSegmentScroll,
	rundownsToShowstyles,
	onSelectPiece,
	onPieceDoubleClick,
	onHeaderNoteClick,
	onSwitchViewMode,
	miniShelfFilter,
}: SegmentComponentProps): React.ReactElement {
	const userSegmentViewMode = segmentViewModes[unprotectString(segment._id)] as SegmentViewMode | undefined
	const userRundownSegmentViewMode = rundownDefaultSegmentViewMode
	const displayMode =
		userSegmentViewMode ?? userRundownSegmentViewMode ?? segment.displayAs ?? DEFAULT_SEGMENT_VIEW_MODE

	const showDurationSourceLayers = rundownViewLayout?.showDurationSourceLayers
		? new Set<ISourceLayer['_id']>(rundownViewLayout?.showDurationSourceLayers)
		: undefined

	const resolvedSegmentProps: IResolvedSegmentProps & { id: string } = {
		id: SEGMENT_TIMELINE_ELEMENT_ID + segment._id,
		studio: studio,
		showStyleBase: showStyleBase,
		followLiveSegments: followLiveSegments,
		rundownViewLayout: rundownViewLayout,
		rundownId: rundownAndSegments.rundown._id,
		segmentId: segment._id,
		playlist: rundownPlaylist,
		rundown: rundownAndSegments.rundown,
		timeScale: timeScale,
		onContextMenu: onContextMenu,
		onSegmentScroll: onSegmentScroll,
		segmentsIdsBefore: segmentIdsBeforeSegment,
		rundownIdsBefore: rundownIdsBefore,
		rundownsToShowstyles: rundownsToShowstyles,
		isLastSegment: isLastSegment,
		onPieceClick: onSelectPiece,
		onPieceDoubleClick: onPieceDoubleClick,
		onHeaderNoteClick: onHeaderNoteClick,
		onSwitchViewMode: (viewMode) => onSwitchViewMode(segment._id, viewMode),
		ownCurrentPartInstance: ownCurrentPartInstance,
		ownNextPartInstance: ownNextPartInstance,
		isFollowingOnAirSegment: isFollowingOnAirSegment,
		miniShelfFilter: miniShelfFilter,
		countdownToSegmentRequireLayers: rundownViewLayout?.countdownToSegmentRequireLayers,
		fixedSegmentDuration: rundownViewLayout?.fixedSegmentDuration,
		studioMode: studioMode,
		showDurationSourceLayers: showDurationSourceLayers,
	}

	if (segment.orphaned === SegmentOrphanedReason.SCRATCHPAD) {
		return <SegmentScratchpadContainer {...resolvedSegmentProps} />
	}

	switch (displayMode) {
		case SegmentViewMode.Storyboard:
			return <SegmentStoryboardContainer {...resolvedSegmentProps} />
		case SegmentViewMode.List:
			return <SegmentListContainer {...resolvedSegmentProps} />
		case SegmentViewMode.Timeline:
		default:
			return <SegmentTimelineContainer {...resolvedSegmentProps} />
	}
}
