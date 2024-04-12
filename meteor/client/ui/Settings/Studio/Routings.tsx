import ClassNames from 'classnames'
import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import {
	DBStudio,
	StudioRouteSet,
	StudioRouteBehavior,
	RouteMapping,
	StudioRouteSetExclusivityGroup,
	StudioRouteType,
	MappingsExt,
	MappingExt,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import { EditAttribute, EditAttributeBase } from '../../../lib/EditAttribute'
import { doModalDialog } from '../../../lib/ModalDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPencilAlt, faCheck, faPlus } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { TSR } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { MappingsSettingsManifest, MappingsSettingsManifests } from './Mappings'
import { SchemaFormForCollection } from '../../../lib/forms/SchemaFormForCollection'
import { literal, objectPathGet } from '@sofie-automation/corelib/dist/lib'
import { DropdownInputControl, DropdownInputOption } from '../../../lib/Components/DropdownInput'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { Studios } from '../../../collections'
import {
	LabelActual,
	LabelAndOverrides,
	LabelAndOverridesForCheckbox,
	LabelAndOverridesForDropdown,
} from '../../../lib/Components/LabelAndOverrides'
import {
	WrappedOverridableItem,
	getAllCurrentAndDeletedItemsFromOverrides,
	useOverrideOpHelper,
} from '../util/OverrideOpHelper'
import {
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
	applyAndValidateOverrides,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { TextInputControl } from '../../../lib/Components/TextInput'
import { CheckboxControl } from '../../../lib/Components/Checkbox'

interface IStudioRoutingsProps {
	translationNamespaces: string[]
	studio: DBStudio
	studioMappings: ReadonlyDeep<MappingsExt>
	manifest: MappingsSettingsManifests | undefined
}

export function StudioRoutings({
	translationNamespaces,
	studio,
	studioMappings,
	manifest,
}: Readonly<IStudioRoutingsProps>): React.JSX.Element {
	const { t } = useTranslation()

	const editedItems: Array<string> = []

	// These must be handled in component, right now it's rerendered:
	// Taken from a functional componen using hooks
	const getRouteSetsFromOverrides = React.useMemo(
		() => getAllCurrentAndDeletedItemsFromOverrides(studio.routeSets, null),
		[studio.routeSets]
	)

	/*	const saveOverrides = (newOps: SomeObjectOverrideOp[]) => {
		Studios.update(studio._id, {
			$set: {
				routeSet: newOps,
			},
		})
	}
	*/

	const saveOverrides = React.useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			Studios.update(studio._id, {
				$set: {
					routeSet: newOps,
				},
			})
		},
		[studio.routeSets]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, studio.routeSets)

	const isItemEdited = (routeSetId: string) => {
		return editedItems.indexOf(routeSetId) >= 0
	}
	const finishEditItem = (routeSetId: string) => {
		const index = editedItems.indexOf(routeSetId)
		if (index >= 0) {
			editedItems.splice(index, 1)
		}
	}
	const editItem = (routeSetId: string) => {
		if (editedItems.indexOf(routeSetId) < 0) {
			editedItems.push(routeSetId)
		} else {
			finishEditItem(routeSetId)
		}
	}
	const confirmRemoveEGroup = (eGroupId: string, exclusivityGroup: StudioRouteSetExclusivityGroup) => {
		doModalDialog({
			title: t('Remove this Exclusivity Group?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				removeExclusivityGroup(eGroupId)
			},
			message: (
				<React.Fragment>
					<p>
						{t(
							'Are you sure you want to remove exclusivity group "{{eGroupName}}"?\nRoute Sets assigned to this group will be reset to no group.',
							{
								eGroupName: exclusivityGroup.name,
							}
						)}
					</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}
	const confirmRemoveRoute = (routeSetId: string, route: RouteMapping) => {
		doModalDialog({
			title: t('Remove this Route from this Route Set?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				removeRouteSetRoute(routeSetId)
			},
			message: (
				<React.Fragment>
					<p>
						{t('Are you sure you want to remove the Route from "{{sourceLayerId}}" to "{{newLayerId}}"?', {
							sourceLayerId: route.mappedLayer,
							newLayerId: route.outputMappedLayer,
						})}
					</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}
	const confirmRemove = (routeSetId: string) => {
		doModalDialog({
			title: t('Remove this Route Set?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				removeRouteSet(routeSetId)
			},
			message: (
				<React.Fragment>
					<p>{t('Are you sure you want to remove the Route Set "{{routeId}}"?', { routeId: routeSetId })}</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}
	const removeRouteSetRoute = (routeId: string) => {
		overrideHelper.deleteItem(routeId)
	}
	const removeRouteSet = (routeId: string) => {
		overrideHelper.deleteItem(routeId)
	}
	const updateRouteSetId = (edit: EditAttributeBase, newRouteId: string) => {
		const oldRouteId = edit.props.overrideDisplayValue
		overrideHelper.changeItemId(oldRouteId, newRouteId)

		finishEditItem(oldRouteId)
		editItem(newRouteId)
	}
	/*	const updateRouteSetActive = (routeSetId: string, value: boolean) => {
		overrideHelper.setItemValue(routeSetId, 'active', value)
	}
*/
	const addNewRouteSet = React.useCallback(() => {
		const resolvedRouteSets = applyAndValidateOverrides(studio.routeSets).obj

		// find free key name
		const newRouteKeyName = 'newLayer'
		let iter = 0
		while (resolvedRouteSets[newRouteKeyName + iter.toString()]) {
			iter++
		}

		const newId = newRouteKeyName + iter.toString()
		const newRoute = literal<StudioRouteSet>({
			name: 'New Route Set',
			active: false,
			routes: [],
			behavior: StudioRouteBehavior.TOGGLE,
		})

		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: newId,
			value: newRoute,
		})

		Studios.update(studio._id, {
			$push: {
				routeSet: addOp,
			},
		})
	}, [studio._id, studio.routeSets])

	const addNewRouteInSet = (routeId: string) => {
		console.log(routeId)
		/*			
			const newRouteKeyName = 'newRouteSet'
			let iter = 0
			while ((getRouteSetsFromOverrides() || {})[newRouteKeyName + iter]) {
				iter++
			}

			const newRoute: RouteMapping = {
				mappedLayer: '',
				outputMappedLayer: '',
				remapping: {},
				routeType: StudioRouteType.REROUTE,
			}
			const setObject: Record<string, any> = {}
			setObject['routeSets.' + routeId + '.routes'] = newRoute

			Studios.update(studio._id, {
				$push: setObject,
			})
			*/
	}

	const addNewExclusivityGroup = () => {
		const newEGroupKeyName = 'exclusivityGroup'
		let iter = 0
		while ((studio.routeSetExclusivityGroups || {})[newEGroupKeyName + iter]) {
			iter++
		}

		const newGroup: StudioRouteSetExclusivityGroup = {
			name: 'New Exclusivity Group',
		}
		const setObject: Record<string, any> = {}
		setObject['routeSetExclusivityGroups.' + newEGroupKeyName + iter] = newGroup

		Studios.update(studio._id, {
			$set: setObject,
		})
	}

	const removeExclusivityGroup = (eGroupId: string) => {
		const unsetObject: Record<string, 1> = {}
		_.forEach(getRouteSetsFromOverrides, (routeSet, routeSetId) => {
			if (routeSet.computed?.exclusivityGroup === eGroupId) {
				unsetObject['routeSets.' + routeSetId + '.exclusivityGroup'] = 1
			}
		})
		unsetObject['routeSetExclusivityGroups.' + eGroupId] = 1
		Studios.update(studio._id, {
			$unset: unsetObject,
		})
	}

	const updateExclusivityGroupId = (edit: EditAttributeBase, newValue: string) => {
		const oldRouteId = edit.props.overrideDisplayValue
		const newRouteId = newValue + ''
		const route = studio.routeSetExclusivityGroups[oldRouteId]

		if (studio.routeSetExclusivityGroups[newRouteId]) {
			throw new Meteor.Error(400, 'Exclusivity Group "' + newRouteId + '" already exists')
		}

		const mSet: Record<string, any> = {}
		const mUnset: Record<string, 1> = {}
		mSet['routeSetExclusivityGroups.' + newRouteId] = route
		mUnset['routeSetExclusivityGroups.' + oldRouteId] = 1

		if (edit.props.collection) {
			edit.props.collection.update(studio._id, {
				$set: mSet,
				$unset: mUnset,
			})
		}

		finishEditItem(oldRouteId)
		editItem(newRouteId)
	}

	function renderRoutes(
		routeSet: WrappedOverridableItem<StudioRouteSet>,
		routeSetId: string,
		manifest: MappingsSettingsManifests
	): React.JSX.Element {
		return (
			<React.Fragment>
				<h4 className="mod mhs">{t('Routes')}</h4>
				{routeSet.computed?.routes.length === 0 ? (
					<p className="text-s dimmed field-hint mhs">{t('There are no routes set up yet')}</p>
				) : null}
				{routeSet.computed?.routes.map((route, index) => {
					const mappedLayer = route.mappedLayer ? studioMappings[route.mappedLayer] : undefined
					const deviceTypeFromMappedLayer: TSR.DeviceType | undefined = mappedLayer?.device

					const routeDeviceType: TSR.DeviceType | undefined =
						route.routeType === StudioRouteType.REMAP
							? route.deviceType
							: route.mappedLayer
							? deviceTypeFromMappedLayer
							: route.deviceType

					const routeMappingSchema = manifest[(routeDeviceType ?? route.remapping?.device) as TSR.DeviceType]

					const rawMappingTypeOptions = Object.entries<JSONSchema>(routeMappingSchema?.mappingsSchema || {})
					const mappingTypeOptions = rawMappingTypeOptions.map(([id, entry], i) =>
						literal<DropdownInputOption<string | number>>({
							value: id + '',
							name: entry?.title ?? id + '',
							i,
						})
					)

					return (
						<div className="route-sets-editor mod pan mas" key={index}>
							<button className="action-btn right mod man pas" onClick={() => confirmRemoveRoute(routeSetId, route)}>
								<FontAwesomeIcon icon={faTrash} />
							</button>
							<div className="properties-grid">
								<label className="field">
									<LabelActual label={t('Original Layer')} />
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`routeSets.${routeSetId}.routes.${index}.mappedLayer`}
										obj={studio}
										type="dropdowntext"
										options={Object.keys(studioMappings)}
										label={t('None')}
										collection={Studios}
										className="input text-input input-l"
									></EditAttribute>
								</label>
								<label className="field">
									<LabelActual label={t('New Layer')} />
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`routeSets.${routeSetId}.routes.${index}.outputMappedLayer`}
										obj={studio}
										type="text"
										collection={Studios}
										className="input text-input input-l"
									></EditAttribute>
								</label>

								<label className="field">
									<LabelActual label={t('Route Type')} />
									{!route.mappedLayer ? (
										<span className="mls">REMAP</span>
									) : (
										<EditAttribute
											modifiedClassName="bghl"
											attribute={`routeSets.${routeSetId}.routes.${index}.routeType`}
											obj={studio}
											type="dropdown"
											options={StudioRouteType}
											optionsAreNumbers={true}
											collection={Studios}
											className="input text-input input-l"
										></EditAttribute>
									)}
								</label>

								<label className="field">
									<LabelActual label={t('Device Type')} />
									{route.routeType === StudioRouteType.REROUTE && route.mappedLayer ? (
										deviceTypeFromMappedLayer !== undefined ? (
											<span className="mls">{TSR.DeviceType[deviceTypeFromMappedLayer]}</span>
										) : (
											<span className="mls dimmed">{t('Source Layer not found')}</span>
										)
									) : (
										<EditAttribute
											modifiedClassName="bghl"
											attribute={`routeSets.${routeSetId}.routes.${index}.deviceType`}
											obj={studio}
											type="dropdown"
											options={TSR.DeviceType}
											optionsAreNumbers={true}
											collection={Studios}
											className="input text-input input-l"
										></EditAttribute>
									)}
								</label>

								{mappingTypeOptions.length > 0 && (
									<label className="field">
										<LabelActual label={t('Mapping Type')} />
										<EditAttribute
											modifiedClassName="bghl"
											attribute={`routeSets.${routeSetId}.routes.${index}.remapping.options.mappingType`}
											obj={studio}
											type="dropdown"
											options={mappingTypeOptions}
											collection={Studios}
											className="input text-input input-l"
										></EditAttribute>
									</label>
								)}
								{route.routeType === StudioRouteType.REMAP ||
								(routeDeviceType !== undefined && route.remapping !== undefined) ? (
									<>
										<label className="field">
											<LabelActual label={t('Device ID')} />
											<div>
												<EditAttribute
													modifiedClassName="bghl"
													attribute={`routeSets.${routeSetId}.routes.${index}.remapping.deviceId`}
													obj={studio}
													type="checkbox"
													collection={Studios}
													className="mrs mvxs"
													mutateDisplayValue={(v) => (v === undefined ? false : true)}
													mutateUpdateValue={() => undefined}
												/>
												<EditAttribute
													modifiedClassName="bghl"
													attribute={`routeSets.${routeSetId}.routes.${index}.remapping.deviceId`}
													obj={studio}
													type="text"
													collection={Studios}
													className="input text-input input-l"
												></EditAttribute>
											</div>
										</label>

										<DeviceMappingSettings
											translationNamespaces={translationNamespaces}
											studio={studio}
											attribute={`routeSets.${routeSetId}.routes.${index}.remapping.options`}
											mappedLayer={mappedLayer}
											manifest={routeMappingSchema}
										/>
									</>
								) : null}
							</div>
						</div>
					)
				})}
			</React.Fragment>
		)
	}

	function renderExclusivityGroups() {
		if (Object.keys(studio.routeSetExclusivityGroups).length === 0) {
			return (
				<tr>
					<td className="mhn dimmed">{t('There are no exclusivity groups set up.')}</td>
				</tr>
			)
		}

		return _.map(
			studio.routeSetExclusivityGroups,
			(exclusivityGroup: StudioRouteSetExclusivityGroup, exclusivityGroupId: string) => {
				return (
					<React.Fragment key={exclusivityGroupId}>
						<tr
							className={ClassNames({
								hl: isItemEdited(exclusivityGroupId),
							})}
						>
							<th className="settings-studio-device__name c3">{exclusivityGroupId}</th>
							<td className="settings-studio-device__id c5">{exclusivityGroup.name}</td>
							<td className="settings-studio-device__id c3">
								{
									_.filter(
										getRouteSetsFromOverrides,
										(routeSet) => routeSet.computed?.exclusivityGroup === exclusivityGroupId
									).length
								}
							</td>

							<td className="settings-studio-device__actions table-item-actions c3">
								<button className="action-btn" onClick={() => editItem(exclusivityGroupId)}>
									<FontAwesomeIcon icon={faPencilAlt} />
								</button>
								<button
									className="action-btn"
									onClick={() => confirmRemoveEGroup(exclusivityGroupId, exclusivityGroup)}
								>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</td>
						</tr>
						{isItemEdited(exclusivityGroupId) && (
							<tr className="expando-details hl">
								<td colSpan={6}>
									<div className="properties-grid">
										<label className="field">
											<LabelActual label={t('Exclusivity Group ID')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={'routeSetExclusivityGroups'}
												overrideDisplayValue={exclusivityGroupId}
												obj={studio}
												type="text"
												collection={Studios}
												updateFunction={updateExclusivityGroupId}
												className="input text-input input-l"
											></EditAttribute>
										</label>
										<label className="field">
											<LabelActual label={t('Exclusivity Group Name')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={'routeSetExclusivityGroups.' + exclusivityGroupId + '.name'}
												obj={studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">{t('Display name of the Exclusivity Group')}</span>
										</label>
									</div>
									<div className="mod alright">
										<button className="btn btn-primary" onClick={() => finishEditItem(exclusivityGroupId)}>
											<FontAwesomeIcon icon={faCheck} />
										</button>
									</div>
								</td>
							</tr>
						)}
					</React.Fragment>
				)
			}
		)
	}

	function renderRouteSets(manifest: MappingsSettingsManifests) {
		const DEFAULT_ACTIVE_OPTIONS = {
			[t('Active')]: true,
			[t('Not Active')]: false,
			[t('Not defined')]: undefined,
		}

		if (Object.keys(studio.routeSets).length === 0) {
			return (
				<tr>
					<td className="mhn dimmed">{t('There are no Route Sets set up.')}</td>
				</tr>
			)
		}
		return _.map(getRouteSetsFromOverrides, (routeSet: WrappedOverridableItem<StudioRouteSet>) => {
			return (
				<React.Fragment key={routeSet.id}>
					<tr
						className={ClassNames({
							hl: isItemEdited(routeSet.id),
						})}
					>
						<th className="settings-studio-device__name c2">{routeSet.id}</th>
						<td className="settings-studio-device__id c3">{routeSet.computed?.name}</td>
						<td className="settings-studio-device__id c4">{routeSet.computed?.exclusivityGroup}</td>
						<td className="settings-studio-device__id c2">{routeSet.computed?.routes.length}</td>
						<td className="settings-studio-device__id c2">
							{routeSet.computed?.active ? <span className="pill">{t('Active')}</span> : null}
						</td>

						<td className="settings-studio-device__actions table-item-actions c3">
							<button className="action-btn" onClick={() => editItem(routeSet.id)}>
								<FontAwesomeIcon icon={faPencilAlt} />
							</button>
							<button className="action-btn" onClick={() => confirmRemove(routeSet.id)}>
								<FontAwesomeIcon icon={faTrash} />
							</button>
						</td>
					</tr>
					{isItemEdited(routeSet.id) && (
						<tr className="expando-details hl">
							<td colSpan={6}>
								<div className="properties-grid">
									<label className="field">
										<LabelActual label={t('Route Set ID')} />
										<EditAttribute
											modifiedClassName="bghl"
											attribute={'routeSets'}
											overrideDisplayValue={routeSet.id}
											obj={studio}
											type="text"
											collection={Studios}
											updateFunction={updateRouteSetId}
											className="input text-input input-l"
										></EditAttribute>
									</label>
									{routeSet.type === 'normal' ? (
										<div>
											<LabelAndOverrides
												label={t('Route Set Name')}
												item={routeSet}
												itemKey={'name'}
												opPrefix={routeSet.id}
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
											<LabelAndOverridesForCheckbox
												label={t('Active')}
												item={routeSet}
												itemKey={'active'}
												opPrefix={routeSet.id}
												overrideHelper={overrideHelper}
											>
												{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
											</LabelAndOverridesForCheckbox>
											<LabelAndOverridesForDropdown
												label={t('Defualt State')}
												item={routeSet}
												itemKey={'defaultActive'}
												opPrefix={routeSet.id}
												overrideHelper={overrideHelper}
												options={DEFAULT_ACTIVE_OPTIONS as any as DropdownInputOption<number>[]}
												hint={t('The way this Route Set should behave towards the user')}
											>
												{(value, handleUpdate, options) => (
													<DropdownInputControl
														classNames="input text-input input-l"
														options={options}
														value={value as number}
														handleUpdate={handleUpdate}
													/>
												)}
											</LabelAndOverridesForDropdown>
											<LabelAndOverridesForDropdown
												label={t('Behavior')}
												hint={t('The way this Route Set should behave towards the user')}
												item={routeSet}
												itemKey={'behavior'}
												opPrefix={routeSet.id}
												overrideHelper={overrideHelper}
												options={StudioRouteBehavior as any as DropdownInputOption<number>[]}
											>
												{(value, handleUpdate, options) => (
													<DropdownInputControl
														classNames="input text-input input-l"
														options={options}
														value={value as number}
														handleUpdate={handleUpdate}
													/>
												)}
											</LabelAndOverridesForDropdown>
										</div>
									) : null}
									<label className="field">
										<LabelActual label={t('Exclusivity group')} />
										<div>
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`routeSets.${routeSet.id}.exclusivityGroup`}
												obj={studio}
												type="checkbox"
												className="mrs mvxs"
												collection={Studios}
												mutateDisplayValue={(v) => (v === undefined ? false : true)}
												mutateUpdateValue={() => undefined}
											/>
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`routeSets.${routeSet.id}.exclusivityGroup`}
												obj={studio}
												type="dropdown"
												options={Object.keys(studio.routeSetExclusivityGroups)}
												mutateDisplayValue={(v) => (v === undefined ? 'None' : v)}
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
										</div>
										<span className="text-s dimmed field-hint">
											{t('If set, only one Route Set will be active per exclusivity group')}
										</span>
									</label>
								</div>
								{renderRoutes(routeSet, routeSet.id, manifest)}
								<div className="mod">
									<button className="btn btn-primary right" onClick={() => finishEditItem(routeSet.id)}>
										<FontAwesomeIcon icon={faCheck} />
									</button>
									<button className="btn btn-secondary" onClick={() => addNewRouteInSet(routeSet.id)}>
										<FontAwesomeIcon icon={faPlus} />
									</button>
								</div>
							</td>
						</tr>
					)}
				</React.Fragment>
			)
		})
	}

	return (
		<div>
			<h2 className="mhn mbs">{t('Route Sets')}</h2>
			{!manifest && <span>{t('Add a playout device to the studio in order to configure the route sets')}</span>}
			{manifest && (
				<React.Fragment>
					<p className="mhn mvs text-s dimmed field-hint">
						{t(
							'Controls for exposed Route Sets will be displayed to the producer within the Rundown View in the Switchboard.'
						)}
					</p>
					<h3 className="mhn">{t('Exclusivity Groups')}</h3>
					<table className="expando settings-studio-mappings-table">
						<tbody>{renderExclusivityGroups()}</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={() => addNewExclusivityGroup()}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
					<h3 className="mhn">{t('Route Sets')}</h3>
					<table className="expando settings-studio-mappings-table">
						<tbody>{renderRouteSets(manifest)}</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={() => addNewRouteSet()}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
				</React.Fragment>
			)}
		</div>
	)
}

interface IDeviceMappingSettingsProps {
	translationNamespaces: string[]
	studio: DBStudio
	attribute: string
	manifest: MappingsSettingsManifest | undefined
	mappedLayer: ReadonlyDeep<MappingExt> | undefined
}

function DeviceMappingSettings({
	translationNamespaces,
	attribute,
	manifest,
	studio,
	mappedLayer,
}: IDeviceMappingSettingsProps) {
	const routeRemapping = objectPathGet(studio, attribute)

	const mappingType = routeRemapping?.mappingType ?? mappedLayer?.options?.mappingType
	const mappingSchema = manifest?.mappingsSchema?.[mappingType]

	if (mappingSchema && routeRemapping) {
		return (
			<SchemaFormForCollection
				schema={mappingSchema}
				object={routeRemapping}
				basePath={attribute}
				translationNamespaces={translationNamespaces}
				collection={Studios}
				objectId={studio._id}
				partialOverridesForObject={mappedLayer}
			/>
		)
	} else {
		return null
	}
}
