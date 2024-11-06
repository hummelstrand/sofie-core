import type { OrganizationId } from '@sofie-automation/corelib/dist/dataModel/Ids.js'

export interface NewOrganizationAPI {
	removeOrganization(organizationId: OrganizationId): Promise<void>
}

export enum OrganizationAPIMethods {
	'removeOrganization' = 'organization.removeOrganization',
}
