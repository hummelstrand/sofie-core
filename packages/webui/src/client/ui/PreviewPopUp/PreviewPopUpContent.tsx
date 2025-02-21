import React from 'react'
import { PreviewContent } from './PreviewPopUpContext'
import { WarningIconSmall } from '../../lib/ui/icons/notifications'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { useTranslation } from 'react-i18next'
import { VTPreviewElement } from './Previews/VTPreview'
import { IFramePreview } from './Previews/IFramePreview'
import { BoxLayoutPreview } from './Previews/BoxLayoutPreview'
import { ScriptPreview } from './Previews/ScriptPreview'

interface PreviewPopUpContentProps {
	content: PreviewContent
	time: number | null
}

export function PreviewPopUpContent({ content, time }: PreviewPopUpContentProps): React.ReactElement {
	const { t } = useTranslation()

	switch (content.type) {
		case 'iframe':
			return <IFramePreview time={time} content={content} />
		case 'image':
			return (
				<div className="preview-popUp__image">
					<img src={content.src} />
				</div>
			)
		case 'video':
			return <VTPreviewElement time={time} content={content} />
		case 'script':
			return <ScriptPreview content={content} />
		case 'title':
			return <div className="preview-popUp__title">{content.content}</div>
		case 'inOutWords':
			return (
				<div className="preview-popUp__in-out-words">
					<div className="in-words">{content.in}</div>
					<div className="out-words">{content.out}</div>
				</div>
			)

		case 'data':
			return (
				<div className="preview-popUp__table">
					<table>
						<tbody>
							{content.content.map(({ key, value }) => (
								<tr>
									<td className="preview-popup__label">{key}</td>
									<td className="preview-popup__value">{value}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)
		case 'boxLayout':
			return <BoxLayoutPreview content={content} />
		case 'warning':
			return (
				<div className="preview-popUp__warning">
					<div className="icon">
						<WarningIconSmall />
					</div>
					<div className="content">{translateMessage(content.content, t)}</div>
				</div>
			)
		case 'stepCount':
			return (
				<div className="preview-popUp__step-count">
					{content.current}
					{content.total && '/' + content.total}
				</div>
			)
		default:
			return <></>
	}
}
