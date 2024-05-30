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
	applyAndValidateOverrides,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { LabelActual } from '../../../lib/Components/LabelAndOverrides'
import { useToggleExpandHelper } from '../../util/useToggleExpandHelper'
import { WrappedOverridableItem, getAllCurrentAndDeletedItemsFromOverrides } from '../util/OverrideOpHelper'
import { literal } from '@sofie-automation/corelib/dist/lib'

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
	toggleExpanded: (id: string) => void,
	isExpanded: (id: string) => boolean
) {
	const { t } = useTranslation()
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
	const getPlayoutDeviceIds = () => {
		const deviceIds: {
			name: string
			value: string
		}[] = []

		const playoutDevices = applyAndValidateOverrides(studio.peripheralDeviceSettings.playoutDevices).obj

		for (const deviceId of Object.keys(playoutDevices)) {
			deviceIds.push({
				name: deviceId,
				value: deviceId,
			})
		}

		return deviceIds
	}
	const addNewAccessor = (containerId: string) => {
		// find free key name
		const newKeyName = 'local'
		let iter = 0
		const packageContainer = packageContainersFromOverrides.find((_, packageContainerId) => {
			return packageContainerId.toString() === containerId
		})?.computed
		if (!packageContainer) throw new Error(`Can't add an accessor to nonexistant Package Container "${containerId}"`)

		while (packageContainer.container.accessors[newKeyName + iter]) {
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
	if (Object.keys(packageContainersFromOverrides).length === 0) {
		return (
			<tr>
				<td className="mhn dimmed">{t('There are no Package Containers set up.')}</td>
			</tr>
		)
	}

	return packageContainersFromOverrides.map(
		(packageContainer: WrappedOverridableItem<StudioPackageContainer>, id: number): React.JSX.Element => {
			if (!packageContainer.computed) throw new Error(`Package Container "${id}" not found`)

			const containerId = packageContainer.id

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
					{isExpanded(packageContainer.id) && (
						<tr className="expando-details hl">
							<td colSpan={6}>
								<div className="properties-grid">
									<label className="field">
										<LabelActual label={t('Package Container ID')} />
										<EditAttribute
											modifiedClassName="bghl"
											attribute={'packageContainers'}
											overrideDisplayValue={packageContainer.id}
											obj={studio}
											type="text"
											collection={Studios}
											updateFunction={packageContainer.id}
											className="input text-input input-l"
										></EditAttribute>
									</label>

									<label className="field">
										<LabelActual label={t('Label')} />
										<EditAttribute
											modifiedClassName="bghl"
											attribute={`packageContainers.${containerId}.container.label`}
											obj={studio}
											type="text"
											collection={Studios}
											className="input text-input input-l"
										></EditAttribute>
										<span className="text-s dimmed field-hint">{t('Display name/label of the Package Container')}</span>
									</label>

									<label className="field">
										<LabelActual label={t('Playout devices which uses this package container')} />
										<EditAttribute
											attribute={`packageContainers.${containerId}.deviceIds`}
											obj={studio}
											options={getPlayoutDeviceIds()}
											label={t('Select playout devices')}
											type="multiselect"
											collection={Studios}
										></EditAttribute>
										<span className="text-s dimmed field-hint">
											{t('Select which playout devices are using this package container')}
										</span>
									</label>

									<div className="mdi"></div>
								</div>
								<div>
									<div className="settings-studio-accessors">
										<h3 className="mhn">{t('Accessors')}</h3>
										<table className="expando settings-studio-package-containers-accessors-table">
											<tbody>{RenderAccessors(studio, packageContainer)}</tbody>
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
	)
}

function RenderAccessors(studio: DBStudio, packageContainer: WrappedOverridableItem<StudioPackageContainer>) {
	const { t } = useTranslation()
	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

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

	return _.map(packageContainer.computed?.container.accessors || {}, (accessor: Accessor.Any, accessorId: string) => {
		const accessorContent: string[] = []
		_.each(accessor as any, (value, key: string) => {
			if (key !== 'type' && value !== '') {
				let str = JSON.stringify(value)
				if (str.length > 20) str = str.slice(0, 17) + '...'
				accessorContent.push(`${key}: ${str}`)
			}
		})
		return (
			<React.Fragment key={accessorId}>
				<tr
					className={ClassNames({
						hl: isExpanded(accessorId),
					})}
				>
					<th className="settings-studio-accessor__id c2">{accessorId}</th>
					{/* <td className="settings-studio-accessor__name c2">{accessor.name}</td> */}
					<td className="settings-studio-accessor__type c1">{accessor.type}</td>
					<td className="settings-studio-accessor__accessorContent c7">{accessorContent.join(', ')}</td>

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
								<label className="field">
									<LabelActual label={t('Label')} />
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.label`}
										obj={studio}
										type="text"
										collection={Studios}
										className="input text-input input-l"
									></EditAttribute>
									<span className="text-s dimmed field-hint">{t('Display name of the Package Container')}</span>
								</label>
								<label className="field">
									<LabelActual label={t('Accessor Type')} />
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.type`}
										obj={studio}
										type="dropdown"
										options={Accessor.AccessType}
										collection={Studios}
										className="input text-input input-l"
									></EditAttribute>
								</label>
								{accessor.type === Accessor.AccessType.LOCAL_FOLDER ? (
									<>
										<label className="field">
											<LabelActual label={t('Folder path')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.folderPath`}
												obj={studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">
												{t('File path to the folder of the local folder')}
											</span>
										</label>

										<label className="field">
											<LabelActual label={t('Resource Id')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.resourceId`}
												obj={studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">
												{t('(Optional) This could be the name of the computer on which the local folder is on')}
											</span>
										</label>
									</>
								) : accessor.type === Accessor.AccessType.HTTP ? (
									<>
										<label className="field">
											<LabelActual label={t('Base URL')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.baseUrl`}
												obj={studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">
												{t('Base url to the resource (example: http://myserver/folder)')}
											</span>
										</label>

										<label className="field">
											<LabelActual label={t('Network Id')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.networkId`}
												obj={studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">
												{t(
													'(Optional) A name/identifier of the local network where the share is located, leave empty if globally accessible'
												)}
											</span>
										</label>
									</>
								) : accessor.type === Accessor.AccessType.HTTP_PROXY ? (
									<>
										<label className="field">
											<LabelActual label={t('Base URL')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.baseUrl`}
												obj={studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">
												{t('Base url to the resource (example: http://myserver/folder)')}
											</span>
										</label>

										<label className="field">
											<LabelActual label={t('Network Id')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.networkId`}
												obj={studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">
												{t(
													'(Optional) A name/identifier of the local network where the share is located, leave empty if globally accessible'
												)}
											</span>
										</label>
									</>
								) : accessor.type === Accessor.AccessType.FILE_SHARE ? (
									<>
										<label className="field">
											<LabelActual label={t('Base URL')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.folderPath`}
												obj={studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">{t('Folder path to shared folder')}</span>
										</label>
										<label className="field">
											<LabelActual label={t('UserName')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.userName`}
												obj={studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">{t('Username for athuentication')}</span>
										</label>
										<label className="field">
											<LabelActual label={t('Password')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.password`}
												obj={studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">{t('Password for authentication')}</span>
										</label>
										<label className="field">
											<LabelActual label={t('Network Id')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.networkId`}
												obj={studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">
												{t('(Optional) A name/identifier of the local network where the share is located')}
											</span>
										</label>
									</>
								) : accessor.type === Accessor.AccessType.QUANTEL ? (
									<>
										<label className="field">
											<LabelActual label={t('Quantel gateway URL')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.quantelGatewayUrl`}
												obj={studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">{t('URL to the Quantel Gateway')}</span>
										</label>
										<label className="field">
											<LabelActual label={t('ISA URLs')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.ISAUrls`}
												obj={studio}
												type="array"
												arrayType="string"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">
												{t('URLs to the ISAs, in order of importance (comma separated)')}
											</span>
										</label>
										<label className="field">
											<LabelActual label={t('Zone ID')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.zoneId`}
												obj={studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">{t('Zone ID (default value: "default")')}</span>
										</label>
										<label className="field">
											<LabelActual label={t('Server ID')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.serverId`}
												obj={studio}
												type="int"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">
												{t(
													'Server ID. For sources, this should generally be omitted (or set to 0) so clip-searches are zone-wide. If set, clip-searches are limited to that server.'
												)}
											</span>
										</label>

										<label className="field">
											<LabelActual label={t('Quantel transformer URL')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.transformerURL`}
												obj={studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">{t('URL to the Quantel HTTP transformer')}</span>
										</label>

										<label className="field">
											<LabelActual label={t('Quantel FileFlow URL')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.fileflowURL`}
												obj={studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">{t('URL to the Quantel FileFlow Manager')}</span>
										</label>

										<label className="field">
											<LabelActual label={t('Quantel FileFlow Profile name')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.fileflowProfile`}
												obj={studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">
												{t('Profile name to be used by FileFlow when exporting the clips')}
											</span>
										</label>
									</>
								) : null}

								<label className="field">
									<LabelActual label={t('Allow Read access')} />
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.allowRead`}
										obj={studio}
										type="checkbox"
										collection={Studios}
										className="input"
									></EditAttribute>
									<span className="text-s dimmed field-hint">{t('')}</span>
								</label>

								<label className="field">
									<LabelActual label={t('Allow Write access')} />
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.allowWrite`}
										obj={studio}
										type="checkbox"
										collection={Studios}
										className="input"
									></EditAttribute>
									<span className="text-s dimmed field-hint">{t('')}</span>
								</label>
							</div>
							<div className="mod">
								<button className="btn btn-primary right" onClick={() => finishEditAccessor(containerId, accessorId)}>
									<FontAwesomeIcon icon={faCheck} />
								</button>
							</div>
						</td>
					</tr>
				)}
			</React.Fragment>
		)
	})
}
