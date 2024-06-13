import React from 'react'
import { assertNever, clone } from '@sofie-automation/corelib/dist/lib'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	CoreUserEditingDefinition,
	CoreUserEditingDefinitionAction,
	CoreUserEditingDefinitionForm,
} from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { JSONBlobParse, UserOperationTarget } from '@sofie-automation/blueprints-integration'
import { UserAction, doUserAction } from '../../../lib/clientUserAction'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { MenuItem } from '@jstarpl/react-contextmenu'
import { useTranslation } from 'react-i18next'
import { MeteorCall } from '../../../lib/api/methods'
import { i18nTranslator } from '../i18n'
import { doModalDialog } from '../../lib/ModalDialog'
import { SchemaFormInPlace } from '../../lib/forms/SchemaFormInPlace'

export function RenderUserEditOperations(
	rundownId: RundownId,
	targetName: string,
	userEdits: CoreUserEditingDefinition[] | undefined,
	operationTarget: UserOperationTarget
): React.JSX.Element {
	if (!userEdits || userEdits.length === 0) return <React.Fragment />

	return (
		<>
			<hr />
			{userEdits.map((userEdit, i) => {
				switch (userEdit.type) {
					case 'action':
						return renderUserEditOperationAction(rundownId, userEdit, i, operationTarget)
					case 'form':
						return renderUserEditOperationForm(rundownId, targetName, userEdit, i, operationTarget)
					default:
						assertNever(userEdit)
						return null
				}
			})}
		</>
	)
}

function renderUserEditOperationAction(
	rundownId: RundownId,
	userEdit: CoreUserEditingDefinitionAction,
	i: number,
	operationTarget: UserOperationTarget
) {
	const { t } = useTranslation()

	return (
		<MenuItem
			key={`${userEdit.id}_${i}`}
			onClick={(e) => {
				doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
					MeteorCall.userAction.executeUserChangeOperation(e, ts, rundownId, operationTarget, {
						id: userEdit.id,
					})
				)
			}}
		>
			<span>{translateMessage(userEdit.label, i18nTranslator)}</span>
		</MenuItem>
	)
}

function renderUserEditOperationForm(
	rundownId: RundownId,
	targetName: string,
	userEdit: CoreUserEditingDefinitionForm,
	i: number,
	operationTarget: UserOperationTarget
) {
	const { t } = useTranslation()

	return (
		<MenuItem
			key={`${userEdit.id}_${i}`}
			onClick={(e) => {
				const schema = JSONBlobParse(userEdit.schema)
				const values = clone(userEdit.currentValues)

				// TODO:
				doModalDialog({
					title: t(`Edit {{targetName}}`, { targetName }),
					message: (
						<SchemaFormInPlace schema={schema} object={values} translationNamespaces={userEdit.translationNamespaces} />
					),
					// acceptText: 'OK',
					yes: t('Save Changes'),
					no: t('Cancel'),
					onAccept: () => {
						doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
							MeteorCall.userAction.executeUserChangeOperation(e, ts, rundownId, operationTarget, {
								...values,
								id: userEdit.id,
							})
						)
					},
				})
			}}
		>
			<span>{translateMessage(userEdit.label, i18nTranslator)}</span>
		</MenuItem>
	)
}
