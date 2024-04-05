import { MutableIngestRundownImpl } from '../MutableIngestRundownImpl'
import { defaultApplyIngestChanges } from '../defaultApplyIngestChanges'
import {
	IncomingIngestChange,
	IncomingIngestRundownChange,
	IngestDefaultChangesOptions,
	IngestRundown,
} from '@sofie-automation/blueprints-integration'
import { clone } from '@sofie-automation/corelib/dist/lib'

describe('defaultApplyIngestChanges', () => {
	function createBasicIngestRundown(): IngestRundown {
		return {
			externalId: 'rd0',
			name: 'my rundown',
			type: 'mock',
			payload: {
				myData: 'data',
			},
			segments: [
				{
					externalId: 'seg0',
					rank: 0,
					name: 'my segment',
					payload: {
						segmentData: 'data',
					},
					parts: [
						{
							externalId: 'part0',
							rank: 0,
							name: 'my part',
							payload: {
								partData: 'data',
							},
						},
					],
				},
			],
		}
	}

	const defaultOptions: IngestDefaultChangesOptions<unknown, unknown, unknown> = {
		transformRundownPayload: jest.fn((payload) => payload),
		transformSegmentPayload: jest.fn((payload) => payload),
		transformPartPayload: jest.fn((payload) => payload),
	}

	function tryMockClear(fn: any) {
		if (jest.isMockFunction(fn)) {
			fn.mockClear()
		}
	}

	beforeEach(() => {
		tryMockClear(defaultOptions.transformRundownPayload)
		tryMockClear(defaultOptions.transformSegmentPayload)
		tryMockClear(defaultOptions.transformPartPayload)
	})

	describe('rundown changes', () => {
		it('no changes', async () => {
			const nrcsRundown = createBasicIngestRundown()
			const mutableIngestRundown = new MutableIngestRundownImpl(clone(nrcsRundown))

			// include some changes, which should be ignored
			nrcsRundown.name = 'new name'
			nrcsRundown.payload.myData = 'new data'

			const changes: IncomingIngestChange = { source: 'ingest' }

			expect(defaultOptions.transformRundownPayload).not.toHaveBeenCalled()
			defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)
			expect(defaultOptions.transformRundownPayload).not.toHaveBeenCalled()

			expect(mutableIngestRundown.hasChanges).toBeFalsy()
			expect(mutableIngestRundown.name).not.toEqual(nrcsRundown.name)
			expect(mutableIngestRundown.payload).not.toEqual(nrcsRundown.payload)
			expect(mutableIngestRundown.segments).toHaveLength(1)
		})
		it('rundown name and payload change', async () => {
			const nrcsRundown = createBasicIngestRundown()
			const mutableIngestRundown = new MutableIngestRundownImpl(clone(nrcsRundown))

			// include some changes, which should be ignored
			nrcsRundown.name = 'new name'
			nrcsRundown.payload.myData = 'new data'

			const changes: IncomingIngestChange = {
				source: 'ingest',
				rundownChanges: IncomingIngestRundownChange.Payload,
			}

			expect(defaultOptions.transformRundownPayload).not.toHaveBeenCalled()
			defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)
			expect(defaultOptions.transformRundownPayload).toHaveBeenCalled()

			expect(mutableIngestRundown.hasChanges).toBeTruthy()
			expect(mutableIngestRundown.name).toEqual(nrcsRundown.name)
			expect(mutableIngestRundown.payload).toEqual(nrcsRundown.payload)
			expect(mutableIngestRundown.segments).toHaveLength(1)
		})
		it('rundown regenerate', async () => {
			const nrcsRundown = createBasicIngestRundown()
			const mutableIngestRundown = new MutableIngestRundownImpl(clone(nrcsRundown))

			// include some changes, which should be ignored
			nrcsRundown.name = 'new name'
			nrcsRundown.payload.myData = 'new data'

			const changes: IncomingIngestChange = {
				source: 'ingest',
				rundownChanges: IncomingIngestRundownChange.Regenerate,
			}

			const mockRemoveAllSegments = jest.fn(mutableIngestRundown.removeAllSegments.bind(mutableIngestRundown))
			mutableIngestRundown.removeAllSegments = mockRemoveAllSegments

			expect(defaultOptions.transformRundownPayload).not.toHaveBeenCalled()
			defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)
			expect(defaultOptions.transformRundownPayload).toHaveBeenCalled()

			expect(mutableIngestRundown.hasChanges).toBeTruthy()
			expect(mutableIngestRundown.name).toEqual(nrcsRundown.name)
			expect(mutableIngestRundown.payload).toEqual(nrcsRundown.payload)

			// Ensure the segments were regenerated
			expect(mockRemoveAllSegments).toHaveBeenCalledTimes(1)
			expect(mutableIngestRundown.segments).toHaveLength(0)
		})
	})

	describe('segment order changes', () => {
		// TODO
	})

	// TODO - more scenarios
})
