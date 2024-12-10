import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import type {
	CreateAdlibTestingRundownForShowStyleVariantProps,
	IngestUpdateRundownProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import type { JobContext } from '../jobs'
import { convertShowStyleVariantToBlueprints } from '../blueprints/context/lib'
import { ShowStyleUserContext } from '../blueprints/context'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import type {
	IShowStyleUserContext,
	IBlueprintShowStyleVariant,
	IngestRundown,
} from '@sofie-automation/blueprints-integration'
import { logger } from '../logging'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { handleUpdatedRundown } from './ingestRundownJobs'
import { runIngestUpdateOperation } from './runOperation'

export async function handleCreateAdlibTestingRundownForShowStyleVariant(
	context: JobContext,
	data: CreateAdlibTestingRundownForShowStyleVariantProps
): Promise<RundownId> {
	const showStyleVariant = await context.getShowStyleVariant(data.showStyleVariantId)
	const showStyleCompound = await context.getShowStyleCompound(showStyleVariant._id)
	const showStyleBlueprint = await context.getShowStyleBlueprint(showStyleCompound._id)

	const generateAdlibTestingIngestRundown =
		showStyleBlueprint.blueprint.generateAdlibTestingIngestRundown || fallbackBlueprintMethod
	const blueprintContext = new ShowStyleUserContext(
		{
			name: `Create Adlib Testing Rundown`,
			identifier: `studioId=${context.studioId},showStyleBaseId=${showStyleCompound._id},showStyleVariantId=${showStyleCompound.showStyleVariantId}`,
			tempSendUserNotesIntoBlackHole: true, // TODO-CONTEXT
		},
		context,
		showStyleCompound,
		WatchedPackagesHelper.empty(context) // No packages to provide here, as this is before there is a rundown
	)

	const ingestRundown = await Promise.resolve()
		.then(async () =>
			generateAdlibTestingIngestRundown(blueprintContext, convertShowStyleVariantToBlueprints(showStyleVariant))
		)
		.catch(async (e) => {
			throw UserError.from(e, UserErrorMessage.AdlibTestingRundownsGenerationFailed, { message: e.toString() })
		})

	// Prefix the externalId to avoid conflicts with real rundowns, and ensure it has a sensible value
	ingestRundown.externalId = `testing:${ingestRundown.externalId || showStyleVariant._id}`

	logger.info(
		`Creating adlib testing rundown "${ingestRundown.name}" for showStyleVariant "${showStyleVariant.name}"`
	)

	const updateData: IngestUpdateRundownProps = {
		rundownExternalId: ingestRundown.externalId,
		ingestRundown,
		isCreateAction: true,
		rundownSource: {
			type: 'testing',
			showStyleVariantId: showStyleVariant._id,
		},
	}
	return runIngestUpdateOperation(context, updateData, (ingestRundown) =>
		handleUpdatedRundown(context, updateData, ingestRundown)
	)
}

function fallbackBlueprintMethod(
	_context: IShowStyleUserContext,
	showStyleVariant: IBlueprintShowStyleVariant
): IngestRundown {
	return {
		externalId: '',
		name: `Rehearsal: ${showStyleVariant.name}`,
		type: 'rehearsal',
		payload: {},
		segments: [], // No contents
	}
}
