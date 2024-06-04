import ClassNames from 'classnames'
import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { DBStudio, StudioPackageContainer } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { EditAttribute, EditAttributeBase } from '../../../lib/EditAttribute'
import { doModalDialog } from '../../../lib/ModalDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPencilAlt, faCheck, faPlus } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { Accessor } from '@sofie-automation/blueprints-integration'
import { Studios } from '../../../collections'
import {
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
	applyAndValidateOverrides,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import {
	LabelActual,
	LabelAndOverrides,
	LabelAndOverridesForCheckbox,
	LabelAndOverridesForDropdown,
	LabelAndOverridesForMultiSelect,
} from '../../../lib/Components/LabelAndOverrides'
import { useToggleExpandHelper } from '../../util/useToggleExpandHelper'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { TextInputControl } from '../../../lib/Components/TextInput'
import {
	DropdownInputControl,
	DropdownInputOption,
	getDropdownInputOptions,
} from '../../../lib/Components/DropdownInput'
import { MultiSelectInputControl } from '../../../lib/Components/MultiSelectInput'
import {
	OverrideOpHelper,
	WrappedOverridableItem,
	getAllCurrentAndDeletedItemsFromOverrides,
	useOverrideOpHelper,
} from '../../util/OverrideOpHelper'
import { CheckboxControl } from '../../../lib/Components/Checkbox'

interface StudioPackageManagerSettingsProps {
	studio: DBStudio
}

export function StudioPackageManagerSettings({ studio }: StudioPackageManagerSettingsProps): React.JSX.Element {
	const { t } = useTranslation()

	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const packageContainersFromOverrides = React.useMemo(
		() =>
			getAllCurrentAndDeletedItemsFromOverrides(studio.packageContainersWithOverrides, (a, b) =>
				a[0].localeCompare(b[0])
			),
		[studio.packageContainersWithOverrides]
	)

	const addNewPackageContainer = React.useCallback(() => {
		const resolvedPackageContainers = applyAndValidateOverrides(studio.packageContainersWithOverrides).obj

		// find free key name
		const newKeyName = 'newContainer'
		let iter = 0
		while (resolvedPackageContainers[newKeyName + iter.toString]) {
			iter++
		}

		const newId = newKeyName + iter.toString()
		const newPackageContainer: StudioPackageContainer = {
			deviceIds: [],
			container: {
				label: 'New Package Container ' + iter.toString(),
				accessors: {},
			},
		}

		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: newId,
			value: newPackageContainer,
		})

		Studios.update(studio._id, {
			$push: {
				'packageContainersWithOverrides.overrides': addOp,
			},
		})

		setTimeout(() => {
			toggleExpanded(newId, true)
		}, 1)
	}, [studio._id, studio.packageContainersWithOverrides])

	const getAvailablePackageContainers = () => {
		const arr: {
			name: string
			value: string
		}[] = []

		packageContainersFromOverrides.forEach((packageContainer) => {
			let hasHttpAccessor = false
			if (packageContainer.computed) {
				for (const accessor of Object.values<Accessor.Any>(packageContainer.computed.container.accessors)) {
					if (accessor.type === Accessor.AccessType.HTTP_PROXY) {
						hasHttpAccessor = true
						break
					}
				}
				if (hasHttpAccessor) {
					arr.push({
						name: packageContainer.computed.container.label,
						value: packageContainer.id,
					})
				}
			}
		})
		return arr
	}

	return (
		<div>
			<h2 className="mhn mbs">{t('Package Manager')}</h2>

			<div className="settings-studio-package-containers">
				<h3 className="mhn">{t('Studio Settings')}</h3>

				<div>
					<div className="field mvs">
						<label>{t('Package Containers to use for previews')}</label>
						<div className="mdi">
							<EditAttribute
								attribute="previewContainerIds"
								obj={studio}
								options={getAvailablePackageContainers()}
								label={t('Click to show available Package Containers')}
								type="multiselect"
								collection={Studios}
							></EditAttribute>
						</div>
					</div>
					<div className="field mvs">
						<label>{t('Package Containers to use for thumbnails')}</label>
						<div className="mdi">
							<EditAttribute
								attribute="thumbnailContainerIds"
								obj={studio}
								options={getAvailablePackageContainers()}
								label={t('Click to show available Package Containers')}
								type="multiselect"
								collection={Studios}
							></EditAttribute>
						</div>
					</div>
				</div>

				<h3 className="mhn">{t('Package Containers')}</h3>
				<table className="table expando settings-studio-package-containers-table">
					<tbody>{RenderPackageContainers(studio, packageContainersFromOverrides, toggleExpanded, isExpanded)}</tbody>
				</table>
				<div className="mod mhs">
					<button className="btn btn-primary" onClick={() => addNewPackageContainer()}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</div>
		</div>
	)
}

function RenderPackageContainers(
	studio: DBStudio,
	packageContainersFromOverrides: WrappedOverridableItem<StudioPackageContainer>[],
	toggleExpanded: (id: string, forceState?: boolean | undefined) => void,
	isExpanded: (id: string) => boolean
) {
	const { t } = useTranslation()

	const saveOverrides = React.useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			Studios.update(studio._id, {
				$set: {
					'packageContainersWithOverrides.overrides': newOps,
				},
			})
		},
		[studio._id]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, studio.packageContainersWithOverrides)

	const confirmRemovePackageContainer = (containerId: string) => {
		doModalDialog({
			title: t('Remove this Package Container?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				removePackageContainer(containerId)
			},
			message: (
				<React.Fragment>
					<p>
						{t('Are you sure you want to remove the Package Container "{{containerId}}"?', {
							containerId: containerId,
						})}
					</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}
	const removePackageContainer = (containerId: string) => {
		const unsetObject: Record<string, 1> = {}
		unsetObject['packageContainers.' + containerId] = 1
		Studios.update(studio._id, {
			$unset: unsetObject,
		})
	}

	return packageContainersFromOverrides.map(
		(packageContainer: WrappedOverridableItem<StudioPackageContainer>, id: number): React.JSX.Element => {
			if (!packageContainer.computed) throw new Error(`Package Container "${id}" not found`)

			return (
				<React.Fragment key={packageContainer.id}>
					<tr
						className={ClassNames({
							hl: isExpanded(packageContainer.id),
						})}
					>
						<th className="settings-studio-package-container__id c2">{packageContainer.id}</th>
						<td className="settings-studio-package-container__name c2">{packageContainer.computed.container.label}</td>

						<td className="settings-studio-package-container__actions table-item-actions c3">
							<button className="action-btn" onClick={() => toggleExpanded(packageContainer.id)}>
								<FontAwesomeIcon icon={faPencilAlt} />
							</button>
							<button className="action-btn" onClick={() => confirmRemovePackageContainer(packageContainer.id)}>
								<FontAwesomeIcon icon={faTrash} />
							</button>
						</td>
					</tr>
					<RenderPackageContainer
						studio={studio}
						packageContainer={packageContainer}
						overrideHelper={overrideHelper}
						toggleExpanded={toggleExpanded}
						isExpanded={isExpanded}
					/>
				</React.Fragment>
			)
		}
	)
}

interface RenderPackageContainerProps {
	studio: DBStudio
	packageContainer: WrappedOverridableItem<StudioPackageContainer>
	overrideHelper: OverrideOpHelper
	toggleExpanded: (id: string, forceState?: boolean | undefined) => void
	isExpanded: (id: string) => boolean
}

function RenderPackageContainer({
	studio,
	packageContainer,
	overrideHelper,
	toggleExpanded,
	isExpanded,
}: RenderPackageContainerProps): React.JSX.Element {
	const { t } = useTranslation()

	const getPlayoutDeviceIds: DropdownInputOption<string>[] = React.useMemo(() => {
		const playoutDevicesFromOverrrides = applyAndValidateOverrides(studio.peripheralDeviceSettings.playoutDevices).obj

		const devices: {
			name: string
			value: string
		}[] = []

		for (const deviceId of Object.keys(playoutDevicesFromOverrrides)) {
			devices.push({
				name: deviceId,
				value: deviceId,
			})
		}
		return getDropdownInputOptions([...devices])
	}, [studio.peripheralDeviceSettings.playoutDevices])

	const updatePackageContainerId = React.useCallback(
		(newPackageContainerId: string) => {
			overrideHelper.changeItemId(packageContainer.id, newPackageContainerId)
			toggleExpanded(newPackageContainerId, true)
		},
		[overrideHelper, toggleExpanded, packageContainer.id]
	)

	const addNewAccessor = (containerId: string) => {
		// find free key name
		const newKeyName = 'local'
		let iter = 0
		if (!packageContainer.id) throw new Error(`Can't add an accessor to nonexistant Package Container "${containerId}"`)

		while (packageContainer.computed?.container.accessors[newKeyName + iter]) {
			iter++
		}
		const accessorId = newKeyName + iter

		const newAccessor: Accessor.LocalFolder = {
			type: Accessor.AccessType.LOCAL_FOLDER,
			label: 'Local folder',
			allowRead: true,
			allowWrite: false,
			folderPath: '',
		}
		const setObject: Record<string, any> = {}
		setObject[`packageContainers.${containerId}.container.accessors.${accessorId}`] = newAccessor

		Studios.update(studio._id, {
			$set: setObject,
		})
	}

	if (!packageContainer.computed) throw new Error(`Package Container "${packageContainer.id}" not found`)

	return (
		<React.Fragment key={packageContainer.id}>
			{isExpanded(packageContainer.id) && (
				<tr className="expando-details hl">
					<td colSpan={6}>
						<div className="properties-grid">
							<label className="field">
								<LabelActual label={t('Package Container ID')} />
								<TextInputControl
									modifiedClassName="bghl"
									classNames="input text-input input-l"
									value={packageContainer.id}
									handleUpdate={updatePackageContainerId}
									disabled={!!packageContainer.defaults}
								/>
							</label>
							<LabelAndOverrides
								label={t('Label')}
								item={packageContainer}
								//@ts-expect-error can't be 2 levels deep
								itemKey={'container.label'}
								opPrefix={packageContainer.id}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => (
									<TextInputControl
										modifiedClassName="bghl"
										classNames="input text-input input-l"
										value={value}
										handleUpdate={handleUpdate}
									/>
								)}
							</LabelAndOverrides>
							<LabelAndOverridesForMultiSelect
								label={t('Playout devices which uses this package container')}
								hint={t('Select which playout devices are using this package container')}
								item={packageContainer}
								itemKey={'deviceIds'}
								opPrefix={packageContainer.id}
								overrideHelper={overrideHelper}
								options={getPlayoutDeviceIds}
							>
								{(value, handleUpdate, options) => (
									<MultiSelectInputControl
										classNames="input text-input input-l"
										options={options}
										value={value}
										handleUpdate={handleUpdate}
									/>
								)}
							</LabelAndOverridesForMultiSelect>
							<div className="mdi"></div>
						</div>
						<div>
							<div className="settings-studio-accessors">
								<h3 className="mhn">{t('Accessors')}</h3>
								<table className="expando settings-studio-package-containers-accessors-table">
									<RenderAccessors
										studio={studio}
										packageContainer={packageContainer}
										overrideHelper={overrideHelper}
									/>
								</table>
								<div className="mod mhs">
									<button className="btn btn-primary" onClick={() => addNewAccessor(packageContainer.id)}>
										<FontAwesomeIcon icon={faPlus} />
									</button>
								</div>
							</div>
						</div>
					</td>
				</tr>
			)}
		</React.Fragment>
	)
}

interface RenderAccessorsProps {
	studio: DBStudio
	packageContainer: WrappedOverridableItem<StudioPackageContainer>
	overrideHelper: OverrideOpHelper
}

function RenderAccessors({ studio, packageContainer, overrideHelper }: RenderAccessorsProps): React.JSX.Element {
	const { t } = useTranslation()

	const container = packageContainer.computed?.container

	if (!container || Object.keys(container).length === 0) {
		return (
			<tr>
				<td className="mhn dimmed">{t('There are no Accessors set up.')}</td>
			</tr>
		)
	}

	return (
		<React.Fragment>
			{_.map(container.accessors || {}, (accessor: Accessor.Any, accessorId: string) => {
				return (
					<React.Fragment key={accessorId}>
						<RenderAccessor
							studio={studio}
							accessorId={accessorId}
							accessor={accessor}
							packageContainer={packageContainer}
							overrideHelper={overrideHelper}
						/>
					</React.Fragment>
				)
			})}
		</React.Fragment>
	)
}

interface RenderAccessorProps {
	studio: DBStudio
	packageContainer: WrappedOverridableItem<StudioPackageContainer>
	accessorId: string
	accessor: Accessor.Any
	overrideHelper: OverrideOpHelper
}

function RenderAccessor({
	studio,
	accessor,
	accessorId,
	packageContainer,
	overrideHelper,
}: RenderAccessorProps): React.JSX.Element {
	const { t } = useTranslation()
	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const containerId = packageContainer.id

	const confirmRemoveAccessor = (containerId: string, accessorId: string) => {
		doModalDialog({
			title: t('Remove this Package Container Accessor?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				removeAccessor(containerId, accessorId)
			},
			message: (
				<React.Fragment>
					<p>
						{t('Are you sure you want to remove the Package Container Accessor "{{accessorId}}"?', {
							accessorId: accessorId,
						})}
					</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}
	const removeAccessor = (containerId: string, accessorId: string) => {
		const unsetObject: Record<string, 1> = {}
		unsetObject[`packageContainers.${containerId}.container.accessors.${accessorId}`] = 1
		Studios.update(studio._id, {
			$unset: unsetObject,
		})
	}

	const updateAccessorId = (edit: EditAttributeBase, newValue: string) => {
		const oldAccessorId = edit.overrideDisplayValue
		const newAccessorId = newValue + ''
		const containerId = edit.attribute
		if (!containerId) throw new Error(`containerId not set`)
		if (!packageContainer) throw new Error(`Can't edit an accessor to nonexistant Package Container "${containerId}"`)

		const accessor = packageContainer.computed?.container.accessors[oldAccessorId]

		if (packageContainer.computed?.container.accessors[newAccessorId]) {
			throw new Meteor.Error(400, 'Accessor "' + newAccessorId + '" already exists')
		}

		const mSet: Record<string, any> = {}
		const mUnset: Record<string, 1> = {}
		mSet[`packageContainers.${containerId}.container.accessors.${newAccessorId}`] = accessor
		mUnset[`packageContainers.${containerId}.container.accessors.${oldAccessorId}`] = 1

		if (edit.collection) {
			edit.collection.update(studio._id, {
				$set: mSet,
				$unset: mUnset,
			})
		}
		toggleExpanded(containerId, oldAccessorId)
		toggleExpanded(containerId, newAccessorId)
	}

	if (Object.keys(packageContainer.computed?.container || {}).length === 0) {
		return (
			<tr>
				<td className="mhn dimmed">{t('There are no Accessors set up.')}</td>
			</tr>
		)
	}

	return (
		<React.Fragment key={accessorId}>
			<tr
				className={ClassNames({
					hl: isExpanded(accessorId),
				})}
			>
				<th className="settings-studio-accessor__id c2">{accessorId}</th>
				{/* <td className="settings-studio-accessor__name c2">{accessor.name}</td> */}
				<td className="settings-studio-accessor__type c1">{accessor.label}</td>
				{/*<td className="settings-studio-accessor__accessorContent c7">{accessorContent.join(', ')}</td>*/}

				<td className="settings-studio-accessor__actions table-item-actions c3">
					<button className="action-btn" onClick={() => toggleExpanded(accessorId)}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
					<button className="action-btn" onClick={() => confirmRemoveAccessor(containerId, accessorId)}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</td>
			</tr>
			{isExpanded(accessorId) && (
				<tr className="expando-details hl">
					<td colSpan={6}>
						<div className="properties-grid">
							<label className="field">
								<LabelActual label={t('Accessor ID')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={containerId}
									overrideDisplayValue={accessorId}
									obj={studio}
									type="text"
									collection={Studios}
									updateFunction={updateAccessorId}
									className="input text-input input-l"
								></EditAttribute>
							</label>
							<LabelAndOverrides
								label={t('Label')}
								hint={t('Display name of the Package Container')}
								item={packageContainer}
								//@ts-expect-error can't be 4 levels deep
								itemKey={`container.accessors.${accessorId}.label`}
								opPrefix={packageContainer.id}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => (
									<TextInputControl
										modifiedClassName="bghl"
										classNames="input text-input input-l"
										value={value}
										handleUpdate={handleUpdate}
									/>
								)}
							</LabelAndOverrides>
							<LabelAndOverridesForDropdown
								label={t('Accessor Type')}
								item={packageContainer}
								//@ts-expect-error can't be 4 levels deep
								itemKey={`container.accessors.${accessorId}.type`}
								opPrefix={packageContainer.id}
								overrideHelper={overrideHelper}
								options={getDropdownInputOptions(Accessor.AccessType)}
							>
								{(value, handleUpdate, options) => {
									return (
										<DropdownInputControl
											classNames="input text-input input-l"
											options={options}
											value={value}
											handleUpdate={handleUpdate}
										/>
									)
								}}
							</LabelAndOverridesForDropdown>
							{accessor.type === Accessor.AccessType.LOCAL_FOLDER ? (
								<>
									<LabelAndOverrides
										label={t('Folder path')}
										hint={t('File path to the folder of the local folder')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.folderPath`}
										opPrefix={packageContainer.id}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => (
											<TextInputControl
												modifiedClassName="bghl"
												classNames="input text-input input-l"
												value={value}
												handleUpdate={handleUpdate}
											/>
										)}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Resourse Id')}
										hint={t('(Optional) This could be the name of the computer on which the local folder is on')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.resourceId`}
										opPrefix={packageContainer.id}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => (
											<TextInputControl
												modifiedClassName="bghl"
												classNames="input text-input input-l"
												value={value}
												handleUpdate={handleUpdate}
											/>
										)}
									</LabelAndOverrides>
								</>
							) : accessor.type === Accessor.AccessType.HTTP ? (
								<>
									<LabelAndOverrides
										label={t('Base URL')}
										hint={t('Base url to the resource (example: http://myserver/folder)')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.baseUrl`}
										opPrefix={packageContainer.id}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => (
											<TextInputControl
												modifiedClassName="bghl"
												classNames="input text-input input-l"
												value={value}
												handleUpdate={handleUpdate}
											/>
										)}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Network Id')}
										hint={t(
											'(Optional) A name/identifier of the local network where the share is located, leave empty if globally accessible'
										)}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.networkId`}
										opPrefix={packageContainer.id}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => (
											<TextInputControl
												modifiedClassName="bghl"
												classNames="input text-input input-l"
												value={value}
												handleUpdate={handleUpdate}
											/>
										)}
									</LabelAndOverrides>
								</>
							) : accessor.type === Accessor.AccessType.HTTP_PROXY ? (
								<>
									<LabelAndOverrides
										label={t('Base URL')}
										hint={t('Base url to the resource (example: http://myserver/folder)')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.baseUrl`}
										opPrefix={packageContainer.id}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => (
											<TextInputControl
												modifiedClassName="bghl"
												classNames="input text-input input-l"
												value={value}
												handleUpdate={handleUpdate}
											/>
										)}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Network Id')}
										hint={t(
											'(Optional) A name/identifier of the local network where the share is located, leave empty if globally accessible'
										)}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.networkId`}
										opPrefix={packageContainer.id}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => (
											<TextInputControl
												modifiedClassName="bghl"
												classNames="input text-input input-l"
												value={value}
												handleUpdate={handleUpdate}
											/>
										)}
									</LabelAndOverrides>
								</>
							) : accessor.type === Accessor.AccessType.FILE_SHARE ? (
								<>
									<LabelAndOverrides
										label={t('Base URL')}
										hint={t('Folder path to shared folder')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.folderPath`}
										opPrefix={packageContainer.id}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => (
											<TextInputControl
												modifiedClassName="bghl"
												classNames="input text-input input-l"
												value={value}
												handleUpdate={handleUpdate}
											/>
										)}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('User Name')}
										hint={t('Username for authentication')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.userName`}
										opPrefix={packageContainer.id}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => (
											<TextInputControl
												modifiedClassName="bghl"
												classNames="input text-input input-l"
												value={value}
												handleUpdate={handleUpdate}
											/>
										)}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Password')}
										hint={t('Password for authentication')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.password`}
										opPrefix={packageContainer.id}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => (
											<TextInputControl
												modifiedClassName="bghl"
												classNames="input text-input input-l"
												value={value}
												handleUpdate={handleUpdate}
											/>
										)}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Network Id')}
										hint={t('(Optional) A name/identifier of the local network where the share is located')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.networkId`}
										opPrefix={packageContainer.id}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => (
											<TextInputControl
												modifiedClassName="bghl"
												classNames="input text-input input-l"
												value={value}
												handleUpdate={handleUpdate}
											/>
										)}
									</LabelAndOverrides>
								</>
							) : accessor.type === Accessor.AccessType.QUANTEL ? (
								<>
									<LabelAndOverrides
										label={t('Quantel gateway URL')}
										hint={t('URL to the Quantel Gateway')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.quantelGatewayUrl`}
										opPrefix={packageContainer.id}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => (
											<TextInputControl
												modifiedClassName="bghl"
												classNames="input text-input input-l"
												value={value}
												handleUpdate={handleUpdate}
											/>
										)}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('ISA URLs')}
										hint={t('URLs to the ISAs, in order of importance (comma separated)')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.ISAUrls`}
										opPrefix={packageContainer.id}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => (
											<TextInputControl
												modifiedClassName="bghl"
												classNames="input text-input input-l"
												value={value}
												handleUpdate={handleUpdate}
											/>
										)}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Quantel Zone ID')}
										hint={t('Zone ID')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.zoneId`}
										opPrefix={packageContainer.id}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => (
											<TextInputControl
												modifiedClassName="bghl"
												classNames="input text-input input-l"
												value={value}
												handleUpdate={handleUpdate}
											/>
										)}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Server ID')}
										hint={t(
											'Server ID. For sources, this should generally be omitted (or set to 0) so clip-searches are zone-wide. If set, clip-searches are limited to that server.'
										)}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.serverId`}
										opPrefix={packageContainer.id}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => (
											<TextInputControl
												modifiedClassName="bghl"
												classNames="input text-input input-l"
												value={value}
												handleUpdate={handleUpdate}
											/>
										)}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Quantel transformer URL')}
										hint={t('URL to the Quantel HTTP transformer')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.transformerURL`}
										opPrefix={packageContainer.id}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => (
											<TextInputControl
												modifiedClassName="bghl"
												classNames="input text-input input-l"
												value={value}
												handleUpdate={handleUpdate}
											/>
										)}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Quantel FileFlow URL')}
										hint={t('URL to the Quantel FileFlow Manager')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.fileflowURL`}
										opPrefix={packageContainer.id}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => (
											<TextInputControl
												modifiedClassName="bghl"
												classNames="input text-input input-l"
												value={value}
												handleUpdate={handleUpdate}
											/>
										)}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Quantel FileFlow Profile name')}
										hint={t('Profile name to be used by FileFlow when exporting the clips')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.fileflowProfile`}
										opPrefix={packageContainer.id}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => (
											<TextInputControl
												modifiedClassName="bghl"
												classNames="input text-input input-l"
												value={value}
												handleUpdate={handleUpdate}
											/>
										)}
									</LabelAndOverrides>
								</>
							) : null}

							<LabelAndOverridesForCheckbox
								label={t('Allow Read access')}
								item={packageContainer}
								//@ts-expect-error can't be 4 levels deep
								itemKey={`container.accessors.${accessorId}.allowRead`}
								opPrefix={packageContainer.id}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
							<LabelAndOverridesForCheckbox
								label={t('Allow Write access')}
								item={packageContainer}
								//@ts-expect-error can't be 4 levels deep
								itemKey={`container.accessors.${accessorId}.allowWrite`}
								opPrefix={packageContainer.id}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
						</div>
						<div className="mod">
							<button className="btn btn-primary right" onClick={() => toggleExpanded(accessorId)}>
								<FontAwesomeIcon icon={faCheck} />
							</button>
						</div>
					</td>
				</tr>
			)}
		</React.Fragment>
	)
}
