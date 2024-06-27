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
import { DndProvider, DropTargetMonitor, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { doModalDialog } from '../lib/ModalDialog'
import { i18nTranslator } from './i18n'
import { UserAction } from '../../lib/userAction'
import { doUserAction } from '../../lib/clientUserAction'
import { MeteorCall } from '../../lib/api/methods'

const DEFAULT_SEGMENT_VIEW_MODE = SegmentViewMode.Timeline

const DropSegmentTarget = ({ children, onDrop }) => {
	const [{ isOver }, drop] = useDrop({
		accept: 'ITEM',
		drop: (item, monitor) => {
			const didDrop = monitor.didDrop()
			if (!didDrop) {
				onDrop(item.id, monitor)
			}
		},
		collect: (monitor) => ({
			isOver: !!monitor.isOver(),
		}),
	})

	return (
		<div ref={drop} style={{ backgroundColor: isOver ? 'grey' : 'transparent' }}>
			{children}
		</div>
	)
}

interface SegmentsParseProps {
	rundownPlaylist: DBRundownPlaylist
	studio: UIStudio
	studioMode: boolean
	showStyleBase: UIShowStyleBase
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

interface SegmentProps extends SegmentsParseProps {
	playlist: DBRundownPlaylist
	matchedSegments: MatchedSegment[]
	currentPartInstance: PartInstance | undefined
	nextPartInstance: PartInstance | undefined
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
}: SegmentProps): React.JSX.Element {
	const t = i18nTranslator
	if (!matchedSegments) {
		return <React.Fragment />
	}

	const segmentHtmlRefs: React.MutableRefObject<HTMLDivElement | null>[] = []
	const segmentPartHtmlRefs: React.MutableRefObject<HTMLDivElement | null>[][] = [[]]

	const handleSegmentDrop = (draggedSegmentId: string, monitor: DropTargetMonitor<unknown, unknown>) => {
		// ToDo - handle multiple rundowns in playlist
		// matchedSegments.length > 1
		// ......

		const clientOffset = monitor.getClientOffset()

		// Debugging:
		const draggedSegmentName =
			matchedSegments[0].segments[
				matchedSegments[0].segments.findIndex((segment) => segment.externalId === draggedSegmentId)
			].name

		// Debugging:
		const draggedSegmentIndex = matchedSegments[0].segments.findIndex(
			(segment) => segment.externalId === draggedSegmentId
		)

		// Find the segment that the dragged item is dropped after
		const segmentDroppedAfterIndex = matchedSegments[0].segments.findIndex((segment) => {
			const segmentRef = segmentHtmlRefs.find((ref) => ref.current?.getAttribute('data-key') === segment.externalId)
			if (!segmentRef?.current) return false

			const segmentRect = segmentRef.current.getBoundingClientRect()
			if (!clientOffset || !segmentRect) {
				return false
			}
			return (
				clientOffset.y >= segmentRect.top &&
				clientOffset.y < segmentRect.bottom &&
				clientOffset.x >= segmentRect.left &&
				clientOffset.x < segmentRect.right
			)
		})

		if (segmentDroppedAfterIndex === -1) return

		const segmentDroppedAfterId = matchedSegments[0].segments[segmentDroppedAfterIndex].externalId

		// Debugging:
		const segmentDroppedAfterName = matchedSegments[0].segments[segmentDroppedAfterIndex].name
		doModalDialog({
			title: t('Reorder Segments'),
			message: t(
				`Index: ${draggedSegmentIndex} - ${draggedSegmentName} ${
					draggedSegmentId.split(';')[1]
				} is moved to after index: ${segmentDroppedAfterIndex} - ${segmentDroppedAfterName} ${
					segmentDroppedAfterId.split(';')[1]
				}`,
				//`Are you sure you want to move this segment to this position? This will affect the order of the segments in the playlist.`,
				{
					draggedSegmentId: draggedSegmentId,
				}
			),
			yes: t('Reorder Segments'),
			no: t('Cancel'),
			actions: [],
			warning: true,
			onAccept: (e) => {
				doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
					MeteorCall.userAction.executeUserChangeOperation(
						e,
						ts,
						matchedSegments[0].rundown._id,
						{
							segmentExternalId: draggedSegmentId,
							partExternalId: undefined,
							pieceExternalId: undefined,
						},
						{
							id: '__sofie-move-segment',
							payload: {
								moveId: draggedSegmentId,
								afterId: segmentDroppedAfterId,
							},
						}
					)
				)
			},
		})
	}

	let globalIndex = 0
	const rundowns = matchedSegments.map((m) => m.rundown._id)

	return (
		<DropSegmentTarget onDrop={handleSegmentDrop}>
			<DndProvider backend={HTML5Backend}>
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

									const segmentHtmlRef: React.MutableRefObject<HTMLDivElement | null> =
										React.createRef<HTMLDivElement>()
									segmentHtmlRefs[segmentIndex] = segmentHtmlRef
									globalIndex++

									return (
										<RenderSegmentComponent
											key={unprotectString(segment._id)}
											partHtmlRefs={segmentPartHtmlRefs[segmentIndex]}
											_index={segmentIndex}
											globalIndex={globalIndex}
											segmentHtmlRef={segmentHtmlRef}
											segment={segment}
											studio={studio}
											showStyleBase={showStyleBase}
											rundownAndSegments={rundownAndSegments}
											rundownPlaylist={playlist}
											studioMode={studioMode}
											isLastSegment={isLastSegment}
											isFollowingOnAirSegment={isFollowingOnAirSegment}
											ownCurrentPartInstance={ownCurrentPartInstance}
											ownNextPartInstance={ownNextPartInstance}
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
									)
								}
							})}
							{rundownViewLayout?.showBreaksAsSegments && rundownAndSegments.rundown.endOfRundownIsShowBreak && (
								<BreakSegment breakTime={PlaylistTiming.getExpectedEnd(rundownAndSegments.rundown.timing)} />
							)}
						</React.Fragment>
					)
				})}
			</DndProvider>
		</DropSegmentTarget>
	)
}

interface SegmentComponentProps extends SegmentsParseProps {
	segment: DBSegment
	globalIndex: number
	segmentHtmlRef: React.MutableRefObject<HTMLDivElement | null>
	partHtmlRefs: React.MutableRefObject<HTMLDivElement | null>[]
	_index: number
	rundownAndSegments: MatchedSegment
	isLastSegment: boolean
	isFollowingOnAirSegment: boolean
	ownCurrentPartInstance: PartInstance | undefined
	ownNextPartInstance: PartInstance | undefined
	rundownIdsBefore: RundownId[]
}

function RenderSegmentComponent({
	_index,
	globalIndex,
	segmentHtmlRef,
	partHtmlRefs,
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
	const [{ isDragging }, drag] = useDrag(() => ({
		type: 'ITEM',
		item: { id: segment.externalId },
		collect: (monitor) => ({
			isDragging: !!monitor.isDragging(),
		}),
	}))

	const userSegmentViewMode = segmentViewModes[unprotectString(segment._id)] as SegmentViewMode | undefined
	const userRundownSegmentViewMode = rundownDefaultSegmentViewMode
	const displayMode =
		userSegmentViewMode ?? userRundownSegmentViewMode ?? segment.displayAs ?? DEFAULT_SEGMENT_VIEW_MODE

	const showDurationSourceLayers = rundownViewLayout?.showDurationSourceLayers
		? new Set<ISourceLayer['_id']>(rundownViewLayout?.showDurationSourceLayers)
		: undefined

	const resolvedSegmentProps: IResolvedSegmentProps & {
		id: string
		partHtmlRefs: React.MutableRefObject<HTMLDivElement | null>[]
	} = {
		id: SEGMENT_TIMELINE_ELEMENT_ID + segment._id,
		partHtmlRefs: partHtmlRefs,
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
		segmentsIdsBefore: rundownAndSegments.segmentIdsBeforeEachSegment[_index],
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

	return (
		<div
			key={unprotectString(segment._id)}
			ref={(node) => {
				drag(node)
				if (node && node !== null) {
					segmentHtmlRef.current = node
					//segmentRefs.current[segmentIndex] = node
					// return setSegmentRef(node, segmentIndex)
				}
			}}
			data-key={segment.externalId}
			style={{ opacity: isDragging ? 0.5 : 1 }}
		>
			<ErrorBoundary>
				<VirtualElement
					className={ClassNames({
						'segment-timeline-wrapper--hidden': segment.isHidden,
						'segment-timeline-wrapper--shelf': segment.showShelf,
					})}
					id={SEGMENT_TIMELINE_ELEMENT_ID + segment._id}
					margin={'100% 0px 100% 0px'}
					initialShow={globalIndex < window.innerHeight / 260}
					placeholderHeight={260}
					placeholderClassName="placeholder-shimmer-element segment-timeline-placeholder"
					width="auto"
				>
					{((): React.ReactNode => {
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
					})()}
				</VirtualElement>
			</ErrorBoundary>
		</div>
	)
}
