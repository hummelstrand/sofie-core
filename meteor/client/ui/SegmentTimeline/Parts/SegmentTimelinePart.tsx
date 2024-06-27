import React from 'react'
import { TFunction, useTranslation } from 'react-i18next'

import ClassNames from 'classnames'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { SegmentUi, PartUi, IOutputLayerUi, PieceUi, LIVE_LINE_TIME_PADDING } from '../SegmentTimelineContainer'
import { WithTiming } from '../../RundownView/RundownTiming/withTiming'
import { DEBUG_MODE } from '../SegmentTimelineDebugMode'

import { IContextMenuContext } from '../../RundownView'
import { CSSProperties } from '../../../styles/_cssVariables'
import RundownViewEventBus, {
	RundownViewEvents,
	HighlightEvent,
} from '../../../../lib/api/triggers/RundownViewEventBus'
import { LoopingIcon } from '../../../lib/ui/icons/looping'
import { SegmentEnd } from '../../../lib/ui/icons/segment'
import { getShowHiddenSourceLayers } from '../../../lib/localStorage'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { getPartInstanceTimingId, getPartInstanceTimingValue, RundownTimingContext } from '../../../lib/rundownTiming'
import { OutputGroup } from './OutputGroup'
import { InvalidPartCover } from './InvalidPartCover'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { UIStudio } from '../../../../lib/api/studios'
import { CalculateTimingsPiece } from '@sofie-automation/corelib/dist/playout/timings'
import { getCurrentTime, unprotectString } from '../../../../lib/lib'
import { RundownUtils } from '../../../lib/rundown'

export const SegmentTimelineLineElementId = 'rundown__segment__line__'
export const SegmentTimelinePartElementId = 'rundown__segment__part__'

/** The width at which a Part is too small to attempt displaying text labels on Pieces, in pixels */
export const BREAKPOINT_TOO_SMALL_FOR_TEXT = 30

/** The width at whcih a Part is too small to be drawn at all, in pixels */
export const BREAKPOINT_TOO_SMALL_FOR_DISPLAY = 6

interface IProps {
	segment: SegmentUi
	playlist: DBRundownPlaylist
	studio: UIStudio
	part: PartUi
	pieces: CalculateTimingsPiece[]
	timeToPixelRatio: number
	onCollapseOutputToggle?: (layer: IOutputLayerUi, event: any) => void
	collapsedOutputs: {
		[key: string]: boolean
	}
	isCollapsed?: boolean
	scrollLeft: number
	scrollWidth: number
	onScroll?: (scrollLeft: number, event: any) => void
	onFollowLiveLine?: (state: boolean, event: any) => void
	onPieceClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPartTooSmallChanged?: (part: PartUi, displayDuration: number | false, expectedDuration: number | false) => void
	followLiveLine: boolean
	autoNextPart: boolean
	liveLineHistorySize: number
	livePosition: number | null
	totalSegmentDuration?: number
	firstPartInSegment?: PartUi
	lastPartInSegment?: PartUi
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	isLastInSegment: boolean
	isAfterLastValidInSegmentAndItsLive: boolean
	isLastSegment: boolean
	isBudgetGap?: boolean
	isPreview?: boolean
	cropDuration?: number
	className?: string
	showDurationSourceLayers?: Set<ISourceLayer['_id']>
	isLiveSegment: boolean | undefined
	anyPriorPartWasLive: boolean | undefined
	livePartStartsAt: number | undefined
	livePartDisplayDuration: number | undefined
	budgetDuration: number | undefined
}

interface IState {
	isLive: boolean
	isNext: boolean
	isDurationSettling: boolean
	durationSettlingStartsAt: number
	liveDuration: number

	isInsideViewport: boolean
	isTooSmallForText: boolean
	isTooSmallForDisplay: boolean
	highlight: boolean
}
export const SegmentTimelinePart: React.FC<WithTiming<IProps>> = (props) => {
	const { t } = useTranslation()

	// Calculate initial state
	const getInitialState = (): IState => {
		const partInstance = props.part.instance
		const isLive = props.playlist.currentPartInfo?.partInstanceId === partInstance._id
		const isNext = props.playlist.nextPartInfo?.partInstanceId === partInstance._id
		const startedPlayback = partInstance.timings?.plannedStartedPlayback

		const liveDuration = isLive
			? Math.max(
					(startedPlayback &&
						props.timingDurations.partDurations &&
						getCurrentLiveLinePosition(props.part, props.timingDurations.currentTime || getCurrentTime()) +
							getLiveLineTimePadding(props.timeToPixelRatio)) ||
						0,
					props.timingDurations.partDurations
						? partInstance.part.displayDuration ||
								props.timingDurations.partDurations[getPartInstanceTimingId(partInstance)]
						: 0
			  )
			: 0

		return {
			isLive,
			isNext,
			isDurationSettling: false,
			durationSettlingStartsAt: 0,
			isInsideViewport: false,
			isTooSmallForText: false,
			isTooSmallForDisplay: false,
			highlight: false,
			liveDuration,
		}
	}

	function derivedState(): Partial<IState> {
		const isPrevious = props.playlist.previousPartInfo?.partInstanceId === props.part.instance._id
		const isLive = props.playlist.currentPartInfo?.partInstanceId === props.part.instance._id
		const isNext = props.playlist.nextPartInfo?.partInstanceId === props.part.instance._id

		const nextPartInstance = props.part.instance

		console.log(props.part.partId)

		const startedPlayback = props.part.instance.timings?.plannedStartedPlayback

		const isDurationSettling =
			!!props.playlist.activationId &&
			isPrevious &&
			!isLive &&
			!!startedPlayback &&
			!props.part.instance.timings?.duration

		let durationSettlingStartsAt = state.durationSettlingStartsAt
		if (!state.isDurationSettling && isDurationSettling) {
			durationSettlingStartsAt = getCurrentLiveLinePosition(
				props.part,
				props.timingDurations.currentTime || getCurrentTime()
			)
		}

		let liveDuration = 0
		if (!isDurationSettling) {
			if (isLive && !props.autoNextPart && !nextPartInstance.part.autoNext) {
				liveDuration = Math.max(
					(startedPlayback &&
						props.timingDurations.partDurations &&
						getCurrentLiveLinePosition(props.part, props.timingDurations.currentTime || getCurrentTime()) +
							getLiveLineTimePadding(props.timeToPixelRatio)) ||
						0,
					props.timingDurations.partDurations
						? nextPartInstance.part.displayDuration ||
								props.timingDurations.partDurations[getPartInstanceTimingId(nextPartInstance)]
						: 0
				)
			}
			durationSettlingStartsAt = 0
		}

		const partDisplayDuration = getPartDuration(props, liveDuration, isDurationSettling, durationSettlingStartsAt)

		const isInsideViewport =
			isLive ||
			RundownUtils.isInsideViewport(
				props.scrollLeft,
				props.scrollWidth,
				props.part,
				props.pieces,
				getPartStartsAt(props),
				partDisplayDuration
			)

		const partDisplayWidth = partDisplayDuration * props.timeToPixelRatio
		const isTooSmallForText = !isLive && partDisplayWidth < BREAKPOINT_TOO_SMALL_FOR_TEXT
		const isTooSmallForDisplay = !isLive && partDisplayWidth < BREAKPOINT_TOO_SMALL_FOR_DISPLAY

		return {
			isLive,
			isNext,
			isDurationSettling,
			durationSettlingStartsAt,
			liveDuration,
			isInsideViewport,
			isTooSmallForText,
			isTooSmallForDisplay,
		}
	}

	const [state, setState] = React.useState<IState>(getInitialState())

	const updateDerivedState = React.useCallback(() => {
		setState((prevState) => ({ ...prevState, ...derivedState() }))
	}, [props])

	React.useEffect(() => {
		updateDerivedState()
	}, [updateDerivedState])

	React.useEffect(() => {
		const onHighlight = (e: HighlightEvent) => {
			if (e && e.partId === props.part.partId && !e.pieceId) {
				setState((prevState) => ({ ...prevState, highlight: true }))
				const timeout = setTimeout(() => {
					setState((prevState) => ({ ...prevState, highlight: false }))
				}, 5000)
				return () => clearTimeout(timeout)
			}
		}

		RundownViewEventBus.on(RundownViewEvents.HIGHLIGHT, onHighlight)
		return () => {
			RundownViewEventBus.off(RundownViewEvents.HIGHLIGHT, onHighlight)
		}
	}, [props.part.partId])

	React.useEffect(() => {
		const tooSmallState = state.isTooSmallForDisplay || state.isTooSmallForText
		if (tooSmallState) {
			props.onPartTooSmallChanged?.(
				props.part,
				getPartDuration(props, state.liveDuration, state.isDurationSettling, state.durationSettlingStartsAt),
				getPartActualDuration(props.part, props.timingDurations)
			)
		}
	}, [state.isTooSmallForDisplay, state.isTooSmallForText])

	function getLayerStyle(): React.CSSProperties {
		let partDuration: number
		if (props.isBudgetGap && typeof props.budgetDuration === 'number') {
			partDuration = props.budgetDuration - getPartStartsAt(props)
		} else {
			const partDisplayDuration = getPartDisplayDuration(props.part, props.timingDurations)
			partDuration = props.cropDuration ? Math.min(props.cropDuration, partDisplayDuration) : partDisplayDuration
		}

		const futureShadeDuration =
			state.isLive || (props.isBudgetGap && props.isLiveSegment) ? getFutureShadePaddingTime() : 0
		const partDurationWithFutureShadeAccountedFor = props.isBudgetGap
			? partDuration - futureShadeDuration
			: partDuration + futureShadeDuration

		return {
			width: (partDurationWithFutureShadeAccountedFor * props.timeToPixelRatio).toString() + 'px',
		}
	}

	const convertTimeToPixels = (time: number) => {
		return props.timeToPixelRatio * time
	}
	function getPartStyle(): React.CSSProperties {
		const style = getLayerStyle()

		let timeOffset = getPartStartsAt(props)
		if (props.isLiveSegment && props.anyPriorPartWasLive && !state.isLive) {
			timeOffset += getFutureShadePaddingTime()
		}

		const liveWillChangeValue = `transform, width`

		return {
			...style,
			transform: `translateX(${convertTimeToPixels(timeOffset)}px)`,
			willChange: props.isLiveSegment ? liveWillChangeValue : 'none',
		}
	}

	function renderTimelineOutputGroups(part: PartUi) {
		if (props.segment.outputLayers !== undefined) {
			const showHiddenSourceLayers = getShowHiddenSourceLayers()

			let indexAccumulator = 0

			return Object.values<IOutputLayerUi>(props.segment.outputLayers)
				.filter((layer) => {
					return layer.used ? true : false
				})
				.sort((a, b) => {
					return a._rank - b._rank
				})
				.map((layer) => {
					// Only render output layers used by the segment
					if (layer.used) {
						const sourceLayers = layer.sourceLayers
							.filter((i) => showHiddenSourceLayers || !i.isHidden)
							.sort((a, b) => a._rank - b._rank)
						const currentIndex = indexAccumulator
						const isCollapsed =
							props.collapsedOutputs[layer._id] !== undefined
								? props.collapsedOutputs[layer._id] === true
								: layer.isDefaultCollapsed
						const isFlattened = layer.collapsed || false

						indexAccumulator += isFlattened || isCollapsed ? 1 : sourceLayers.length
						return (
							<OutputGroup
								key={layer._id}
								collapsedOutputs={props.collapsedOutputs}
								followLiveLine={props.followLiveLine}
								liveLineHistorySize={props.liveLineHistorySize}
								livePosition={props.livePosition}
								onContextMenu={props.onContextMenu}
								onFollowLiveLine={props.onFollowLiveLine}
								onPieceClick={props.onPieceClick}
								onPieceDoubleClick={props.onPieceDoubleClick}
								scrollLeft={props.scrollLeft}
								scrollWidth={props.scrollWidth}
								layer={layer}
								sourceLayers={sourceLayers}
								segment={props.segment}
								part={part}
								pieces={props.pieces}
								playlist={props.playlist}
								studio={props.studio}
								startsAt={getPartStartsAt(props) || props.part.startsAt || 0}
								duration={
									props.cropDuration
										? Math.min(
												props.cropDuration,
												getPartDuration(
													props,
													state.liveDuration,
													state.isDurationSettling,
													state.durationSettlingStartsAt
												)
										  )
										: getPartDuration(
												props,
												state.liveDuration,
												state.isDurationSettling,
												state.durationSettlingStartsAt
										  )
								}
								displayDuration={getPartDisplayDuration(props.part, props.timingDurations)}
								isLiveLine={props.playlist.currentPartInfo?.partInstanceId === part.instance._id}
								isNextLine={props.playlist.nextPartInfo?.partInstanceId === part.instance._id}
								isTooSmallForText={state.isTooSmallForText}
								timeScale={props.timeToPixelRatio}
								autoNextPart={props.autoNextPart}
								liveLinePadding={getLiveLineTimePadding(props.timeToPixelRatio)}
								indexOffset={currentIndex}
								isPreview={props.isPreview || false}
								showDurationSourceLayers={props.showDurationSourceLayers}
							/>
						)
					}
				})
		}
	}

	const getFutureShadePaddingTime = () => {
		if (props.autoNextPart) {
			return 0
		}

		/**
		 * How far into the live part we are, in milliseconds.
		 */
		const timeIntoLivePart = Math.max(0, (props.livePosition || 0) - (props.livePartStartsAt || 0))

		/**
		 * The maximum amount of live line time padding to add, in milliseconds.
		 */
		const maxPadding = getLiveLineTimePadding(props.timeToPixelRatio)

		/**
		 * The amount of live line time padding to add, based on some simple math, in milliseconds.
		 */
		const computedPadding = Math.max(0, timeIntoLivePart + maxPadding - (props.livePartDisplayDuration || 0))

		return Math.min(computedPadding, maxPadding)
	}

	const getFutureShadePaddingPixels = () => {
		return getFutureShadePaddingTime() * props.timeToPixelRatio
	}

	const getFutureShadeStyle = () => {
		return {
			width: getFutureShadePaddingPixels() + 'px',
		}
	}

	const renderEndOfSegment = (t: TFunction, innerPart: DBPart, isEndOfShow: boolean, isEndOfLoopingShow?: boolean) => {
		const isNext =
			state.isLive &&
			((!props.isLastSegment && !props.isLastInSegment) || !!props.playlist.nextPartInfo) &&
			!innerPart.invalid
		let timeOffset = getPartDisplayDuration(props.part, props.timingDurations)
		if (state.isLive) {
			timeOffset += getFutureShadePaddingTime()
		}
		return (
			<div
				className={ClassNames('segment-timeline__part__end-of-segment', { 'is-live': state.isLive })}
				style={{
					transform: `translateX(${convertTimeToPixels(timeOffset)}px)`,
				}}
			>
				{props.isLastInSegment && !props.isBudgetGap && (
					<div
						className={ClassNames('segment-timeline__part__nextline', 'segment-timeline__part__nextline--endline', {
							'auto-next': innerPart.autoNext,
							'is-next': isNext,
							'show-end': isEndOfShow,
						})}
					>
						<div
							className={ClassNames('segment-timeline__part__nextline__label', {
								'segment-timeline__part__nextline__label--thin': innerPart.autoNext && !state.isLive,
							})}
						>
							{innerPart.autoNext ? t('Auto') : state.isLive ? t('Next') : null}
							{isEndOfLoopingShow && <LoopingIcon />}
						</div>
					</div>
				)}
				{!isEndOfShow && props.isLastInSegment && !innerPart.invalid && (
					<div
						className={ClassNames('segment-timeline__part__segment-end', {
							'is-next': isNext,
						})}
					>
						<div className="segment-timeline__part__segment-end__label">
							<SegmentEnd />
						</div>
					</div>
				)}
				{isEndOfShow && (
					<div
						className={ClassNames('segment-timeline__part__show-end', {
							loop: props.playlist.loop,
						})}
					>
						<div className="segment-timeline__part__show-end__label">
							{props.playlist.loop ? t('Loops to top') : t('Show End')}
						</div>
					</div>
				)}
			</div>
		)
	}

	function convertHexToRgb(hexColor: string): { red: number; green: number; blue: number } | undefined {
		if (hexColor.substr(0, 1) !== '#') return
		if (hexColor.length !== 7) return

		const red = parseInt(hexColor.substr(1, 2), 16)
		const green = parseInt(hexColor.substr(3, 2), 16)
		const blue = parseInt(hexColor.substr(5, 2), 16)

		return { red, green, blue }
	}

	// optimize early, if not inside viewport
	if (!state.isInsideViewport) {
		return null
	}

	const innerPart = props.part.instance.part

	const isEndOfShow =
		props.isLastSegment && props.isLastInSegment && (!state.isLive || (state.isLive && !props.playlist.nextPartInfo))
	const isEndOfLoopingShow = props.isLastSegment && props.isLastInSegment && props.playlist.loop
	let invalidReasonColorVars: CSSProperties | undefined = undefined
	if (innerPart.invalidReason && innerPart.invalidReason?.color) {
		const invalidColor = convertHexToRgb(innerPart.invalidReason.color)
		if (invalidColor) {
			invalidReasonColorVars = {
				['--invalid-reason-color-opaque']: `rgba(${invalidColor.red}, ${invalidColor.green}, ${invalidColor.blue}, 1)`,
				['--invalid-reason-color-transparent']: `rgba(${invalidColor.red}, ${invalidColor.green}, ${invalidColor.blue}, 0)`,
			}
		}
	}
	// const [{ isDragging }, drag] = useDrag(() => ({
	// 	type: 'ITEM',
	// 	item: { id: props.part.partId },
	// 	collect: (monitor) => ({
	// 		isDragging: !!monitor.isDragging(),
	// 	}),
	// }))
	const partHtmlRef: React.MutableRefObject<HTMLDivElement | null> = React.createRef<HTMLDivElement>()
	//props.partHtmlRefs[index] = partHtmlRef

	if (state.isInsideViewport && (!state.isTooSmallForDisplay || state.isLive || state.isNext || props.isBudgetGap)) {
		return (
			<div
				key={unprotectString(props.part.partId)}
				ref={(node) => {
					//drag(node)
					if (node && node !== null) {
						partHtmlRef.current = node
					}
				}}
				data-key={props.part.partId}
				//style={{ opacity: isDragging ? 0.5 : 1 }}
			>
				<div
					className={ClassNames(
						'segment-timeline__part',
						{
							live: state.isLive,
							next: (state.isNext || props.isAfterLastValidInSegmentAndItsLive) && !innerPart.invalid,
							invalid: innerPart.invalid && !innerPart.gap,
							floated: innerPart.floated,
							gap: innerPart.gap,
							'invert-flash': state.highlight,

							'duration-settling': state.isDurationSettling,
							'budget-gap': props.isBudgetGap,
						},
						props.className
					)}
					data-obj-id={props.part.instance._id}
					id={SegmentTimelinePartElementId + props.part.instance._id}
					style={{ ...getPartStyle(), ...invalidReasonColorVars }}
					role="region"
					aria-roledescription={t('part')}
					aria-label={props.part.instance.part.title}
				>
					{DEBUG_MODE && (
						<div className="segment-timeline__debug-info">
							{props.livePosition} / {props.part.startsAt} /{' '}
							{
								((props.timingDurations || { partStartsAt: {} }).partStartsAt || {})[
									getPartInstanceTimingId(props.part.instance)
								]
							}
						</div>
					)}
					{renderTimelineOutputGroups(props.part)}
					{innerPart.invalid ? (
						<InvalidPartCover className="segment-timeline__part__invalid-cover" part={innerPart} />
					) : null}
					{innerPart.floated ? <div className="segment-timeline__part__floated-cover"></div> : null}

					{props.playlist.nextTimeOffset &&
						state.isNext && ( // This is the off-set line
							<div
								className={ClassNames('segment-timeline__part__nextline', {
									// This is the base, basic line
									'auto-next':
										!innerPart.invalid &&
										!innerPart.gap &&
										((state.isNext && props.autoNextPart) || (!state.isNext && props.part.willProbablyAutoNext)),
									invalid: innerPart.invalid && !innerPart.gap,
									floated: innerPart.floated,
								})}
								style={{
									left: Math.round(props.playlist.nextTimeOffset * props.timeToPixelRatio) + 'px',
								}}
							>
								<div
									className={ClassNames('segment-timeline__part__nextline__label', {
										'segment-timeline__part__nextline__label--thin':
											(props.autoNextPart || props.part.willProbablyAutoNext) && !state.isNext,
									})}
								>
									{innerPart.invalid && !innerPart.gap ? null : (
										<React.Fragment>
											{props.autoNextPart || props.part.willProbablyAutoNext
												? t('Auto')
												: state.isNext
												? t('Next')
												: null}
										</React.Fragment>
									)}
								</div>
							</div>
						)}
					{state.isLive && !props.autoNextPart && !innerPart.autoNext && (
						<div className="segment-timeline__part__future-shade" style={getFutureShadeStyle()}></div>
					)}
					{!props.isBudgetGap && (
						<div
							className={ClassNames('segment-timeline__part__nextline', {
								// This is the base, basic line
								'auto-next': (state.isNext && props.autoNextPart) || (!state.isNext && props.part.willProbablyAutoNext),
								invalid: innerPart.invalid && !innerPart.gap,
								floated: innerPart.floated,
								offset: !!props.playlist.nextTimeOffset,
							})}
						>
							<div
								className={ClassNames('segment-timeline__part__nextline__label', {
									'segment-timeline__part__nextline__label--thin':
										(props.autoNextPart || props.part.willProbablyAutoNext) && !state.isNext,
								})}
							>
								{innerPart.invalid && !innerPart.gap ? null : (
									<React.Fragment>
										{(state.isNext && props.autoNextPart) || (!state.isNext && props.part.willProbablyAutoNext)
											? t('Auto')
											: state.isNext || props.isAfterLastValidInSegmentAndItsLive
											? t('Next')
											: null}
									</React.Fragment>
								)}
								{props.isAfterLastValidInSegmentAndItsLive && !props.playlist.loop && <SegmentEnd />}
								{props.isAfterLastValidInSegmentAndItsLive && props.playlist.loop && <LoopingIcon />}
							</div>
							{!props.isPreview && props.part.instance.part.identifier && (
								<div className="segment-timeline__identifier">{props.part.instance.part.identifier}</div>
							)}
						</div>
					)}
					{renderEndOfSegment(t, innerPart, isEndOfShow, isEndOfLoopingShow)}
				</div>
			</div>
		)
	} else {
		// render placeholders
		return (
			<div
				className={ClassNames(
					'segment-timeline__part',
					{
						'segment-timeline__part--too-small': state.isInsideViewport,
						live: state.isLive,
						next: state.isNext,
					},
					props.className
				)}
				data-obj-id={props.part.instance._id}
				style={getPartStyle()}
			>
				{/* render it empty, just to take up space */}
				{state.isInsideViewport ? renderEndOfSegment(t, innerPart, isEndOfShow, isEndOfLoopingShow) : null}
			</div>
		)
	}
}

export function getPartDisplayDuration(part: PartUi, timingDurations: RundownTimingContext): number {
	return (
		(timingDurations?.partDisplayDurations &&
			timingDurations.partDisplayDurations[getPartInstanceTimingId(part.instance)]) ||
		part.renderedDuration ||
		0
	)
}

export function getLiveLineTimePadding(timeScale: number): number {
	return timeScale === 0 ? 0 : LIVE_LINE_TIME_PADDING / timeScale
}

export function getCurrentLiveLinePosition(part: Readonly<PartUi>, currentTime: number): number {
	if (part.instance.timings?.plannedStartedPlayback) {
		if (part.instance.timings?.duration) {
			return part.instance.timings.duration
		} else {
			return currentTime - part.instance.timings.plannedStartedPlayback
		}
	} else {
		return 0
	}
}

function getPartDuration(
	props: WithTiming<IProps>,
	liveDuration: number,
	isDurationSettling: boolean,
	durationSettlingStartsAt: number
): number {
	if (isDurationSettling) {
		return durationSettlingStartsAt
	}
	return Math.max(!props.isPreview ? liveDuration : 0, getPartDisplayDuration(props.part, props.timingDurations))
}

function getPartActualDuration(part: PartUi, timingDurations: RundownTimingContext): number {
	return timingDurations?.partDurations?.[getPartInstanceTimingId(part.instance)] ?? part.renderedDuration
}

function getPartStartsAt(props: WithTiming<IProps>): number {
	if (props.isBudgetGap) {
		return Math.max(
			0,
			(props.lastPartInSegment &&
				props.firstPartInSegment &&
				(getPartInstanceTimingValue(props.timingDurations.partDisplayStartsAt, props.lastPartInSegment.instance) ?? 0) -
					(getPartInstanceTimingValue(props.timingDurations.partDisplayStartsAt, props.firstPartInSegment.instance) ??
						0) +
					(getPartInstanceTimingValue(props.timingDurations.partDisplayDurations, props.lastPartInSegment.instance) ??
						0)) ||
				0
		)
	}
	return Math.max(
		0,
		(props.firstPartInSegment &&
			(getPartInstanceTimingValue(props.timingDurations.partDisplayStartsAt, props.part.instance) ?? 0) -
				(getPartInstanceTimingValue(props.timingDurations.partDisplayStartsAt, props.firstPartInSegment.instance) ??
					0)) ||
			0
	)
}
