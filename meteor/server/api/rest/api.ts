import Koa from 'koa'
import cors from '@koa/cors'
import KoaRouter from '@koa/router'
import { logger } from '../../logging'
import { WebApp } from 'meteor/webapp'
import { check, Match } from '../../../lib/check'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../../lib/api/client'
import { getCurrentTime, getRandomString, protectString } from '../../../lib/lib'
import { RestAPI, RestAPIMethods } from '../../../lib/api/rest'
import { registerClassToMeteorMethods, ReplaceOptionalWithNullInMethodArguments } from '../../methods'
import { RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { MethodContextAPI } from '../../../lib/api/methods'
import { ServerClientAPI } from '../client'
import { ServerRundownAPI } from '../rundown'
import { triggerWriteAccess } from '../../security/lib/securityVerify'
import { ExecuteActionResult, StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { CURRENT_SYSTEM_VERSION } from '../../migration/currentSystemVersion'
import {
	AdLibActionId,
	BucketAdLibId,
	PartId,
	PartInstanceId,
	PieceId,
	RundownBaselineAdLibActionId,
	RundownPlaylistId,
	SegmentId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { AdLibPieces } from '../../../lib/collections/AdLibPieces'
import { AdLibActions } from '../../../lib/collections/AdLibActions'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { RundownBaselineAdLibActions } from '../../../lib/collections/RundownBaselineAdLibActions'
import { BucketAdLibs } from '../../../lib/collections/BucketAdlibs'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { StudioContentWriteAccess } from '../../security/studio'
import { ServerPlayoutAPI } from '../playout/playout'
import { TriggerReloadDataResponse } from '../../../lib/api/userActions'
import { interpollateTranslation, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'

function restAPIUserEvent(
	ctx: Koa.ParameterizedContext<
		Koa.DefaultState,
		Koa.DefaultContext & KoaRouter.RouterParamContext<Koa.DefaultState, Koa.DefaultContext>,
		unknown
	>
): string {
	return `rest_api_${ctx.method}_${ctx.URL.toString()}`
}

class ServerRestAPI extends MethodContextAPI implements ReplaceOptionalWithNullInMethodArguments<RestAPI> {
	async index(): Promise<ClientAPI.ClientResponse<{ version: string }>> {
		triggerWriteAccess()

		return ClientAPI.responseSuccess({ version: CURRENT_SYSTEM_VERSION })
	}
	async activate(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal: boolean
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(rehearsal, Boolean)
			},
			StudioJobs.ActivateRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
				rehearsal,
			}
		)
	}
	async deactivate(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.DeactivateRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async executeAction(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		actionId: string,
		userData: any
	): Promise<ClientAPI.ClientResponse<ExecuteActionResult>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(actionId, String)
			},
			StudioJobs.ExecuteAction,
			{
				playlistId: rundownPlaylistId,
				actionDocId: null,
				actionId,
				userData,
			}
		)
	}
	async executeAdLib(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		adLibId: AdLibActionId | RundownBaselineAdLibActionId | PieceId | BucketAdLibId,
		triggerMode?: string | null
	): Promise<ClientAPI.ClientResponse<object>> {
		const baselineAdLibPiece = RundownBaselineAdLibPieces.findOneAsync(adLibId as PieceId, {
			projection: { _id: 1 },
		})
		const segmentAdLibPiece = AdLibPieces.findOneAsync(adLibId as PieceId, { projection: { _id: 1 } })
		const bucketAdLibPiece = BucketAdLibs.findOneAsync(adLibId as BucketAdLibId, { projection: { _id: 1 } })
		const [baselineAdLibDoc, segmentAdLibDoc, bucketAdLibDoc, adLibAction, baselineAdLibAction] = await Promise.all(
			[
				baselineAdLibPiece,
				segmentAdLibPiece,
				bucketAdLibPiece,
				AdLibActions.findOneAsync(adLibId as AdLibActionId, {
					projection: { _id: 1, actionId: 1, userData: 1 },
				}),
				RundownBaselineAdLibActions.findOneAsync(adLibId as RundownBaselineAdLibActionId, {
					projection: { _id: 1, actionId: 1, userData: 1 },
				}),
			]
		)
		const adLibActionDoc = adLibAction ?? baselineAdLibAction
		const regularAdLibDoc = baselineAdLibDoc ?? segmentAdLibDoc ?? bucketAdLibDoc
		if (regularAdLibDoc) {
			// This is an AdLib Piece
			const pieceType = baselineAdLibDoc ? 'baseline' : segmentAdLibDoc ? 'normal' : 'bucket'
			const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId, {
				projection: { currentPartInstanceId: 1 },
			})
			if (!rundownPlaylist) throw new Error(`Rundown playlist ${rundownPlaylistId} does not exist`)
			if (rundownPlaylist.currentPartInstanceId === null)
				throw new Error(`No active Part in ${rundownPlaylistId}`)

			const result = await ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				{ ...this, connection: connection },
				event,
				getCurrentTime(),
				rundownPlaylistId,
				() => {
					check(rundownPlaylistId, String)
					check(adLibId, Match.OneOf(String, null))
				},
				StudioJobs.AdlibPieceStart,
				{
					playlistId: rundownPlaylistId,
					adLibPieceId: regularAdLibDoc._id,
					partInstanceId: rundownPlaylist.currentPartInstanceId,
					pieceType,
				}
			)
			if (ClientAPI.isClientResponseError(result)) return result
			return ClientAPI.responseSuccess({})
		} else if (adLibActionDoc) {
			// This is an AdLib Action
			return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				{ ...this, connection: connection },
				event,
				getCurrentTime(),
				rundownPlaylistId,
				() => {
					check(rundownPlaylistId, String)
					check(adLibId, Match.OneOf(String, null))
				},
				StudioJobs.ExecuteAction,
				{
					playlistId: rundownPlaylistId,
					actionDocId: adLibActionDoc._id,
					actionId: adLibActionDoc.actionId,
					userData: adLibActionDoc.userData,
					triggerMode: triggerMode ? triggerMode : undefined,
				}
			)
		} else {
			return ClientAPI.responseError(
				UserError.from(new Error(`No adLib with Id ${adLibId}`), UserErrorMessage.AdlibNotFound)
			)
		}
	}
	async moveNextPart(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		delta: number
	): Promise<ClientAPI.ClientResponse<PartId | null>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(delta, Number)
			},
			StudioJobs.MoveNextPart,
			{
				playlistId: rundownPlaylistId,
				partDelta: delta,
				segmentDelta: 0,
			}
		)
	}
	async moveNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		delta: number
	): Promise<ClientAPI.ClientResponse<PartId | null>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(delta, Number)
			},
			StudioJobs.MoveNextPart,
			{
				playlistId: rundownPlaylistId,
				partDelta: 0,
				segmentDelta: delta,
			}
		)
	}

	async reloadPlaylist(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<object>> {
		return ServerClientAPI.runUserActionInLogForPlaylist<object>(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			'reloadPlaylist',
			[rundownPlaylistId],
			async (access) => {
				const reloadResponse = await ServerRundownAPI.resyncRundownPlaylist(access)
				const success = !reloadResponse.rundownsResponses.reduce((missing, rundownsResponse) => {
					return missing || rundownsResponse.response === TriggerReloadDataResponse.MISSING
				}, false)
				return success
					? {}
					: UserError.from(
							new Error(`Failed to reload playlist ${rundownPlaylistId}`),
							UserErrorMessage.InternalError
					  )
			}
		)
	}

	async resetPlaylist(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.ResetRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async setNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		segmentId: SegmentId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(segmentId, String)
			},
			StudioJobs.SetNextSegment,
			{
				playlistId: rundownPlaylistId,
				nextSegmentId: segmentId,
			}
		)
	}
	async setNextPart(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		partId: PartId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partId, String)
			},
			StudioJobs.SetNextPart,
			{
				playlistId: rundownPlaylistId,
				nextPartId: partId,
			}
		)
	}

	async take(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		fromPartInstanceId: PartInstanceId | null
	): Promise<ClientAPI.ClientResponse<void>> {
		triggerWriteAccess()
		const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
		if (!rundownPlaylist) throw new Error(`Rundown playlist ${rundownPlaylistId} does not exist`)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.TakeNextPart,
			{
				playlistId: rundownPlaylistId,
				fromPartInstanceId: fromPartInstanceId ?? rundownPlaylist.currentPartInstanceId,
			}
		)
	}

	async switchRouteSet(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId,
		routeSetId: string,
		state: boolean
	) {
		return ServerClientAPI.runUserActionInLog(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			'switchRouteSet',
			[studioId, routeSetId, state],
			async () => {
				check(studioId, String)
				check(routeSetId, String)
				check(state, Boolean)

				const access = await StudioContentWriteAccess.routeSet(this, studioId)
				return ServerPlayoutAPI.switchRouteSet(access, routeSetId, state)
			}
		)
	}
}
registerClassToMeteorMethods(RestAPIMethods, ServerRestAPI, false)

const koaRouter = new KoaRouter()

async function sofieAPIRequest<Params, Body, Response>(
	method: 'get' | 'post',
	route: string,
	handler: (
		serverAPI: ReplaceOptionalWithNullInMethodArguments<RestAPI>,
		connection: Meteor.Connection,
		event: string,
		params: Params,
		body: Body
	) => Promise<ClientAPI.ClientResponse<Response>>
) {
	koaRouter[method](route, async (ctx, next) => {
		try {
			let serverAPI = new ServerRestAPI()
			let response = await handler(
				serverAPI,
				makeConnection(ctx),
				restAPIUserEvent(ctx),
				ctx.params as Params,
				ctx.req.body as Body
			)
			if (ClientAPI.isClientResponseError(response)) throw response.error
			ctx.body = response
			ctx.status = 200
		} catch (e) {
			const errMsg = UserError.isUserError(e)
				? translateMessage(e.message, interpollateTranslation)
				: (e as Error).message
			logger.error('POST activate failed - ' + errMsg)
			ctx.type = 'application/json'
			ctx.body = JSON.stringify({ message: errMsg })
			ctx.status = 412
		}
		await next()
	})
}

koaRouter.get('/', async (ctx, next) => {
	ctx.type = 'application/json'
	let server = new ServerRestAPI()
	ctx.body = ClientAPI.responseSuccess(await server.index())
	ctx.status = 200
	await next()
})

sofieAPIRequest<{ playlistId: string }, { rehearsal: boolean }, void>(
	'post',
	'/activate/:playlistId',
	async (serverAPI, connection, event, params, body) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const rehearsal = body.rehearsal
		logger.info(`koa POST: activate ${rundownPlaylistId} - ${rehearsal ? 'rehearsal' : 'live'}`)

		check(rundownPlaylistId, String)
		return await serverAPI.activate(connection, event, rundownPlaylistId, rehearsal)
	}
)

sofieAPIRequest<{ playlistId: string }, never, void>(
	'post',
	'/deactivate/:playlistId',
	async (serverAPI, connection, event, params, _) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		logger.info(`koa POST: deactivate ${rundownPlaylistId}`)

		check(rundownPlaylistId, String)
		return await serverAPI.deactivate(connection, event, rundownPlaylistId)
	}
)

sofieAPIRequest<{ playlistId: string; adLibId: string }, { actionType: string; [key: string]: any }, object>(
	'post',
	'/executeAdLib/:playlistId/:adLibId',
	async (serverAPI, connection, event, params, body) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const adLibId = protectString<AdLibActionId | RundownBaselineAdLibActionId | PieceId | BucketAdLibId>(
			params.adLibId
		)
		const actionTypeObj = body
		const triggerMode = actionTypeObj ? (actionTypeObj as { actionType: string }).actionType : undefined
		logger.info(`koa POST: executeAdLib ${rundownPlaylistId} ${adLibId} - triggerMode: ${triggerMode}`)

		check(adLibId, String)
		check(rundownPlaylistId, String)

		return await serverAPI.executeAdLib(connection, event, rundownPlaylistId, adLibId, triggerMode)
	}
)

sofieAPIRequest<{ playlistId: string; delta: number }, never, PartId | null>(
	'post',
	'/moveNextPart/:playlistId/:delta',
	async (serverAPI, connection, event, params, _) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const delta = params.delta
		logger.info(`koa POST: moveNextPart ${rundownPlaylistId} ${delta}`)

		check(rundownPlaylistId, String)
		check(delta, Number)
		return await serverAPI.moveNextPart(connection, event, rundownPlaylistId, delta)
	}
)

sofieAPIRequest<{ playlistId: string; delta: number }, never, PartId | null>(
	'post',
	'/moveNextSegment/:playlistId/:delta',
	async (serverAPI, connection, event, params, _) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const delta = params.delta
		logger.info(`koa POST: moveNextSegment ${rundownPlaylistId} ${delta}`)

		check(rundownPlaylistId, String)
		check(delta, Number)
		return await serverAPI.moveNextSegment(connection, event, rundownPlaylistId, delta)
	}
)

sofieAPIRequest<{ playlistId: string }, never, object>(
	'post',
	'/reloadPlaylist/:playlistId',
	async (serverAPI, connection, event, params, _) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		logger.info(`koa POST: reloadPlaylist ${rundownPlaylistId}`)

		check(rundownPlaylistId, String)
		return await serverAPI.reloadPlaylist(connection, event, rundownPlaylistId)
	}
)

sofieAPIRequest<{ playlistId: string }, never, void>(
	'post',
	'/resetPlaylist/:playlistId',
	async (serverAPI, connection, event, params, _) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		logger.info(`koa POST: resetPlaylist ${rundownPlaylistId}`)

		check(rundownPlaylistId, String)
		return await serverAPI.resetPlaylist(connection, event, rundownPlaylistId)
	}
)

sofieAPIRequest<{ playlistId: string; partId: string }, never, void>(
	'post',
	'/setNextPart/:playlistId/:partId',
	async (serverAPI, connection, event, params, _) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const partId = protectString<PartId>(params.partId)
		logger.info(`koa POST: setNextPart ${rundownPlaylistId} ${partId}`)

		check(rundownPlaylistId, String)
		check(partId, String)
		return await serverAPI.setNextPart(connection, event, rundownPlaylistId, partId)
	}
)

sofieAPIRequest<{ playlistId: string; segmentId: string }, never, void>(
	'post',
	'/setNextSegment/:playlistId/:segmentId',
	async (serverAPI, connection, event, params, _) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const segmentId = protectString<SegmentId>(params.segmentId)
		logger.info(`koa POST: setNextSegment ${rundownPlaylistId} ${segmentId}`)

		check(rundownPlaylistId, String)
		check(segmentId, String)
		return await serverAPI.setNextSegment(connection, event, rundownPlaylistId, segmentId)
	}
)

sofieAPIRequest<{ playlistId: string }, { fromPartInstanceId?: string }, void>(
	'post',
	'/take/:playlistId',
	async (serverAPI, connection, event, params, body) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const fromPartInstanceId = body.fromPartInstanceId
		logger.info(`koa POST: take ${rundownPlaylistId}`)

		check(rundownPlaylistId, String)
		check(fromPartInstanceId, Match.Optional(String))
		return await serverAPI.take(connection, event, rundownPlaylistId, protectString(fromPartInstanceId) ?? null)
	}
)

sofieAPIRequest<{ studioId: string; routeSetId: string }, { active: boolean }, void>(
	'post',
	'/switchRouteSet/:studioId/:routeSetId',
	async (serverAPI, connection, event, params, body) => {
		const studioId = protectString<StudioId>(params.studioId)
		const routeSetId = params.routeSetId
		const active = body.active
		logger.info(`koa POST: switchRouteSet ${studioId} ${routeSetId} ${active}`)

		check(studioId, String)
		check(routeSetId, String)
		check(active, Boolean)
		return await serverAPI.switchRouteSet(connection, event, studioId, routeSetId, active)
	}
)

const makeConnection = (
	ctx: Koa.ParameterizedContext<
		Koa.DefaultState,
		Koa.DefaultContext & KoaRouter.RouterParamContext<Koa.DefaultState, Koa.DefaultContext>,
		unknown
	>
): Meteor.Connection => {
	return {
		id: getRandomString(),
		close: () => {},
		onClose: () => {},
		clientAddress: ctx.req.headers.host || 'unknown',
		httpHeaders: ctx.req.headers,
	}
}

Meteor.startup(() => {
	const app = new Koa()
	if (!Meteor.isAppTest) {
		WebApp.connectHandlers.use('/api2', Meteor.bindEnvironment(app.callback()))
	}
	app.use(cors())
	app.use(koaRouter.routes()).use(koaRouter.allowedMethods())
})
