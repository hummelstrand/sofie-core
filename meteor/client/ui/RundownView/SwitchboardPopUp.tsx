import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
	StudioRouteSet,
	StudioRouteSetExclusivityGroup,
	StudioRouteBehavior,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import classNames from 'classnames'
import { RouteSetOverrideIcon } from '../../lib/ui/icons/switchboard'
import Tooltip from 'rc-tooltip'
import { TOOLTIP_DEFAULT_DELAY } from '../../lib/lib'
import { WrappedOverridableItemNormal } from '../util/OverrideOpHelper'

interface IProps {
	onStudioRouteSetSwitch?: (
		e: React.MouseEvent<HTMLElement>,
		routeSetId: string,
		routeSet: StudioRouteSet,
		state: boolean
	) => void
	availableRouteSets: WrappedOverridableItemNormal<StudioRouteSet>[]
	exclusivityGroups: Record<string, StudioRouteSetExclusivityGroup>
}

/**
 * This is a panel for which Route Sets are active in the current studio
 */
export function SwitchboardPopUp(props: Readonly<IProps>): JSX.Element {
	const { t } = useTranslation()

	const sortInExclusivityGroups: {
		[id: string]: WrappedOverridableItemNormal<StudioRouteSet>[]
	} = {}
	for (const routeSet of props.availableRouteSets) {
		const group: string = routeSet.computed.exclusivityGroup || '__noGroup'
		if (sortInExclusivityGroups[group] === undefined) sortInExclusivityGroups[group] = []
		sortInExclusivityGroups[group].push(routeSet)
	}

	return (
		<div className="switchboard-pop-up-panel" role="dialog">
			<div className="switchboard-pop-up-panel__inside">
				<h2 className="mhn mvn">{t('Switchboard')}</h2>
				{Object.entries<WrappedOverridableItemNormal<StudioRouteSet>[]>(sortInExclusivityGroups).map(
					([key, routeSets]) => (
						<div className="switchboard-pop-up-panel__group" key={key}>
							{props.exclusivityGroups[key]?.name && (
								<p className="mhs mbs mtn">{props.exclusivityGroups[key]?.name}</p>
							)}

							{routeSets.length === 2 &&
							routeSets[0].computed.behavior === StudioRouteBehavior.ACTIVATE_ONLY &&
							routeSets[1].computed.behavior === StudioRouteBehavior.ACTIVATE_ONLY ? (
								<div key={routeSets[0].id} className="switchboard-pop-up-panel__group__controls dual mhm mbs">
									<span
										className={classNames({
											'switchboard-pop-up-panel__group__controls__active': routeSets[0].computed.active,
											'switchboard-pop-up-panel__group__controls__inactive': !routeSets[0].computed.active,
										})}
									>
										{routeSets[0].computed.name}
									</span>
									<a
										className={classNames('switch-button', 'sb-nocolor', {
											'sb-on': routeSets[1].computed.active,
										})}
										role="button"
										onClick={(e) =>
											props.onStudioRouteSetSwitch &&
											props.onStudioRouteSetSwitch(
												e,
												routeSets[0].computed.active ? routeSets[1].id : routeSets[0].id,
												routeSets[0].computed.active ? routeSets[1].computed : routeSets[0].computed,
												true
											)
										}
										tabIndex={0}
									>
										<div className="sb-content">
											<div className="sb-label">
												<span className="mls">&nbsp;</span>
												<span className="mrs right">&nbsp;</span>
											</div>
											<div className="sb-switch"></div>
										</div>
									</a>
									<span
										className={classNames({
											'switchboard-pop-up-panel__group__controls__active': routeSets[1].computed.active,
											'switchboard-pop-up-panel__group__controls__inactive': !routeSets[1].computed.active,
										})}
									>
										{routeSets[1].computed.name}
									</span>
									{((routeSets[0].computed.defaultActive !== undefined &&
										routeSets[0].computed.active !== routeSets[0].computed.defaultActive) ||
										(routeSets[1].computed.defaultActive !== undefined &&
											routeSets[1].computed.active !== routeSets[1].computed.defaultActive)) && (
										<span className="switchboard-pop-up-panel__group__controls__notice">
											<Tooltip
												mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
												overlay={t("This is not in it's normal setting")}
												placement="top"
											>
												<span>
													<RouteSetOverrideIcon />
												</span>
											</Tooltip>
										</span>
									)}
								</div>
							) : (
								routeSets.map((routeSet) => (
									<div key={routeSet.id} className="switchboard-pop-up-panel__group__controls mhm mbs">
										<span
											className={classNames({
												'switchboard-pop-up-panel__group__controls__active': !routeSet.computed.active,
												'switchboard-pop-up-panel__group__controls__inactive': routeSet.computed.active,
											})}
										>
											{t('Off')}
										</span>
										<a
											className={classNames('switch-button', 'sb-nocolor', {
												'sb-on': routeSet.computed.active,
											})}
											role="button"
											onClick={(e) =>
												!(
													routeSet.computed.active && routeSet.computed.behavior === StudioRouteBehavior.ACTIVATE_ONLY
												) &&
												props.onStudioRouteSetSwitch &&
												props.onStudioRouteSetSwitch(e, routeSet.id, routeSet.computed, !routeSet.computed.active)
											}
											tabIndex={0}
										>
											<div className="sb-content">
												<div className="sb-label">
													<span className="mls">&nbsp;</span>
													<span className="mrs right">&nbsp;</span>
												</div>
												<div className="sb-switch"></div>
											</div>
										</a>
										<span
											className={classNames({
												'switchboard-pop-up-panel__group__controls__active': routeSet.computed.active,
												'switchboard-pop-up-panel__group__controls__inactive': !routeSet.computed.active,
											})}
										>
											{routeSet.computed.name}
										</span>
										{routeSet.computed.defaultActive !== undefined &&
											routeSet.computed.active !== routeSet.computed.defaultActive && (
												<span className="switchboard-pop-up-panel__group__controls__notice">
													<Tooltip
														mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
														overlay={t("This is not in it's normal setting")}
														placement="top"
													>
														<span>
															<RouteSetOverrideIcon />
														</span>
													</Tooltip>
												</span>
											)}
									</div>
								))
							)}
						</div>
					)
				)}
			</div>
		</div>
	)
}
