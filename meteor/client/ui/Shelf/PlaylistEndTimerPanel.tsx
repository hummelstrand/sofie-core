import * as React from 'react'
import ClassNames from 'classnames'
import {
	DashboardLayoutPlaylistEndTimer,
	RundownLayoutBase,
	RundownLayoutPlaylistEndTimer,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementStyle } from './DashboardPanel'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { withTranslation } from 'react-i18next'
import { PlaylistEndTiming } from '../RundownView/RundownTiming/PlaylistEndTiming'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { isLoopRunning } from '../../../lib/Rundown'

interface IPlaylistEndTimerPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutPlaylistEndTimer
	playlist: DBRundownPlaylist
}

interface IState {}

export class PlaylistEndTimerPanelInner extends MeteorReactComponent<Translated<IPlaylistEndTimerPanelProps>, IState> {
	render(): JSX.Element {
		const { playlist, panel, layout } = this.props

		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(layout)

		return (
			<div
				className={ClassNames(
					'playlist-end-time-panel timing',
					isDashboardLayout ? (panel as DashboardLayoutPlaylistEndTimer).customClasses : undefined
				)}
				style={isDashboardLayout ? dashboardElementStyle(panel as DashboardLayoutPlaylistEndTimer) : {}}
			>
				<PlaylistEndTiming
					rundownPlaylist={this.props.playlist}
					loop={isLoopRunning(playlist)}
					expectedStart={PlaylistTiming.getExpectedStart(playlist.timing)}
					expectedEnd={PlaylistTiming.getExpectedEnd(playlist.timing)}
					expectedDuration={PlaylistTiming.getExpectedDuration(playlist.timing)}
					endLabel={panel.plannedEndText}
					hidePlannedEndLabel={panel.hidePlannedEndLabel}
					hideDiffLabel={panel.hideDiffLabel}
					hideCountdown={panel.hideCountdown}
					hideDiff={panel.hideDiff}
					hidePlannedEnd={panel.hidePlannedEnd}
					rundownCount={0}
				/>
			</div>
		)
	}
}

export const PlaylistEndTimerPanel = withTranslation()(PlaylistEndTimerPanelInner)
