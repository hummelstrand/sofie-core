import React, { useEffect, useState } from 'react'
// @ts-expect-error No types available
import * as VelocityReact from 'velocity-react'

import {
	StudioRouteSet,
	StudioRouteBehavior,
	StudioRouteSetExclusivityGroup,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import { RewindAllSegmentsIcon } from '../../lib/ui/icons/rewindAllSegmentsIcon'

import { Lottie } from '@crello/react-lottie'
import { NotificationCenterPanelToggle } from '../../lib/notifications/NotificationCenterPanel'

// @ts-expect-error Not recognized by Typescript
import * as On_Air_MouseOut from './On_Air_MouseOut.json'
// @ts-expect-error Not recognized by Typescript
import * as On_Air_MouseOver from './On_Air_MouseOver.json'
import { SupportPopUpToggle } from '../SupportPopUp'
import classNames from 'classnames'
import { NoticeLevel } from '../../../lib/notifications/notifications'
import { SwitchboardIcon, RouteSetOverrideIcon } from '../../lib/ui/icons/switchboard'
import { SwitchboardPopUp } from './SwitchboardPopUp'
import { useTranslation } from 'react-i18next'
import { SegmentViewMode } from '../../lib/ui/icons/listView'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MediaStatusPopUp } from './MediaStatusPopUp'
import { MediaStatusIcon } from '../../lib/ui/icons/mediaStatus'
import {
	WrappedOverridableItemNormal,
	getAllCurrentAndDeletedItemsFromOverrides,
} from '../Settings/util/OverrideOpHelper'
import { ObjectWithOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

interface IProps {
	playlistId: RundownPlaylistId
	studioRouteSets: ObjectWithOverrides<Record<string, StudioRouteSet>>
	studioRouteSetExclusivityGroups: ObjectWithOverrides<Record<string, StudioRouteSetExclusivityGroup>>
	isFollowingOnAir: boolean
	onFollowOnAir?: () => void
	onRewindSegments?: () => void
	isNotificationCenterOpen: NoticeLevel | undefined
	isSupportPanelOpen: boolean
	isStudioMode: boolean
	onToggleNotifications?: (e: React.MouseEvent<HTMLButtonElement>, filter: NoticeLevel) => void
	onToggleSupportPanel?: (e: React.MouseEvent<HTMLButtonElement>) => void
	onTake?: (e: React.MouseEvent<HTMLButtonElement>) => void
	onStudioRouteSetSwitch?: (
		e: React.MouseEvent<HTMLElement>,
		routeSetId: string,
		routeSet: StudioRouteSet,
		state: boolean
	) => void
	onSegmentViewMode?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

const ANIMATION_TEMPLATE = {
	loop: false,
	autoplay: true,
	animationData: {},
	rendererSettings: {
		preserveAspectRatio: 'xMidYMid meet',
	},
}

const ONAIR_OUT = {
	...ANIMATION_TEMPLATE,
	animationData: On_Air_MouseOut,
}
const ONAIR_OVER = {
	...ANIMATION_TEMPLATE,
	animationData: On_Air_MouseOver,
}

export function RundownRightHandControls(props: Readonly<IProps>): JSX.Element {
	const { t } = useTranslation()
	const [onAirHover, setOnAirHover] = useState(false)
	const [switchboardOpen, setSwitchboardOpen] = useState(false)
	const [mediaStatusOpen, setMediaStatusOpen] = useState(false)

	const {
		onFollowOnAir: onOnAirClick,
		onRewindSegments: onRewindClick,
		onTake: onTakeClick,
		onSegmentViewMode: onSegmentViewModeClick,
	} = props

	useEffect(() => {
		if (onAirHover && props.isFollowingOnAir) {
			setOnAirHover(false)
		}
	}, [props.isFollowingOnAir, onAirHover])

	const onOnAirMouseEnter = () => {
		setOnAirHover(true)
	}

	const onOnAirMouseLeave = () => {
		setOnAirHover(false)
	}

	const onRouteSetsToggle = (_e: React.MouseEvent<HTMLButtonElement>) => {
		setSwitchboardOpen(!switchboardOpen)
		setMediaStatusOpen(false)
	}

	const onMediaStatusToggle = (_e: React.MouseEvent<HTMLButtonElement>) => {
		setMediaStatusOpen(!mediaStatusOpen)
		setSwitchboardOpen(false)
	}

	const availableRouteSets = getAllCurrentAndDeletedItemsFromOverrides(props.studioRouteSets, null).filter(
		(routeSet) => routeSet.computed?.behavior !== StudioRouteBehavior.HIDDEN && routeSet.type === 'normal'
	) as WrappedOverridableItemNormal<StudioRouteSet>[]

	const nonDefaultRoutes = availableRouteSets.filter(
		(routeSet) =>
			routeSet.computed?.defaultActive !== undefined && routeSet.computed?.active !== routeSet.computed?.defaultActive
	)

	const exclusivityGroups: Record<string, StudioRouteSet> = {}

	for (const routeSet of availableRouteSets) {
		const group = routeSet.computed?.exclusivityGroup || '__noGroup'
		if (!exclusivityGroups[group] === undefined && routeSet.computed) {
			exclusivityGroups[group] = routeSet.computed
		}
	}

	return (
		<div className="status-bar">
			<VelocityReact.VelocityTransitionGroup
				enter={{ animation: 'fadeIn', easing: 'ease-out', duration: 250 }}
				leave={{ animation: 'fadeOut', easing: 'ease-in', duration: 500 }}
				className="status-bar__cell status-bar__cell--align-start"
			>
				<NotificationCenterPanelToggle
					onClick={(e) => props.onToggleNotifications?.(e, NoticeLevel.CRITICAL)}
					isOpen={props.isNotificationCenterOpen === NoticeLevel.CRITICAL}
					filter={NoticeLevel.CRITICAL}
					className="type-critical"
					title={t('Critical Problems')}
				/>
				<NotificationCenterPanelToggle
					onClick={(e) => props.onToggleNotifications?.(e, NoticeLevel.WARNING)}
					isOpen={props.isNotificationCenterOpen === NoticeLevel.WARNING}
					filter={NoticeLevel.WARNING}
					className="type-warning"
					title={t('Warnings')}
				/>
				<NotificationCenterPanelToggle
					onClick={(e) => props.onToggleNotifications?.(e, NoticeLevel.NOTIFICATION | NoticeLevel.TIP)}
					isOpen={props.isNotificationCenterOpen === (NoticeLevel.NOTIFICATION | NoticeLevel.TIP)}
					filter={NoticeLevel.NOTIFICATION | NoticeLevel.TIP}
					className="type-notification"
					title={t('Notes')}
				/>
				<button
					className="status-bar__controls__button"
					role="button"
					onClick={onRewindClick}
					tabIndex={0}
					aria-label={t('Rewind all Segments')}
				>
					<RewindAllSegmentsIcon />
				</button>
				{!props.isFollowingOnAir && (
					<button
						className="status-bar__controls__button"
						role="button"
						onMouseEnter={onOnAirMouseEnter}
						onMouseLeave={onOnAirMouseLeave}
						onClick={onOnAirClick}
						tabIndex={0}
						aria-label={t('Go to On Air Segment')}
					>
						{onAirHover ? <Lottie config={ONAIR_OVER} /> : <Lottie config={ONAIR_OUT} />}
					</button>
				)}
			</VelocityReact.VelocityTransitionGroup>
			<VelocityReact.VelocityTransitionGroup
				enter={{ animation: 'fadeIn', easing: 'ease-out', duration: 250 }}
				leave={{ animation: 'fadeOut', easing: 'ease-in', duration: 500 }}
				className="status-bar__cell status-bar__cell--align-end"
			>
				{props.isStudioMode && (
					<button
						className="status-bar__controls__button status-bar__controls__button--take"
						role="button"
						onClick={onTakeClick}
						tabIndex={0}
						aria-label={t('Take')}
					>
						Take
					</button>
				)}
				<>
					<button
						className={classNames(
							'status-bar__controls__button',
							'status-bar__controls__button--media-status',
							'notifications-s notifications-text',
							{
								'status-bar__controls__button--open': mediaStatusOpen,
							}
						)}
						role="button"
						onClick={onMediaStatusToggle}
						tabIndex={0}
						aria-label={t('Media Status')}
						aria-haspopup="dialog"
						aria-pressed={mediaStatusOpen ? 'true' : 'false'}
					>
						<MediaStatusIcon />
					</button>
					<VelocityReact.VelocityTransitionGroup
						enter={{
							animation: {
								width: ['28rem', '0rem'],
							},
							easing: 'ease-out',
							duration: 300,
						}}
						leave={{
							animation: {
								width: ['0rem'],
							},
							easing: 'ease-in',
							duration: 500,
						}}
					>
						{mediaStatusOpen && <MediaStatusPopUp playlistId={props.playlistId} />}
					</VelocityReact.VelocityTransitionGroup>
				</>
				<button
					className="status-bar__controls__button status-bar__controls__button--segment-view-mode"
					role="button"
					onClick={onSegmentViewModeClick}
					tabIndex={0}
					aria-label={t('Switch Segment View Mode')}
				>
					<SegmentViewMode />
				</button>
				{props.isStudioMode &&
					props.studioRouteSets &&
					props.onStudioRouteSetSwitch &&
					availableRouteSets.length > 0 && (
						<>
							<button
								className={classNames(
									'status-bar__controls__button',
									'status-bar__controls__button--switchboard-panel',
									'notifications-s notifications-text',
									{
										'status-bar__controls__button--open': switchboardOpen,
									}
								)}
								role="button"
								onClick={onRouteSetsToggle}
								tabIndex={0}
								aria-label={t('Switchboard Panel')}
								aria-haspopup="dialog"
								aria-pressed={switchboardOpen ? 'true' : 'false'}
							>
								<SwitchboardIcon />
								{nonDefaultRoutes.length > 0 && (
									<RouteSetOverrideIcon className="status-bar__controls__button--switchboard-panel__notification" />
								)}
							</button>
							<VelocityReact.VelocityTransitionGroup
								enter={{
									animation: {
										width: ['28rem', '0rem'],
									},
									easing: 'ease-out',
									duration: 300,
								}}
								leave={{
									animation: {
										width: ['0rem'],
									},
									easing: 'ease-in',
									duration: 500,
								}}
							>
								{switchboardOpen && (
									<SwitchboardPopUp
										availableRouteSets={availableRouteSets}
										exclusivityGroups={exclusivityGroups}
										onStudioRouteSetSwitch={props.onStudioRouteSetSwitch}
									/>
								)}
							</VelocityReact.VelocityTransitionGroup>
						</>
					)}
				<SupportPopUpToggle
					onClick={props.onToggleSupportPanel}
					isOpen={props.isSupportPanelOpen}
					title={t('Toggle Support Panel')}
				/>
			</VelocityReact.VelocityTransitionGroup>
		</div>
	)
}
