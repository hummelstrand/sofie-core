import { RundownPlaylist, RundownPlaylistId } from '../lib/collections/RundownPlaylists'
import { asyncCollectionFindOne, ProtectedString, asyncCollectionFindFetch } from '../lib/lib'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { Studio, Studios, StudioId } from '../lib/collections/Studios'
import { ShowStyleBase, ShowStyleBases } from '../lib/collections/ShowStyleBases'
import { ShowStyleVariant, ShowStyleVariants } from '../lib/collections/ShowStyleVariants'
import { Rundown } from '../lib/collections/Rundowns'
import { RundownBaselineObj, RundownBaselineObjs } from '../lib/collections/RundownBaselineObjs'
import { RundownBaselineAdLibItem, RundownBaselineAdLibPieces } from '../lib/collections/RundownBaselineAdLibPieces'
import { RundownBaselineAdLibAction, RundownBaselineAdLibActions } from '../lib/collections/RundownBaselineAdLibActions'
import { PeripheralDevice, PeripheralDevices } from '../lib/collections/PeripheralDevices'

export function getActivationCache(studioId: StudioId, playlistId: RundownPlaylistId): ActivationCache {
	// if (!playlist.active) throw new Meteor.Error(500, `The playlist "${playlist._id}" is not active!`)
	// if (!playlist.activeInstanceId)
	// 	throw new Meteor.Error(500, `The playlist "${playlist._id}" has no activeInstanceId set!`)

	let activationCache = activationCaches.get(studioId)
	if (
		activationCache &&
		!activationCache.expired &&
		activationCache.persistant &&
		activationCache.playlistId === playlistId
	) {
		activationCache.touch()
	} else {
		if (activationCache) activationCache.destroy()

		activationCache = new ActivationCache(playlistId)
		activationCaches.set(studioId, activationCache)
	}

	return activationCache
}
export function clearActivationCache(studioId: StudioId): void {
	const activationCache = activationCaches.get(studioId)
	if (activationCache) {
		activationCache.destroy()
		activationCaches.delete(studioId)
	}
}
export function clearOldActivationCaches() {
	for (const [id, activationCache] of activationCaches) {
		if (activationCache.expired) clearActivationCache(id)
	}
}
export function forceClearAllActivationCaches() {
	for (const id of activationCaches.keys()) {
		clearActivationCache(id)
	}
}
const activationCaches = new Map<StudioId, ActivationCache>()

type InternalCache<T> = { modifiedHash: string; value: T }
export class ActivationCache {
	private _expires: number
	private _initialized: boolean = false
	private _persistant: boolean = false

	private _playlist: RundownPlaylist
	private _studio: Studio
	private _showStyleBases: { [id: string]: InternalCache<ShowStyleBase> } = {}
	private _showStyleVariants: { [id: string]: InternalCache<ShowStyleVariant> } = {}
	private _rundownBaselineObjs: { [id: string]: InternalCache<RundownBaselineObj[]> } = {}
	private _rundownBaselineAdLibPieces: { [id: string]: InternalCache<RundownBaselineAdLibItem[]> } = {}
	private _rundownBaselineAdLibActions: { [id: string]: InternalCache<RundownBaselineAdLibAction[]> } = {}
	private _peripheralDevices: { [id: string]: InternalCache<PeripheralDevice[]> } = {}

	constructor(private _playlistId: RundownPlaylistId) {
		this._updateExpires()
	}

	get expired(): boolean {
		return Date.now() > this._expires
	}
	get persistant(): boolean {
		return this._persistant
	}
	get playlistId(): RundownPlaylistId {
		return this._playlistId
	}
	touch() {
		this._updateExpires()
	}
	destroy() {
		// do something here?
	}
	private _uninitialize() {
		delete this._playlist
		delete this._studio
		this._showStyleBases = {}
		this._showStyleVariants = {}
		this._rundownBaselineObjs = {}
		this._rundownBaselineAdLibPieces = {}
		this._rundownBaselineAdLibActions = {}
		this._peripheralDevices = {}

		this._initialized = false
		this._persistant = false
	}
	async initialize(playlist: RundownPlaylist, rundownsInPlaylist: Rundown[]) {
		if (this._initialized && playlist.activeInstanceId !== this._playlist.activeInstanceId) {
			// activeInstanceId has changed, we should clear out the data because it might not be valid anymore
			this._uninitialize()
		}

		if (this._initialized) return // already initialized

		if (playlist._id !== this._playlistId)
			throw new Error(
				`ActivationCache.initialize playlist._id "${playlist._id}" not equal to this.playlistId "${this.playlistId}"`
			)
		this._playlist = playlist

		const pStudio = asyncCollectionFindOne(Studios, this._playlist.studioId)

		if (!playlist.active) {
			// If the playlist is not active we won't do the pre-loading now
			// we're also not calling ourselves "persistant", so we won't be living longer than
			this._persistant = false
		} else {
			this._persistant = true

			// As a convenience thing; if we're persistant, we should be the one stored in the cache:
			const existingInCache = activationCaches.get(this._playlist.studioId)
			if (existingInCache && existingInCache !== this) {
				existingInCache.destroy()
			}
			activationCaches.set(this._playlist.studioId, this)

			// Just a prefetch, to speed up things later:
			const ps: Promise<any>[] = []
			const ignoreError = () => {
				// ignore
			}
			for (const rundown of rundownsInPlaylist) {
				ps.push(this._getShowStyleBase(rundown).catch(ignoreError))
				ps.push(this._getShowStyleVariant(rundown).catch(ignoreError))
				ps.push(this._getRundownBaselineObjs(rundown))
				ps.push(this._getRundownBaselineAdLibPieces(rundown))
				ps.push(this._getRundownBaselineAdLibActions(rundown))
			}
			ps.push(this._getPeripheralDevices())

			await Promise.all(ps)
		}
		const studio = await pStudio
		if (!studio) {
			throw new Meteor.Error(
				404,
				`Studio "${this._playlist.studioId}" of playlist "${this._playlist._id}" not found!`
			)
		}

		this._studio = studio
		this._initialized = true
	}
	/** This is indended to be used when there is no playlist active */
	async initializeForNoPlaylist(studio: Studio) {
		if (this._initialized) return // already initialized

		// see the note about this._persistant = false in this.initialize()
		this._persistant = false

		this._studio = studio
		this._initialized = true
	}
	getPlaylist(): RundownPlaylist {
		if (!this._initialized) throw new Meteor.Error(`ActivationCache is not initialized`)
		return this._playlist
	}
	getStudio(): Studio {
		if (!this._initialized) throw new Meteor.Error(`ActivationCache is not initialized`)
		return this._studio
	}
	async getShowStyleBase(rundown: Rundown): Promise<ShowStyleBase> {
		if (!this._initialized) throw new Meteor.Error(`ActivationCache is not initialized`)
		return this._getShowStyleBase(rundown)
	}
	async getShowStyleVariant(rundown: Rundown): Promise<ShowStyleVariant> {
		if (!this._initialized) throw new Meteor.Error(`ActivationCache is not initialized`)
		return this._getShowStyleVariant(rundown)
	}
	async getRundownBaselineObjs(rundown: Rundown): Promise<RundownBaselineObj[]> {
		if (!this._initialized) throw new Meteor.Error(`ActivationCache is not initialized`)
		return this._getRundownBaselineObjs(rundown)
	}
	async getRundownBaselineAdLibPieces(rundown: Rundown): Promise<RundownBaselineAdLibItem[]> {
		if (!this._initialized) throw new Meteor.Error(`ActivationCache is not initialized`)
		return this._getRundownBaselineAdLibPieces(rundown)
	}
	async getRundownBaselineAdLibActions(rundown: Rundown): Promise<RundownBaselineAdLibAction[]> {
		if (!this._initialized) throw new Meteor.Error(`ActivationCache is not initialized`)
		return this._getRundownBaselineAdLibActions(rundown)
	}
	async getPeripheralDevices(): Promise<PeripheralDevice[]> {
		if (!this._initialized) throw new Meteor.Error(`ActivationCache is not initialized`)
		return this._getPeripheralDevices()
	}
	private async _getShowStyleBase(rundown: Rundown, supressError?: boolean): Promise<ShowStyleBase> {
		if (!rundown.showStyleBaseId) throw new Meteor.Error(500, `Rundown.showStyleBaseId not set!`)
		return this._getFromCache(this._showStyleBases, rundown.showStyleBaseId, '', async (id) => {
			const showStyleBase = await asyncCollectionFindOne(ShowStyleBases, id)
			if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase "${id}" not found`)
			return showStyleBase
		})
	}
	private async _getShowStyleVariant(rundown: Rundown): Promise<ShowStyleVariant> {
		if (!rundown.showStyleVariantId) throw new Meteor.Error(500, `Rundown.showStyleVariantId not set!`)
		return this._getFromCache(this._showStyleVariants, rundown.showStyleVariantId, '', async (id) => {
			const showStyleVariant = await asyncCollectionFindOne(ShowStyleVariants, id)
			if (!showStyleVariant) throw new Meteor.Error(404, `ShowStyleVariant "${id}" not found`)
			return showStyleVariant
		})
	}
	private async _getRundownBaselineObjs(rundown: Rundown): Promise<RundownBaselineObj[]> {
		return this._getFromCache(
			this._rundownBaselineObjs,
			rundown._id,
			rundown.baselineModifyHash || '',
			async (id) => {
				const rundownBaselineObjs = await asyncCollectionFindFetch(RundownBaselineObjs, { rundownId: id })
				return rundownBaselineObjs
			}
		)
	}
	private async _getRundownBaselineAdLibPieces(rundown: Rundown): Promise<RundownBaselineAdLibItem[]> {
		return this._getFromCache(
			this._rundownBaselineAdLibPieces,
			rundown._id,
			rundown.baselineModifyHash || '',
			async (id) => {
				const rundownBaselineAdLibPieces = await asyncCollectionFindFetch(RundownBaselineAdLibPieces, {
					rundownId: id,
				})
				return rundownBaselineAdLibPieces
			}
		)
	}
	private async _getRundownBaselineAdLibActions(rundown: Rundown): Promise<RundownBaselineAdLibAction[]> {
		return this._getFromCache(
			this._rundownBaselineAdLibActions,
			rundown._id,
			rundown.baselineModifyHash || '',
			async (id) => {
				const rundownBaselineAdLibActions = await asyncCollectionFindFetch(RundownBaselineAdLibActions, {
					rundownId: id,
				})
				return rundownBaselineAdLibActions
			}
		)
	}
	private async _getPeripheralDevices(): Promise<PeripheralDevice[]> {
		return this._getFromCache(this._peripheralDevices, this._playlist.studioId, '', async (id) => {
			const devices = await asyncCollectionFindFetch(PeripheralDevices, {
				studioId: id,
			})
			return devices
		})
	}
	private _updateExpires() {
		const TTL = 30 * 60 * 1000 // 30 minutes

		this._expires = Date.now() + TTL
	}
	private async _getFromCache<T, ID extends string | ProtectedString<any>>(
		cache: { [id: string]: InternalCache<T> },
		identifier: ID,
		modifiedHash: string,
		updateFcn: (identifier: ID) => Promise<T>
	): Promise<T> {
		const id = (identifier as any) as string
		let o = cache[id]
		if (!o || o.modifiedHash !== modifiedHash) {
			o = {
				modifiedHash: modifiedHash,
				value: await updateFcn(identifier),
			}
			cache[id] = o
		}
		return o.value
	}
}
