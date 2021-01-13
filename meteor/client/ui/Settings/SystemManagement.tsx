import * as React from 'react'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { ICoreSystem, CoreSystem } from '../../../lib/collections/CoreSystem'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { meteorSubscribe, PubSub } from '../../../lib/api/pubsub'
import { EditAttribute } from '../../lib/EditAttribute'

interface IProps {}

interface ITrackedProps {
	coreSystem: ICoreSystem | undefined
}

export default translateWithTracker<IProps, {}, ITrackedProps>((props: IProps) => {
	return {
		coreSystem: CoreSystem.findOne(),
	}
})(
	class SystemManagement extends MeteorReactComponent<Translated<IProps & ITrackedProps>> {
		componentDidMount() {
			meteorSubscribe(PubSub.coreSystem, null)
		}
		render() {
			const { t } = this.props

			return this.props.coreSystem ? (
				<div className="studio-edit mod mhl mvn">
					<div>
						<h2 className="mhn mtn">{t('Installation name')}</h2>
						<label className="field">
							{t('This name will be shown in the title bar of the window')}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="name"
									obj={this.props.coreSystem}
									type="text"
									collection={CoreSystem}
									className="mdinput"
								/>
								<span className="mdfx"></span>
							</div>
						</label>

						<h2 className="mhn mtn">{t('System-wide Notification Message')}</h2>
						<label className="field">
							{t('Message')}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="systemInfo.message"
									obj={this.props.coreSystem}
									type="text"
									collection={CoreSystem}
									className="mdinput"
								/>
								<span className="mdfx"></span>
							</div>
						</label>
						<div className="field">
							{t('Enabled')}
							<div className="mdi">
								<EditAttribute
									attribute="systemInfo.enabled"
									obj={this.props.coreSystem}
									type="checkbox"
									collection={CoreSystem}></EditAttribute>
							</div>
						</div>

						<h2 className="mhn">{t('Edit Support Panel')}</h2>
						<label className="field">
							{t('HTML that will be shown in the Support Panel')}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="support.message"
									obj={this.props.coreSystem}
									type="multiline"
									collection={CoreSystem}
									className="mdinput"
								/>
								<span className="mdfx"></span>
							</div>
						</label>

						<h2 className="mhn">{t('Application Performance Monitoring')}</h2>
						<div className="field">
							{t('Enabled')}
							<div className="mdi">
								<EditAttribute
									attribute="apm.enabled"
									obj={this.props.coreSystem}
									type="checkbox"
									collection={CoreSystem}></EditAttribute>
							</div>
						</div>
						<label className="field">
							{t('Transaction Sample Rate')}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="apm.transactionSampleRate"
									obj={this.props.coreSystem}
									type="float"
									collection={CoreSystem}
									className="mdinput"
								/>
								<span className="mdfx"></span>
							</div>
							<div>
								(
								{t(
									'How many of the transactions to monitor. Set to -1 to log nothing (max performance), 0.5 to log 50% of the transactions, 1 to log all transactions'
								)}
								)
							</div>
							<div>{t('Note: Core needs to be restarted to apply these settings')}</div>
						</label>

						<h2 className="mhn">{t('Cron jobs')}</h2>
						<div className="field">
							{t('Disable CasparCG restart job')}
							<div className="mdi">
								<EditAttribute
									attribute="cron.casparCG.disabled"
									obj={this.props.coreSystem}
									type="checkbox"
									collection={CoreSystem}></EditAttribute>
							</div>
						</div>
						<div className="field">
							{t('Enable storing Rundown Playlist snapshots')}
							<div className="mdi">
								<EditAttribute
									attribute="cron.storeRundownSnapshots.enabled"
									obj={this.props.coreSystem}
									type="checkbox"
									collection={CoreSystem}></EditAttribute>
							</div>
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="cron.storeRundownSnapshots.rundownNames"
									obj={this.props.coreSystem}
									type="text"
									collection={CoreSystem}
									className="mdinput"
									label="Rundown Playlist names"
									mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? undefined : v.join(', '))}
									mutateUpdateValue={(v) =>
										v === undefined || v.length === 0 ? undefined : v.split(',').map((i) => i.trim())
									}
								/>
							</div>
							<div>{t('(Comma separated list. Empty - will store snapshots of all Rundown Playlists)')}</div>
						</div>
					</div>
				</div>
			) : null
		}
	}
)
