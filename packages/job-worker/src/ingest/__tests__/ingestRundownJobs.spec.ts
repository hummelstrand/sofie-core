import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'
import { LocalIngestRundown } from '../ingestCache'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { IngestRundown, NrcsIngestRundownChangeDetails } from '@sofie-automation/blueprints-integration'
import { stripModifiedTimestamps } from './lib'
import { UpdateIngestRundownAction, UpdateIngestRundownChange } from '../runOperation'
import {
	handleRegenerateRundown,
	handleRemovedRundown,
	handleUpdatedRundown,
	handleUpdatedRundownMetaData,
	handleUserUnsyncRundown,
} from '../ingestRundownJobs'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBRundown, RundownOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Rundown'

function getDefaultIngestRundown(): LocalIngestRundown {
	return {
		externalId: 'rundown0',
		type: 'mos',
		name: 'Rundown',
		modified: 0,
		segments: [
			{
				externalId: 'segment0',
				name: 'Segment 0',
				rank: 0,
				modified: 0,
				parts: [
					{
						externalId: 'part0',
						name: 'Part 0',
						rank: 0,
						modified: 0,
					},
					{
						externalId: 'part1',
						name: 'Part 1',
						rank: 1,
						modified: 0,
					},
				],
			},
			{
				externalId: 'segment1',
				name: 'Segment 1',
				rank: 1,
				modified: 0,
				parts: [
					{
						externalId: 'part2',
						name: 'Part 2',
						rank: 0,
						modified: 0,
					},
					{
						externalId: 'part3',
						name: 'Part 3',
						rank: 1,
						modified: 0,
					},
				],
			},
		],
	}
}

describe('handleRemovedRundown', () => {
	it('no rundown, normal delete', () => {
		const context = setupDefaultJobEnvironment()

		expect(
			handleRemovedRundown(
				context,
				{
					peripheralDeviceId: null,
					rundownExternalId: 'rundown0',
					// forceDelete: false,
				},
				undefined
			)
		).toBe(UpdateIngestRundownAction.DELETE)
	})

	it('no rundown, force delete', () => {
		const context = setupDefaultJobEnvironment()

		expect(
			handleRemovedRundown(
				context,
				{
					peripheralDeviceId: null,
					rundownExternalId: 'rundown0',
					forceDelete: true,
				},
				undefined
			)
		).toBe(UpdateIngestRundownAction.FORCE_DELETE)
	})

	it('with rundown, normal delete', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		expect(
			handleRemovedRundown(
				context,
				{
					peripheralDeviceId: null,
					rundownExternalId: 'rundown0',
					forceDelete: false,
				},
				ingestRundown
			)
		).toBe(UpdateIngestRundownAction.DELETE)
	})

	it('with rundown, force delete', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		expect(
			handleRemovedRundown(
				context,
				{
					peripheralDeviceId: null,
					rundownExternalId: 'rundown0',
					forceDelete: true,
				},
				ingestRundown
			)
		).toBe(UpdateIngestRundownAction.FORCE_DELETE)
	})
})

// TODO: handleUserRemoveRundown

describe('handleRegenerateRundown', () => {
	it('no rundown', () => {
		const context = setupDefaultJobEnvironment()

		expect(() =>
			handleRegenerateRundown(
				context,
				{
					peripheralDeviceId: null,
					rundownExternalId: 'rundown0',
				},
				undefined
			)
		).toThrow(/Rundown(.*)not found/)
	})

	it('good', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleRegenerateRundown(
			context,
			{
				peripheralDeviceId: null,
				rundownExternalId: 'rundown0',
			},
			clone(ingestRundown)
		)
		stripModifiedTimestamps(changes.ingestRundown)

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: 'ingest',
				rundownChanges: NrcsIngestRundownChangeDetails.Regenerate,
			},
		} satisfies UpdateIngestRundownChange)
	})
})

describe('handleUserUnsyncRundown', () => {
	const rundownId: RundownId = protectString('rundown0')

	async function createRundown(context: MockJobContext, fragment?: Partial<DBRundown>) {
		await context.mockCollections.Rundowns.insertOne({
			_id: rundownId,
			organizationId: protectString('organization0'),
			studioId: context.studioId,
			showStyleBaseId: protectString('showStyleBase0'),
			showStyleVariantId: protectString('showStyleVariant0'),
			peripheralDeviceId: undefined,
			created: 0,
			modified: 0,
			importVersions: {} as any,
			externalId: 'rundownExternal0',
			name: 'Rundown',
			timing: {} as any,
			playlistId: protectString('playlist0'),
			externalNRCSName: 'NRCS',
			...fragment,
		})
		context.mockCollections.Rundowns.clearOpLog()
	}

	it('no rundown', async () => {
		const context = setupDefaultJobEnvironment()

		await handleUserUnsyncRundown(context, { rundownId })

		expect(context.mockCollections.Rundowns.operations).toHaveLength(1)
		expect(context.mockCollections.Rundowns.operations[0]).toEqual({
			type: 'findOne',
			args: ['rundown0', undefined],
		})
	})

	it('already orphaned', async () => {
		const context = setupDefaultJobEnvironment()

		await createRundown(context, { orphaned: RundownOrphanedReason.MANUAL })

		await handleUserUnsyncRundown(context, { rundownId })

		expect(context.mockCollections.Rundowns.operations).toHaveLength(1)
		expect(context.mockCollections.Rundowns.operations[0]).toEqual({
			type: 'findOne',
			args: ['rundown0', undefined],
		})
	})

	it('good', async () => {
		const context = setupDefaultJobEnvironment()

		await createRundown(context, {})

		await handleUserUnsyncRundown(context, { rundownId })

		expect(context.mockCollections.Rundowns.operations).toHaveLength(2)
		expect(context.mockCollections.Rundowns.operations[0]).toEqual({
			type: 'findOne',
			args: ['rundown0', undefined],
		})
		expect(context.mockCollections.Rundowns.operations[1]).toEqual({
			type: 'update',
			args: [
				'rundown0',
				{
					$set: {
						orphaned: RundownOrphanedReason.MANUAL,
					},
				},
			],
		})
	})
})

describe('handleUpdatedRundown', () => {
	const newIngestRundown: IngestRundown = {
		externalId: 'rundown0',
		type: 'mos',
		name: 'Rundown2',
		segments: [
			{
				externalId: 'segment0',
				name: 'Segment 0b',
				rank: 0,
				parts: [
					{
						externalId: 'part0',
						name: 'Part 0b',
						rank: 0,
					},
					{
						externalId: 'part1',
						name: 'Part 1b',
						rank: 1,
					},
				],
			},
			{
				externalId: 'segment2',
				name: 'Segment 2',
				rank: 1,
				parts: [
					{
						externalId: 'part4',
						name: 'Part 4',
						rank: 0,
					},
					{
						externalId: 'part5',
						name: 'Part 5',
						rank: 1,
					},
				],
			},
		],
	}

	it('create rundown', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleUpdatedRundown(
			context,
			{
				peripheralDeviceId: null,
				rundownExternalId: 'rundown0',
				ingestRundown: clone(ingestRundown),
				isCreateAction: true,
			},
			undefined
		)
		stripModifiedTimestamps(changes.ingestRundown)

		// update the expected ingestRundown
		const expectedIngestRundown: LocalIngestRundown = {
			...ingestRundown,
			modified: 1,
			segments: ingestRundown.segments.map((s) => ({
				...s,
				modified: 1,
				parts: s.parts.map((p) => ({ ...p, modified: 1 })),
			})),
		}

		expect(changes).toEqual({
			ingestRundown: expectedIngestRundown,
			changes: {
				source: 'ingest',
				rundownChanges: NrcsIngestRundownChangeDetails.Regenerate,
			},
		} satisfies UpdateIngestRundownChange)
	})

	it('update missing rundown', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		expect(() =>
			handleUpdatedRundown(
				context,
				{
					peripheralDeviceId: null,
					rundownExternalId: 'rundown0',
					ingestRundown: clone(ingestRundown),
					isCreateAction: false,
				},
				undefined
			)
		).toThrow(/Rundown(.*)not found/)
	})

	it('update existing rundown', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleUpdatedRundown(
			context,
			{
				peripheralDeviceId: null,
				rundownExternalId: 'rundown0',
				ingestRundown: clone(newIngestRundown),
				isCreateAction: false,
			},
			clone(ingestRundown)
		)
		stripModifiedTimestamps(changes.ingestRundown)

		// update the expected ingestRundown
		const expectedIngestRundown: LocalIngestRundown = {
			...newIngestRundown,
			modified: 1,
			segments: newIngestRundown.segments.map((s) => ({
				...s,
				modified: 1,
				parts: s.parts.map((p) => ({ ...p, modified: 1 })),
			})),
		}

		expect(changes).toEqual({
			ingestRundown: expectedIngestRundown,
			changes: {
				source: 'ingest',
				rundownChanges: NrcsIngestRundownChangeDetails.Regenerate,
			},
		} satisfies UpdateIngestRundownChange)
	})
})

describe('handleUpdatedRundownMetaData', () => {
	const newIngestRundown: IngestRundown = {
		externalId: 'rundown0',
		type: 'mos',
		name: 'Rundown2',
		segments: [],
		payload: {
			key: 'value',
		},
	}

	it('no rundown', () => {
		const context = setupDefaultJobEnvironment()

		expect(() =>
			handleUpdatedRundownMetaData(
				context,
				{
					peripheralDeviceId: null,
					rundownExternalId: 'rundown0',
					ingestRundown: clone(newIngestRundown),
				},
				undefined
			)
		).toThrow(/Rundown(.*)not found/)
	})

	it('update existing rundown', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleUpdatedRundownMetaData(
			context,
			{
				peripheralDeviceId: null,
				rundownExternalId: 'rundown0',
				ingestRundown: clone(newIngestRundown),
			},
			clone(ingestRundown)
		)
		stripModifiedTimestamps(changes.ingestRundown)

		// update the expected ingestRundown
		const expectedIngestRundown: LocalIngestRundown = {
			...newIngestRundown,
			modified: 1,
			segments: ingestRundown.segments,
		}

		expect(changes).toEqual({
			ingestRundown: expectedIngestRundown,
			changes: {
				source: 'ingest',
				rundownChanges: NrcsIngestRundownChangeDetails.Payload,
			},
		} satisfies UpdateIngestRundownChange)
	})
})
