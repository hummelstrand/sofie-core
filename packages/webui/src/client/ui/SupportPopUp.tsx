import * as React from 'react'
import ClassNames from 'classnames'
import { useTracker } from '../lib/ReactMeteorData/ReactMeteorData'
import { SupportIcon } from '../lib/ui/icons/supportIcon'
import { useTranslation } from 'react-i18next'
import { getHelpMode } from '../lib/localStorage'
import { CoreSystem } from '../collections'
import { SYSTEM_ID } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

interface IProps {}

export function SupportPopUp({ children }: Readonly<React.PropsWithChildren<IProps>>): JSX.Element {
	const { t } = useTranslation()

	const { supportMessage } = useTracker(
		() => {
			const core = CoreSystem.findOne(SYSTEM_ID, { projection: { settingsWithOverrides: 1 } })
			const coreSettings = core && applyAndValidateOverrides(core.settingsWithOverrides).obj
			return {
				supportMessage: coreSettings?.support?.message ?? '',
			}
		},
		[],
		{ supportMessage: '' }
	)

	const supportMessageHTML = React.useMemo(
		() => (supportMessage ? { __html: supportMessage } : undefined),
		[supportMessage]
	)

	return (
		<div className="support-pop-up-panel" role="dialog">
			<h2 className="mhn mvn">{t('Help & Support')}</h2>
			{children && <div className="support-pop-up-panel__actions">{children}</div>}
			{!supportMessage && <DocumentationLink />}
			<div dangerouslySetInnerHTML={supportMessageHTML} />
		</div>
	)
}

interface IToggleProps {
	isOpen?: boolean
	onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
	title?: string
}

export function SupportPopUpToggle({ isOpen, title, onClick }: Readonly<IToggleProps>): JSX.Element {
	return (
		<button
			className={ClassNames('status-bar__controls__button', 'support__toggle-button', {
				'status-bar__controls__button--open': isOpen,
				// 'status-bar__controls__button--has-messages': this.getMessages() !== ''
			})}
			role="button"
			onClick={onClick}
			tabIndex={0}
			aria-label={title}
			aria-haspopup="dialog"
			aria-pressed={isOpen ? 'true' : 'false'}
		>
			<SupportIcon />
		</button>
	)
}

export function DocumentationLink(): JSX.Element {
	const { t } = useTranslation()

	return (
		<div>
			{getHelpMode() ? (
				<p>
					{t('Disable hints by adding this to the URL:')}&nbsp;
					<a href="?help=0">?help=0</a>
				</p>
			) : (
				<p>
					{t('Enable hints by adding this to the URL:')}&nbsp;
					<a href="?help=1">?help=1</a>
				</p>
			)}
			<p>
				{t('More documentation available at:')}&nbsp;
				<a href="https://nrkno.github.io/sofie-core/">https://nrkno.github.io/sofie-core/</a>
			</p>
		</div>
	)
}
