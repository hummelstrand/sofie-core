import { MutableIngestRundownImpl } from '../MutableIngestRundownImpl'
import { defaultApplyIngestChanges } from '../defaultApplyIngestChanges'
import {
	IncomingIngestChange,
	IncomingIngestRundownChange,
	IncomingIngestSegmentChangeEnum,
	IngestDefaultChangesOptions,
	IngestRundown,
	MutableIngestPart,
	MutableIngestRundown,
	MutableIngestSegment,
} from '@sofie-automation/blueprints-integration'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'

describe('defaultApplyIngestChanges', () => {
	const rundownId = protectString('rundown0')
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
	function createMediumIngestRundown(): IngestRundown {
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
						{
							externalId: 'part1',
							rank: 1,
							name: 'my part',
							payload: {
								partData: 'data',
							},
						},
					],
				},
				{
					externalId: 'seg1',
					rank: 1,
					name: 'my segment',
					payload: {
						segmentData: 'data',
					},
					parts: [
						{
							externalId: 'part2',
							rank: 0,
							name: 'my part',
							payload: {
								partData: 'data',
							},
						},
					],
				},
				{
					externalId: 'seg2',
					rank: 2,
					name: 'my segment',
					payload: {
						segmentData: 'data',
					},
					parts: [
						{
							externalId: 'part3',
							rank: 0,
							name: 'my part',
							payload: {
								partData: 'data',
							},
						},
						{
							externalId: 'part4',
							rank: 1,
							name: 'my part',
							payload: {
								partData: 'data',
							},
						},
						{
							externalId: 'part5',
							rank: 1,
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
	function createIngestRundownWithManySegments(): IngestRundown {
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
					parts: [],
				},
				{
					externalId: 'seg1',
					rank: 1,
					name: 'my segment',
					payload: {
						segmentData: 'data',
					},
					parts: [],
				},
				{
					externalId: 'seg2',
					rank: 2,
					name: 'my segment',
					payload: {
						segmentData: 'data',
					},
					parts: [],
				},
				{
					externalId: 'seg3',
					rank: 3,
					name: 'my segment',
					payload: {
						segmentData: 'data',
					},
					parts: [],
				},
				{
					externalId: 'seg4',
					rank: 4,
					name: 'my segment',
					payload: {
						segmentData: 'data',
					},
					parts: [],
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

	/**
	 * This creates a MutableIngestRundownImpl from an IngestRundown, and wraps all methods to record the mutation calls made to the rundown and its contents
	 */
	function createMutableIngestRundown(nrcsRundown: IngestRundown) {
		const mutableIngestRundown = new MutableIngestRundownImpl(clone(nrcsRundown))

		const mockCalls: Array<{ target: string; name: string; args: any[] }> = []

		function wrapMethod<TObj, TName extends keyof TObj & string>(
			target: string,
			name: TName,
			obj: TObj,
			interceptReturn?: (val: ReturnType<any>) => ReturnType<any>
		) {
			const rawMethod = obj[name]
			if (typeof rawMethod !== 'function') throw new Error(`Cant wrap non-method ${name}`)
			const origMethod = rawMethod.bind(obj)

			const mockMethod = jest.fn((...args) => {
				mockCalls.push({ target, name, args })
				const returnVal = origMethod(...args)
				if (interceptReturn) {
					return interceptReturn(returnVal)
				} else {
					return returnVal
				}
			})
			obj[name] = mockMethod as any

			return mockMethod
		}

		function wrapPart(part: MutableIngestPart) {
			const target = `part ${part.externalId}`
			wrapMethod(target, 'setName', part)
			wrapMethod(target, 'replacePayload', part)
			wrapMethod(target, 'setPayloadProperty', part)
		}

		function wrapSegment(segment: MutableIngestSegment) {
			const target = `segment ${segment.externalId}`
			wrapMethod(target, 'movePartBefore', segment)
			wrapMethod(target, 'movePartAfter', segment)
			wrapMethod(target, 'replacePart', segment, (part: MutableIngestPart) => {
				wrapPart(part)
				return part
			})
			wrapMethod(target, 'removePart', segment)
			wrapMethod(target, 'setName', segment)
			wrapMethod(target, 'replacePayload', segment)
			wrapMethod(target, 'setPayloadProperty', segment)

			segment.parts.forEach(wrapPart)
		}

		mutableIngestRundown.defaultApplyIngestChanges = jest.fn(() => {
			throw new Error('defaultApplyIngestChanges must not call itself!')
		})

		wrapMethod('rundown', 'moveSegmentAfter', mutableIngestRundown)
		wrapMethod('rundown', 'moveSegmentBefore', mutableIngestRundown)
		wrapMethod('rundown', 'removeAllSegments', mutableIngestRundown)
		wrapMethod('rundown', 'replaceSegment', mutableIngestRundown, (segment: MutableIngestSegment) => {
			wrapSegment(segment)
			return segment
		})
		wrapMethod('rundown', 'renameSegment', mutableIngestRundown)
		wrapMethod('rundown', 'removeSegment', mutableIngestRundown)
		wrapMethod('rundown', 'forceFullRegenerate', mutableIngestRundown)
		wrapMethod('rundown', 'setName', mutableIngestRundown)
		wrapMethod('rundown', 'replacePayload', mutableIngestRundown)
		wrapMethod('rundown', 'setPayloadProperty', mutableIngestRundown)

		mutableIngestRundown.segments.forEach(wrapSegment)

		return {
			mutableIngestRundown: mutableIngestRundown as MutableIngestRundown,
			mockCalls,
		}
	}

	describe('rundown changes', () => {
		it('no changes', async () => {
			const nrcsRundown = createBasicIngestRundown()
			const { mutableIngestRundown, mockCalls } = createMutableIngestRundown(clone(nrcsRundown))

			const changes: IncomingIngestChange = { source: 'ingest' }

			expect(defaultOptions.transformRundownPayload).not.toHaveBeenCalled()
			defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)
			expect(defaultOptions.transformRundownPayload).not.toHaveBeenCalled()

			expect(mockCalls).toHaveLength(0)
		})
		it('rundown name and payload change', async () => {
			const nrcsRundown = createBasicIngestRundown()
			const { mutableIngestRundown, mockCalls } = createMutableIngestRundown(clone(nrcsRundown))

			const changes: IncomingIngestChange = {
				source: 'ingest',
				rundownChanges: IncomingIngestRundownChange.Payload,
			}

			expect(defaultOptions.transformRundownPayload).not.toHaveBeenCalled()
			defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)
			expect(defaultOptions.transformRundownPayload).toHaveBeenCalled()

			expect(mockCalls).toHaveLength(2)
			expect(mockCalls[0]).toEqual({ target: 'rundown', name: 'replacePayload', args: [nrcsRundown.payload] })
			expect(mockCalls[1]).toEqual({ target: 'rundown', name: 'setName', args: [nrcsRundown.name] })
		})
		it('rundown regenerate', async () => {
			const nrcsRundown = createBasicIngestRundown()
			const { mutableIngestRundown, mockCalls } = createMutableIngestRundown(clone(nrcsRundown))

			const changes: IncomingIngestChange = {
				source: 'ingest',
				rundownChanges: IncomingIngestRundownChange.Regenerate,
				segmentOrderChanged: true, // will be ignored
				segmentChanges: {}, // will be ignored
			}

			expect(defaultOptions.transformRundownPayload).not.toHaveBeenCalled()
			defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)
			expect(defaultOptions.transformRundownPayload).toHaveBeenCalled()

			// Ensure the segments were regenerated
			expect(mockCalls).toHaveLength(5)
			expect(mockCalls[0]).toEqual({ target: 'rundown', name: 'replacePayload', args: [nrcsRundown.payload] })
			expect(mockCalls[1]).toEqual({ target: 'rundown', name: 'setName', args: [nrcsRundown.name] })
			expect(mockCalls[2]).toEqual({ target: 'rundown', name: 'removeAllSegments', args: [] })
			expect(mockCalls[3]).toEqual({ target: 'rundown', name: 'forceFullRegenerate', args: [] })
			expect(mockCalls[4]).toMatchObject({ target: 'rundown', name: 'replaceSegment' })
			expect(mutableIngestRundown.segments).toHaveLength(1)
		})
	})

	describe('segment order changes', () => {
		function createIngestRundownWithManySegmentsAlternateOrder(): IngestRundown {
			const ingestRundown = createIngestRundownWithManySegments()

			// reorder segments
			ingestRundown.segments = [
				ingestRundown.segments[3],
				ingestRundown.segments[1],
				ingestRundown.segments[4],
				ingestRundown.segments[0],
				ingestRundown.segments[2],
			]

			return ingestRundown
		}

		it('no changes', async () => {
			const nrcsRundown = createIngestRundownWithManySegments()
			const { mutableIngestRundown, mockCalls } = createMutableIngestRundown(nrcsRundown)

			const changes: IncomingIngestChange = { source: 'ingest', segmentOrderChanged: true }

			expect(defaultOptions.transformRundownPayload).not.toHaveBeenCalled()
			defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)
			expect(defaultOptions.transformRundownPayload).not.toHaveBeenCalled()

			// always ensures the order is sane
			expect(mockCalls).toHaveLength(5)
			expect(mockCalls[0]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg4', null] })
			expect(mockCalls[1]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg3', 'seg4'] })
			expect(mockCalls[2]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg2', 'seg3'] })
			expect(mockCalls[3]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg1', 'seg2'] })
			expect(mockCalls[4]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg0', 'seg1'] })
		})

		it('good changes', async () => {
			const { mutableIngestRundown, mockCalls } = createMutableIngestRundown(
				createIngestRundownWithManySegments()
			)

			// include some changes, which should be ignored
			const modifiedRundown = createIngestRundownWithManySegmentsAlternateOrder()

			const changes: IncomingIngestChange = { source: 'ingest', segmentOrderChanged: true }

			defaultApplyIngestChanges(mutableIngestRundown, modifiedRundown, changes, defaultOptions)

			// performs reorder
			expect(mockCalls).toHaveLength(5)
			expect(mockCalls[0]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg2', null] })
			expect(mockCalls[1]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg0', 'seg2'] })
			expect(mockCalls[2]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg4', 'seg0'] })
			expect(mockCalls[3]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg1', 'seg4'] })
			expect(mockCalls[4]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg3', 'seg1'] })
		})

		it('missing segment in new order', async () => {
			const { mutableIngestRundown, mockCalls } = createMutableIngestRundown(
				createIngestRundownWithManySegments()
			)

			// include some changes
			const modifiedRundown = createIngestRundownWithManySegmentsAlternateOrder()
			modifiedRundown.segments.splice(2, 1) // remove seg4

			const changes: IncomingIngestChange = { source: 'ingest', segmentOrderChanged: true }

			defaultApplyIngestChanges(mutableIngestRundown, modifiedRundown, changes, defaultOptions)

			// performs reorder
			expect(mockCalls).toHaveLength(5)
			expect(mockCalls[0]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg2', null] })
			expect(mockCalls[1]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg0', 'seg2'] })
			expect(mockCalls[2]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg1', 'seg0'] })
			expect(mockCalls[3]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg3', 'seg1'] })
			expect(mockCalls[4]).toEqual({ target: 'rundown', name: 'moveSegmentAfter', args: ['seg4', 'seg3'] }) // follows original order
		})

		it('extra segment in new order', async () => {
			const { mutableIngestRundown, mockCalls } = createMutableIngestRundown(
				createIngestRundownWithManySegments()
			)

			// include some changes
			const modifiedRundown = createIngestRundownWithManySegmentsAlternateOrder()
			modifiedRundown.segments.splice(2, 0, {
				externalId: 'segX',
				rank: 2,
				name: 'my segment',
				payload: {
					segmentData: 'data',
				},
				parts: [],
			})

			const changes: IncomingIngestChange = { source: 'ingest', segmentOrderChanged: true }

			defaultApplyIngestChanges(mutableIngestRundown, modifiedRundown, changes, defaultOptions)

			// performs reorder, ignoring segX
			expect(mockCalls).toHaveLength(5)
			expect(mockCalls[0]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg2', null] })
			expect(mockCalls[1]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg0', 'seg2'] })
			expect(mockCalls[2]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg4', 'seg0'] })
			expect(mockCalls[3]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg1', 'seg4'] })
			expect(mockCalls[4]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg3', 'seg1'] })
		})
	})

	describe('segment changes', () => {
		it('mix of operations', async () => {
			const { mutableIngestRundown, mockCalls } = createMutableIngestRundown(
				createIngestRundownWithManySegments()
			)

			// include some changes, which should be ignored
			const modifiedRundown = createIngestRundownWithManySegments()
			modifiedRundown.segments[1].externalId = 'segX' // replace seg1
			modifiedRundown.segments[2].externalId = 'segY' // repalce seg2
			modifiedRundown.segments.splice(4, 1) // remove seg4

			const changes: IncomingIngestChange = {
				source: 'ingest',
				segmentChanges: {
					seg1: IncomingIngestSegmentChangeEnum.Deleted,
					segX: IncomingIngestSegmentChangeEnum.Inserted,
					seg3: {
						payloadChanged: true,
					},
					seg4: IncomingIngestSegmentChangeEnum.Deleted,
					segY: IncomingIngestSegmentChangeEnum.Inserted,
					seg2: IncomingIngestSegmentChangeEnum.Deleted,
				},
			}

			defaultApplyIngestChanges(mutableIngestRundown, modifiedRundown, changes, defaultOptions)

			// performs deletes and inserts
			expect(mockCalls).toHaveLength(7)

			// Note: this happens in the order of the changes object, but that is not guaranteed in the future

			// remove and update first
			expect(mockCalls[0]).toEqual({ target: 'rundown', name: 'removeSegment', args: ['seg1'] })
			expect(mockCalls[1]).toMatchObject({ target: 'segment seg3', name: 'replacePayload' })
			expect(mockCalls[2]).toMatchObject({ target: 'segment seg3', name: 'setName' })
			expect(mockCalls[3]).toEqual({ target: 'rundown', name: 'removeSegment', args: ['seg4'] })
			expect(mockCalls[4]).toEqual({ target: 'rundown', name: 'removeSegment', args: ['seg2'] })

			// insert new ones in order starting at the end
			expect(mockCalls[5]).toMatchObject({
				target: 'rundown',
				name: 'replaceSegment',
				args: [{ externalId: 'segY' }, 'seg3'],
			})
			expect(mockCalls[6]).toMatchObject({
				target: 'rundown',
				name: 'replaceSegment',
				args: [{ externalId: 'segX' }, 'segY'],
			})
		})

		it('insert missing', async () => {
			const nrcsRundown = createIngestRundownWithManySegments()
			const { mutableIngestRundown } = createMutableIngestRundown(clone(nrcsRundown))

			const changes: IncomingIngestChange = {
				source: 'ingest',
				segmentChanges: {
					segX: IncomingIngestSegmentChangeEnum.Inserted,
				},
			}

			expect(() => defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)).toThrow(
				/Segment(.*)not found/
			)
		})

		it('delete missing', async () => {
			const nrcsRundown = createIngestRundownWithManySegments()
			const { mutableIngestRundown, mockCalls } = createMutableIngestRundown(clone(nrcsRundown))

			const changes: IncomingIngestChange = {
				source: 'ingest',
				segmentChanges: {
					segX: IncomingIngestSegmentChangeEnum.Deleted,
				},
			}

			// should run without error
			defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

			expect(mockCalls).toHaveLength(1)
			expect(mockCalls[0]).toEqual({ target: 'rundown', name: 'removeSegment', args: ['segX'] })
		})

		it('update missing', async () => {
			const nrcsRundown = createIngestRundownWithManySegments()
			const { mutableIngestRundown } = createMutableIngestRundown(clone(nrcsRundown))

			const changes: IncomingIngestChange = {
				source: 'ingest',
				segmentChanges: {
					segX: {
						payloadChanged: true,
					},
				},
			}

			// should run without error
			expect(() => defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)).toThrow(
				/Segment(.*)not found/
			)
		})

		it('update without changes', async () => {
			const nrcsRundown = createIngestRundownWithManySegments()
			const { mutableIngestRundown, mockCalls } = createMutableIngestRundown(clone(nrcsRundown))

			const changes: IncomingIngestChange = {
				source: 'ingest',
				segmentChanges: {
					seg1: {},
				},
			}

			// should run without error
			defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

			expect(mockCalls).toHaveLength(0)
		})

		describe('partOrderChanged', () => {
			it('with single part', async () => {
				const nrcsRundown = createMediumIngestRundown()
				const { mutableIngestRundown, mockCalls } = createMutableIngestRundown(clone(nrcsRundown))

				const changes: IncomingIngestChange = {
					source: 'ingest',
					segmentChanges: {
						seg1: {
							partOrderChanged: true,
						},
					},
				}

				// should run without error
				defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

				expect(mockCalls).toHaveLength(1)
				expect(mockCalls[0]).toEqual({ target: 'segment seg1', name: 'movePartBefore', args: ['part2', null] })
			})
			it('with multiple parts', async () => {
				const nrcsRundown = createMediumIngestRundown()
				const { mutableIngestRundown, mockCalls } = createMutableIngestRundown(clone(nrcsRundown))

				// reorder parts
				const origParts = nrcsRundown.segments[2].parts
				nrcsRundown.segments[2].parts = [origParts[1], origParts[0], origParts[2]]

				const changes: IncomingIngestChange = {
					source: 'ingest',
					segmentChanges: {
						seg2: {
							partOrderChanged: true,
						},
					},
				}

				// should run without error
				defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

				expect(mockCalls).toHaveLength(3)
				expect(mockCalls[0]).toEqual({ target: 'segment seg2', name: 'movePartBefore', args: ['part5', null] })
				expect(mockCalls[1]).toEqual({
					target: 'segment seg2',
					name: 'movePartBefore',
					args: ['part3', 'part5'],
				})
				expect(mockCalls[2]).toEqual({
					target: 'segment seg2',
					name: 'movePartBefore',
					args: ['part4', 'part3'],
				})
			})

			it('missing part in new order', async () => {
				const nrcsRundown = createMediumIngestRundown()
				const { mutableIngestRundown, mockCalls } = createMutableIngestRundown(clone(nrcsRundown))

				// remove a part
				nrcsRundown.segments[2].parts.splice(1, 1)

				const changes: IncomingIngestChange = {
					source: 'ingest',
					segmentChanges: {
						seg2: {
							partOrderChanged: true,
						},
					},
				}

				// should run without error
				defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

				expect(mockCalls).toHaveLength(3)
				expect(mockCalls[0]).toEqual({ target: 'segment seg2', name: 'movePartBefore', args: ['part5', null] })
				expect(mockCalls[1]).toEqual({
					target: 'segment seg2',
					name: 'movePartBefore',
					args: ['part3', 'part5'],
				})
				expect(mockCalls[2]).toEqual({
					target: 'segment seg2',
					name: 'movePartAfter',
					args: ['part4', 'part3'],
				})
			})

			it('extra segment in new order', async () => {
				const nrcsRundown = createMediumIngestRundown()
				const { mutableIngestRundown, mockCalls } = createMutableIngestRundown(clone(nrcsRundown))

				// add an extra nrcs part
				nrcsRundown.segments[2].parts.splice(1, 0, {
					externalId: 'partX',
					rank: 0,
					name: 'my part',
					payload: {
						partData: 'data',
					},
				})

				const changes: IncomingIngestChange = {
					source: 'ingest',
					segmentChanges: {
						seg2: {
							partOrderChanged: true,
						},
					},
				}

				// should run without error
				defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

				// performs reorder, ignoring segX
				expect(mockCalls).toHaveLength(3)
				expect(mockCalls[0]).toEqual({ target: 'segment seg2', name: 'movePartBefore', args: ['part5', null] })
				expect(mockCalls[1]).toEqual({
					target: 'segment seg2',
					name: 'movePartBefore',
					args: ['part4', 'part5'],
				})
				expect(mockCalls[2]).toEqual({
					target: 'segment seg2',
					name: 'movePartBefore',
					args: ['part3', 'part4'],
				})
			})
		})

		// TODO - renames, removes, adds, updates
	})

	// TODO - more scenarios
})
