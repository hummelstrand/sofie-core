import React from 'react'
import { assertNever, clone } from '@sofie-automation/corelib/dist/lib'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	CoreUserEditingDefinition,
	CoreUserEditingDefinitionAction,
	CoreUserEditingDefinitionForm,
} from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { JSONBlobParse, UserEditingType, UserOperationTarget } from '@sofie-automation/blueprints-integration'
import { UserAction, doUserAction } from '../../../lib/clientUserAction'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { MenuItem } from '@jstarpl/react-contextmenu'
import { useTranslation } from 'react-i18next'
import { MeteorCall } from '../../../lib/api/methods'
import { i18nTranslator } from '../i18n'
import { doModalDialog } from '../../lib/ModalDialog'
import { SchemaFormInPlace } from '../../lib/forms/SchemaFormInPlace'

interface UserEditOperationsProps {
	rundownId: RundownId
	targetName: string
	userEdits: CoreUserEditingDefinition[] | undefined
	operationTarget: UserOperationTarget
}

export function RenderUserEditOperations({
	rundownId,
	targetName,
	userEdits,
	operationTarget,
}: UserEditOperationsProps): React.JSX.Element {
	if (!userEdits || userEdits.length === 0) return <React.Fragment />
	return (
		<React.Fragment>
			<hr />
			{userEdits.map((userEdit, i) => {
				switch (userEdit.type) {
					case UserEditingType.ACTION:
						return (
							<RenderUserEditOperationAction
								key={targetName + '_' + i}
								rundownId={rundownId}
								userEdit={userEdit}
								i={i}
								operationTarget={operationTarget}
							/>
						)
					case UserEditingType.FORM:
						return (
							<RenderUserEditOperationForm
								key={targetName + '_' + i}
								rundownId={rundownId}
								targetName={targetName}
								userEdit={userEdit}
								i={i}
								operationTarget={operationTarget}
							/>
						)
					default:
						assertNever(userEdit)
						return null
				}
			})}
		</React.Fragment>
	)
}

interface UserEditOperationActionProps {
	rundownId: RundownId
	userEdit: CoreUserEditingDefinitionAction
	i: number
	operationTarget: UserOperationTarget
}

function RenderUserEditOperationAction({
	rundownId,
	userEdit,
	i,
	operationTarget,
}: UserEditOperationActionProps): React.JSX.Element {
	const { t } = useTranslation()
	const [col, setCol] = React.useState('white')

	return (
		<div style={{ background: `${col}` }} onMouseEnter={() => setCol('#999999')} onMouseLeave={() => setCol('white')}>
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
		</div>
	)
}

interface UserEditOperationFormProps {
	rundownId: RundownId
	targetName: string
	userEdit: CoreUserEditingDefinitionForm
	i: number
	operationTarget: UserOperationTarget
}

function RenderUserEditOperationForm({
	rundownId,
	targetName,
	userEdit,
	i,
	operationTarget,
}: UserEditOperationFormProps): React.JSX.Element {
	const { t } = useTranslation()
	// Using inline styles to change the background color on hover
	// This is a workaround for the fact that the MenuItem component does not support being in a
	// sub functional component
	const [col, setCol] = React.useState('white')

	return (
		<div style={{ background: `${col}` }} onMouseEnter={() => setCol('#999999')} onMouseLeave={() => setCol('white')}>
			<MenuItem
				key={`${userEdit.id}_${i}`}
				onClick={(e) => {
					const schema = JSONBlobParse(userEdit.schema)
					const values = clone(userEdit.currentValues)

					// TODO:
					doModalDialog({
						title: t(`Edit {{targetName}}`, { targetName }),
						message: (
							<SchemaFormInPlace
								schema={schema}
								object={values}
								translationNamespaces={userEdit.translationNamespaces}
							/>
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
		</div>
	)
}
