import ClassNames from 'classnames'
import * as React from 'react'
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
import { faTrash, faPencilAlt, faCheck, faPlus, faSync } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { TSR } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { MappingsSettingsManifest, MappingsSettingsManifests } from './Mappings'
import { SchemaFormForCollection } from '../../../lib/forms/SchemaFormForCollection'
import { literal, objectPathGet } from '@sofie-automation/corelib/dist/lib'
import {
	DropdownInputControl,
	DropdownInputOption,
	getDropdownInputOptions,
} from '../../../lib/Components/DropdownInput'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { Studios } from '../../../collections'
import {
	LabelActual,
	LabelAndOverrides,
	LabelAndOverridesForCheckbox,
	LabelAndOverridesForDropdown,
} from '../../../lib/Components/LabelAndOverrides'
import {
	OverrideOpHelper,
	WrappedOverridableItem,
	WrappedOverridableItemDeleted,
	WrappedOverridableItemNormal,
	getAllCurrentAndDeletedItemsFromOverrides,
	useOverrideOpHelper,
} from '../../util/OverrideOpHelper'
import {
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
	applyAndValidateOverrides,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useToggleExpandHelper } from '../../util/useToggleExpandHelper'
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
	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const getRouteSetsFromOverrides = React.useMemo(
		() => getAllCurrentAndDeletedItemsFromOverrides(studio.routeSets, null),
		[studio.routeSets]
	)

	const getExclusivityGroupsFromOverrides = React.useMemo(
		() => getAllCurrentAndDeletedItemsFromOverrides(studio.routeSetExclusivityGroups, null),
		[studio.routeSetExclusivityGroups]
	)

	const saveOverrides = React.useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			Studios.update(studio._id, {
				$set: {
					'routeSets.overrides': newOps,
				},
			})
		},
		[studio._id]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, studio.routeSets)

	const addNewRouteSet = React.useCallback(() => {
		const resolvedRouteSets = applyAndValidateOverrides(studio.routeSets).obj

		// find free key name
		const newRouteKeyName = 'newRouteSet'
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
				'routeSets.overrides': addOp,
			},
		})

		setTimeout(() => {
			toggleExpanded(newId, true)
		}, 1)
	}, [studio._id, studio.routeSets])

	const addNewExclusivityGroup = React.useCallback(() => {
		const newGroupKeyName = 'exclusivityGroup'
		const resolvedGroups = applyAndValidateOverrides(studio.routeSetExclusivityGroups).obj

		let iter = 0
		while (resolvedGroups[newGroupKeyName + iter.toString()]) {
			iter++
		}

		const newId = newGroupKeyName + iter.toString()
		const newGroup: StudioRouteSetExclusivityGroup = {
			name: 'New Exclusivity Group' + iter.toString(),
		}
		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: newId,
			value: newGroup,
		})

		Studios.update(studio._id, {
			$push: {
				'routeSetExclusivityGroups.overrides': addOp,
			},
		})

		setTimeout(() => {
			toggleExpanded(newId, true)
		}, 1)
	}, [studio._id, studio.routeSetExclusivityGroups])

	if (Object.keys(studio.routeSets).length === 0) {
		return (
			<tr>
				<td className="mhn dimmed">{t('There are no Route Sets set up.')}</td>
			</tr>
		)
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
						<tbody>
							<RenderExclusivityGroups
								studio={studio}
								getRouteSetsFromOverrides={getRouteSetsFromOverrides}
								isExpanded={isExpanded}
								toggleExpanded={toggleExpanded}
								getExclusivityGroupsFromOverrides={getExclusivityGroupsFromOverrides}
							/>
						</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={() => addNewExclusivityGroup()}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
					<h3 className="mhn">{t('Route Sets')}</h3>
					<table className="expando settings-studio-mappings-table">
						<tbody>
							{_.map(getRouteSetsFromOverrides, (routeSet: WrappedOverridableItem<StudioRouteSet>) => {
								return (
									<React.Fragment key={routeSet.id}>
										{routeSet.type === 'normal' ? (
											<RenderRouteSet
												routeSet={routeSet}
												manifest={manifest}
												studio={studio}
												translationNamespaces={translationNamespaces}
												studioMappings={studioMappings}
												toggleExpanded={toggleExpanded}
												isExpanded={isExpanded(routeSet.id)}
												overrideHelper={overrideHelper}
												getExclusivityGroupsFromOverrides={getExclusivityGroupsFromOverrides}
											/>
										) : (
											<RenderRouteSetDeletedEntry routeSet={routeSet} overrideHelper={overrideHelper} />
										)}
									</React.Fragment>
								)
							})}
						</tbody>
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

interface IRenderRouteSetProps {
	routeSet: WrappedOverridableItemNormal<StudioRouteSet>
	manifest: MappingsSettingsManifests
	studio: DBStudio
	translationNamespaces: string[]
	studioMappings: ReadonlyDeep<MappingsExt>
	toggleExpanded: (layerId: string, force?: boolean) => void
	isExpanded: boolean
	overrideHelper: OverrideOpHelper
	getExclusivityGroupsFromOverrides: WrappedOverridableItem<StudioRouteSetExclusivityGroup>[]
}

function RenderRouteSet({
	routeSet,
	manifest,
	studio,
	translationNamespaces,
	toggleExpanded,
	isExpanded,
	studioMappings,
	overrideHelper,
	getExclusivityGroupsFromOverrides,
}: Readonly<IRenderRouteSetProps>): React.JSX.Element {
	const { t } = useTranslation()
	const toggleEditRouteSet = React.useCallback(() => toggleExpanded(routeSet.id), [toggleExpanded, routeSet.id])

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

	const removeRouteSet = (routeId: string) => {
		overrideHelper.deleteItem(routeId)
	}

	const addNewRouteInSet = (routeId: string) => {
		const newRoutes = routeSet.computed?.routes || []

		newRoutes.push({
			mappedLayer: '',
			outputMappedLayer: '',
			remapping: {},
			routeType: StudioRouteType.REROUTE,
		})

		overrideHelper.setItemValue(routeId, 'routes', newRoutes)
	}

	const updateRouteSetId = React.useCallback(
		(newRouteSetId: string) => {
			overrideHelper.changeItemId(routeSet.id, newRouteSetId)
			toggleExpanded(newRouteSetId, true)
		},
		[overrideHelper, toggleExpanded, routeSet.id]
	)

	const exclusivityGroupOptions = React.useMemo(() => {
		return getDropdownInputOptions([
			{
				name: 'None',
				value: undefined,
			},
			...getExclusivityGroupsFromOverrides.map((group) => group.computed?.name || group.id),
		])
	}, [studio.routeSetExclusivityGroups, studio.routeSetExclusivityGroups])

	const DEFAULT_ACTIVE_OPTIONS = {
		[t('Active')]: true,
		[t('Not Active')]: false,
		[t('Not defined')]: undefined,
	}

	return (
		<React.Fragment>
			<tr
				className={ClassNames({
					hl: isExpanded,
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
					<button className="action-btn" onClick={toggleEditRouteSet}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
					<button className="action-btn" onClick={() => confirmRemove(routeSet.id)}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</td>
			</tr>
			{isExpanded && (
				<tr className="expando-details hl">
					<td colSpan={6}>
						<div className="properties-grid">
							<label className="field">
								<LabelActual label={t('Route Set ID')} />
								<TextInputControl
									modifiedClassName="bghl"
									classNames="input text-input input-l"
									value={routeSet.id}
									handleUpdate={updateRouteSetId}
									disabled={!!routeSet.defaults}
								/>
							</label>
							<LabelAndOverridesForDropdown<any>
								label={t('Default State')}
								hint={t('he default state of this Route Set')}
								item={routeSet}
								itemKey={'defaultActive'}
								opPrefix={routeSet.id}
								overrideHelper={overrideHelper}
								options={getDropdownInputOptions(DEFAULT_ACTIVE_OPTIONS)}
							>
								{(value, handleUpdate, options) => (
									<DropdownInputControl
										classNames="input text-input input-l"
										options={options}
										value={value}
										handleUpdate={handleUpdate}
									/>
								)}
							</LabelAndOverridesForDropdown>
							<LabelAndOverridesForCheckbox
								label={t('Active')}
								item={routeSet}
								itemKey={'active'}
								opPrefix={routeSet.id}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
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

							<LabelAndOverridesForDropdown<any>
								label={'Exclusivity group'}
								hint={t('If set, only one Route Set will be active per exclusivity group')}
								item={routeSet}
								itemKey={'exclusivityGroup'}
								opPrefix={routeSet.id}
								overrideHelper={overrideHelper}
								options={exclusivityGroupOptions}
							>
								{(value, handleUpdate, options) => (
									<DropdownInputControl
										classNames="input text-input input-l"
										options={options}
										value={value}
										handleUpdate={handleUpdate}
									/>
								)}
							</LabelAndOverridesForDropdown>

							<LabelAndOverridesForDropdown<any>
								label={t('Behavior')}
								hint={t('The way this Route Set should behave towards the user')}
								item={routeSet}
								itemKey={'behavior'}
								opPrefix={routeSet.id}
								overrideHelper={overrideHelper}
								options={getDropdownInputOptions(StudioRouteBehavior)}
							>
								{(value, handleUpdate, options) => (
									<DropdownInputControl
										classNames="input text-input input-l"
										options={options}
										value={value}
										handleUpdate={handleUpdate}
									/>
								)}
							</LabelAndOverridesForDropdown>
						</div>
						<RenderRoutes
							routeSet={routeSet}
							routeSetId={routeSet.id}
							studio={studio}
							manifest={manifest}
							translationNamespaces={translationNamespaces}
							overrideHelper={overrideHelper}
							studioMappings={studioMappings}
						/>
						<div className="mod">
							<button className="btn btn-primary right" onClick={() => toggleExpanded(routeSet.id)}>
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
}

interface IRenderRouteSetDeletedProps {
	routeSet: WrappedOverridableItemDeleted<StudioRouteSet>
	overrideHelper: OverrideOpHelper
}

function RenderRouteSetDeletedEntry({ routeSet, overrideHelper }: Readonly<IRenderRouteSetDeletedProps>) {
	const doUndelete = (routeSetId: string) => {
		overrideHelper.resetItem(routeSetId)
	}

	const doUndeleteItem = React.useCallback(() => doUndelete(routeSet.id), [doUndelete, routeSet.id])

	return (
		<tr>
			<th className="settings-studio-device__name c3 notifications-s notifications-text">{routeSet.defaults.name}</th>
			<td className="settings-studio-device__id c2 deleted">{routeSet.defaults.name}</td>
			<td className="settings-studio-device__id c2 deleted">{routeSet.id}</td>
			<td className="settings-studio-output-table__actions table-item-actions c3">
				<button className="action-btn" onClick={doUndeleteItem} title="Restore to defaults">
					<FontAwesomeIcon icon={faSync} />
				</button>
			</td>
		</tr>
	)
}

interface IRenderRoutesProps {
	routeSet: WrappedOverridableItem<StudioRouteSet>
	studio: DBStudio
	routeSetId: string
	manifest: MappingsSettingsManifests
	translationNamespaces: string[]
	overrideHelper: OverrideOpHelper
	studioMappings: ReadonlyDeep<MappingsExt>
}

function RenderRoutes({
	routeSet,
	routeSetId,
	studio,
	manifest,
	translationNamespaces,
	overrideHelper,
	studioMappings,
}: Readonly<IRenderRoutesProps>): React.JSX.Element {
	const { t } = useTranslation()

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

	const removeRouteSetRoute = (routeId: string) => {
		overrideHelper.deleteItem(routeId)
	}

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

interface IRenderExclusivityGroupsProps {
	studio: DBStudio
	toggleExpanded: (exclusivityGroupId: string, force?: boolean) => void
	isExpanded: (exclusivityGroupId: string) => boolean
	getRouteSetsFromOverrides: WrappedOverridableItem<StudioRouteSet>[]
	getExclusivityGroupsFromOverrides: WrappedOverridableItem<StudioRouteSetExclusivityGroup>[]
}

function RenderExclusivityGroups({
	studio,
	toggleExpanded,
	isExpanded,
	getRouteSetsFromOverrides,
	getExclusivityGroupsFromOverrides,
}: Readonly<IRenderExclusivityGroupsProps>): React.JSX.Element {
	const { t } = useTranslation()

	const saveOverrides = React.useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			Studios.update(studio._id, {
				$set: {
					'routeSetExclusivityGroups.overrides': newOps,
				},
			})
		},
		[studio._id]
	)

	const exclusivityOverrideHelper = useOverrideOpHelper(saveOverrides, studio.routeSetExclusivityGroups)

	if (getExclusivityGroupsFromOverrides.length === 0) {
		return (
			<tr>
				<td className="mhn dimmed">{t('There are no exclusivity groups set up.')}</td>
			</tr>
		)
	}
	return (
		<React.Fragment>
			{_.map(
				getExclusivityGroupsFromOverrides,
				(exclusivityGroup: WrappedOverridableItem<StudioRouteSetExclusivityGroup>) => {
					return (
						<React.Fragment key={exclusivityGroup.id}>
							{exclusivityGroup.type === 'normal' ? (
								<RenderExclusivityGroup
									exclusivityGroup={exclusivityGroup}
									studio={studio}
									toggleExpanded={toggleExpanded}
									isExpanded={isExpanded(exclusivityGroup.id)}
									getRouteSetsFromOverrides={getRouteSetsFromOverrides}
									exclusivityOverrideHelper={exclusivityOverrideHelper}
								/>
							) : (
								<RenderExclusivityDeletedGroup
									exclusivityGroup={exclusivityGroup}
									exlusivityOverrideHelper={exclusivityOverrideHelper}
								/>
							)}
						</React.Fragment>
					)
				}
			)}
		</React.Fragment>
	)
}

interface IRenderExclusivityGroupProps {
	exclusivityGroup: WrappedOverridableItemNormal<StudioRouteSetExclusivityGroup>
	studio: DBStudio
	toggleExpanded: (exclusivityGroupId: string, force?: boolean) => void
	isExpanded: boolean
	getRouteSetsFromOverrides: WrappedOverridableItem<StudioRouteSet>[]
	exclusivityOverrideHelper: OverrideOpHelper
}

function RenderExclusivityGroup({
	exclusivityGroup,
	studio,
	toggleExpanded,
	isExpanded,
	getRouteSetsFromOverrides,
	exclusivityOverrideHelper: overrideHelper,
}: Readonly<IRenderExclusivityGroupProps>): React.JSX.Element {
	const { t } = useTranslation()

	const removeExclusivityGroup = (eGroupId: string) => {
		overrideHelper.deleteItem(eGroupId)
	}

	const confirmRemoveEGroup = () => {
		doModalDialog({
			title: t('Remove this Exclusivity Group?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				removeExclusivityGroup(exclusivityGroup.id)
			},
			message: (
				<React.Fragment>
					<p>
						{t(
							'Are you sure you want to remove exclusivity group "{{eGroupName}}"?\nRoute Sets assigned to this group will be reset to no group.',
							{
								eGroupName: exclusivityGroup.computed?.name,
							}
						)}
					</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}
	const updateExclusivityGroupId = (edit: EditAttributeBase, newValue: string) => {
		const oldGroupId = edit.props.overrideDisplayValue
		const newGroupId = newValue + ''
		const group = exclusivityGroup.computed

		// if (studio.routeSetExclusivityGroups[newRouteId]) {
		// 	throw new Meteor.Error(400, 'Exclusivity Group "' + newRouteId + '" already exists')
		// }

		const mSet: Record<string, any> = {}
		const mUnset: Record<string, 1> = {}
		mSet['routeSetExclusivityGroups.' + newGroupId] = group
		mUnset['routeSetExclusivityGroups.' + oldGroupId] = 1

		if (edit.props.collection) {
			edit.props.collection.update(studio._id, {
				$set: mSet,
				$unset: mUnset,
			})
		}

		toggleExpanded(oldGroupId)
		toggleExpanded(newGroupId)
	}
	return (
		<React.Fragment>
			<tr
				className={ClassNames({
					hl: isExpanded,
				})}
			>
				<th className="settings-studio-device__name c3">{exclusivityGroup.id}</th>
				<td className="settings-studio-device__id c5">{exclusivityGroup.computed?.name}</td>
				<td className="settings-studio-device__id c3">
					{
						_.filter(
							getRouteSetsFromOverrides,
							(routeSet) => routeSet.computed?.exclusivityGroup === exclusivityGroup.id
						).length
					}
				</td>

				<td className="settings-studio-device__actions table-item-actions c3">
					<button className="action-btn" onClick={() => toggleExpanded(exclusivityGroup.id)}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
					<button className="action-btn" onClick={confirmRemoveEGroup}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</td>
			</tr>
			{isExpanded && (
				<tr className="expando-details hl">
					<td colSpan={6}>
						<div className="properties-grid">
							<label className="field">
								<LabelActual label={t('Exclusivity Group ID')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={'routeSetExclusivityGroups'}
									overrideDisplayValue={exclusivityGroup.id}
									obj={studio}
									type="text"
									collection={Studios}
									updateFunction={updateExclusivityGroupId}
									className="input text-input input-l"
								></EditAttribute>
							</label>
							<LabelAndOverrides
								label={t('Exclusivity Group Name')}
								item={exclusivityGroup}
								itemKey={'name'}
								opPrefix={exclusivityGroup.id}
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
						</div>
						<div className="mod alright">
							<button className="btn btn-primary" onClick={() => toggleExpanded(exclusivityGroup.id)}>
								<FontAwesomeIcon icon={faCheck} />
							</button>
						</div>
					</td>
				</tr>
			)}
		</React.Fragment>
	)
}

interface IRenderExclusivityDeletedGroupProps {
	exclusivityGroup: WrappedOverridableItemDeleted<StudioRouteSetExclusivityGroup>
	exlusivityOverrideHelper: OverrideOpHelper
}

function RenderExclusivityDeletedGroup({
	exclusivityGroup,
	exlusivityOverrideHelper: overrideHelper,
}: Readonly<IRenderExclusivityDeletedGroupProps>): React.JSX.Element {
	const doUndelete = (groupId: string) => {
		overrideHelper.resetItem(groupId)
	}

	const doUndeleteItem = React.useCallback(() => doUndelete(exclusivityGroup.id), [doUndelete, exclusivityGroup.id])

	return (
		<tr>
			<th className="settings-studio-device__name c3 notifications-s notifications-text">
				{exclusivityGroup.defaults?.name}
			</th>
			<td className="settings-studio-device__id c2 deleted">{exclusivityGroup.defaults?.name}</td>
			<td className="settings-studio-device__id c2 deleted">{exclusivityGroup.id}</td>
			<td className="settings-studio-output-table__actions table-item-actions c3">
				<button className="action-btn" onClick={doUndeleteItem} title="Restore to defaults">
					<FontAwesomeIcon icon={faSync} />
				</button>
			</td>
		</tr>
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
