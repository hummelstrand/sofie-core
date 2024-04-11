import { clone } from '@sofie-automation/corelib/dist/lib'
import { MutableIngestRundownChanges, MutableIngestRundownImpl } from '../MutableIngestRundownImpl'
import {
	LocalIngestPart,
	LocalIngestRundown,
	LocalIngestSegment,
	RundownIngestDataCacheGenerator,
} from '../../../ingest/ingestCache'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { getSegmentId } from '../../../ingest/lib'
import { MutableIngestPartImpl } from '../MutableIngestPartImpl'
import { IngestPart } from '@sofie-automation/blueprints-integration'
import { IngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
import { IngestDataCacheObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MutableIngestSegmentImpl } from '../MutableIngestSegmentImpl'

describe('MutableIngestRundownImpl', () => {
	function getBasicIngestRundown(): LocalIngestRundown {
		return {
			externalId: 'rundown0',
			type: 'mock',
			name: 'rundown-name',
			modified: 0,
			payload: {
				val: 'some-val',
				second: 5,
			},
			segments: [
				{
					externalId: 'seg0',
					name: 'name',
					rank: 0,
					modified: 0,
					payload: {
						val: 'first-val',
						second: 5,
					},
					parts: [
						{
							externalId: 'part0',
							name: 'my first part',
							rank: 0,
							modified: 0,
							payload: {
								val: 'some-val',
							},
						},
					],
				},
				{
					externalId: 'seg1',
					name: 'name 2',
					rank: 1,
					modified: 0,
					payload: {
						val: 'next-val',
					},
					parts: [
						{
							externalId: 'part1',
							name: 'my second part',
							rank: 0,
							modified: 0,
							payload: {
								val: 'some-val',
							},
						},
					],
				},
				{
					externalId: 'seg2',
					name: 'name 3',
					rank: 2,
					modified: 0,
					payload: {
						val: 'last-val',
					},
					parts: [
						{
							externalId: 'part2',
							name: 'my third part',
							rank: 0,
							modified: 0,
							payload: {
								val: 'some-val',
							},
						},
					],
				},
			],
		}
	}

	const ingestObjectGenerator = new RundownIngestDataCacheGenerator(protectString('rundownId'))

	function createNoChangesObject(ingestRundown: LocalIngestRundown): MutableIngestRundownChanges {
		const allCacheObjectIds: IngestDataCacheObjId[] = []
		for (const segment of ingestRundown.segments) {
			allCacheObjectIds.push(ingestObjectGenerator.getSegmentObjectId(segment.externalId))
			for (const part of segment.parts) {
				allCacheObjectIds.push(ingestObjectGenerator.getPartObjectId(part.externalId))
			}
		}
		allCacheObjectIds.push(ingestObjectGenerator.getRundownObjectId())

		return {
			computedChanges: {
				ingestRundown,

				segmentsToRemove: [],
				segmentsUpdatedRanks: {},
				segmentsToRegenerate: [],
				regenerateRundown: false,

				segmentRenames: {},
			},
			changedCacheObjects: [],
			allCacheObjectIds: allCacheObjectIds,
		}
	}
	function addChangedSegments(
		changes: MutableIngestRundownChanges,
		_ingestRundown: LocalIngestRundown,
		...ingestSegments: LocalIngestSegment[]
	): void {
		for (const ingestSegment of ingestSegments) {
			const segmentId = getSegmentId(ingestObjectGenerator.rundownId, ingestSegment.externalId)

			changes.computedChanges.segmentsToRegenerate.push(ingestSegment)

			for (const part of ingestSegment.parts) {
				changes.changedCacheObjects.push(ingestObjectGenerator.generatePartObject(segmentId, part))
			}

			changes.changedCacheObjects.push(ingestObjectGenerator.generateSegmentObject(ingestSegment))
		}
	}
	function addChangedRundown(changes: MutableIngestRundownChanges): void {
		changes.computedChanges.regenerateRundown = true
		changes.changedCacheObjects.push(
			ingestObjectGenerator.generateRundownObject(changes.computedChanges.ingestRundown)
		)
	}
	function removeSegmentFromIngestRundown(ingestRundown: LocalIngestRundown, segmentId: string): void {
		const ingestPart = ingestRundown.segments.find((p) => p.externalId === segmentId)
		ingestRundown.segments = ingestRundown.segments.filter((p) => p.externalId !== segmentId)
		if (ingestPart) {
			for (const part of ingestRundown.segments) {
				if (part.rank > ingestPart.rank) part.rank--
			}
		}
	}
	// function getSegmentIdOrder(mutableRundown: MutableIngestRundownImpl): string[] {
	// 	return mutableRundown.segments.map((p) => p.externalId)
	// }

	test('create basic', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

		// compare properties
		expect(mutableRundown.externalId).toBe(ingestRundown.externalId)
		expect(mutableRundown.name).toBe(ingestRundown.name)
		expect(mutableRundown.payload).toEqual(ingestRundown.payload)
		expect(mutableRundown.segments.length).toBe(ingestRundown.segments.length)

		// check it has no changes
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))
	})

	test('create basic with changes', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), false)

		// compare properties
		expect(mutableRundown.externalId).toBe(ingestRundown.externalId)
		expect(mutableRundown.name).toBe(ingestRundown.name)
		expect(mutableRundown.payload).toEqual(ingestRundown.payload)
		expect(mutableRundown.segments.length).toBe(ingestRundown.segments.length)

		// check it has changes
		const expectedChanges = createNoChangesObject(ingestRundown)
		addChangedSegments(expectedChanges, ingestRundown, ...ingestRundown.segments)
		addChangedRundown(expectedChanges)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)

		// check changes have been cleared
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))
	})

	test('set name', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

		// compare properties
		expect(mutableRundown.name).toBe(ingestRundown.name)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))

		mutableRundown.setName('new-name')
		expect(mutableRundown.name).toBe('new-name')

		// check it has changes
		const expectedChanges = createNoChangesObject(clone(ingestRundown))
		expectedChanges.computedChanges.ingestRundown.name = 'new-name'
		addChangedRundown(expectedChanges)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
	})

	test('replace payload with change', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

		// compare properties
		expect(mutableRundown.payload).toEqual(ingestRundown.payload)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))

		const newPayload = { val: 'new-val' }
		mutableRundown.replacePayload(newPayload)
		expect(mutableRundown.payload).toEqual(newPayload)

		// check it has changes
		const expectedChanges = createNoChangesObject(clone(ingestRundown))
		expectedChanges.computedChanges.ingestRundown.payload = newPayload
		addChangedRundown(expectedChanges)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
	})

	test('replace payload with no change', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

		// compare properties
		expect(mutableRundown.payload).toEqual(ingestRundown.payload)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))

		mutableRundown.replacePayload(ingestRundown.payload)
		expect(mutableRundown.payload).toEqual(ingestRundown.payload)

		// check it has no changes
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))
	})

	test('set payload property change', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl<any>(clone(ingestRundown), true)

		// compare properties
		expect(mutableRundown.payload).toEqual(ingestRundown.payload)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))

		const newPayload = { ...ingestRundown.payload, test: 123, second: undefined }
		mutableRundown.setPayloadProperty('test', 123)
		mutableRundown.setPayloadProperty('second', undefined)
		expect(mutableRundown.payload).toEqual(newPayload)

		// check it has changes
		const expectedChanges = createNoChangesObject(clone(ingestRundown))
		expectedChanges.computedChanges.ingestRundown.payload = newPayload
		addChangedRundown(expectedChanges)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
	})

	test('set payload property unchanged', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl<any>(clone(ingestRundown), true)

		// compare properties
		expect(mutableRundown.payload).toEqual(ingestRundown.payload)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))

		mutableRundown.setPayloadProperty('val', ingestRundown.payload.val)
		mutableRundown.setPayloadProperty('another', undefined)
		expect(mutableRundown.payload).toEqual(ingestRundown.payload)

		// check it has no changes
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))
	})

	test('get segments', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

		// compare properties
		expect(mutableRundown.segments.length).toBe(ingestRundown.segments.length)
		expect(mutableRundown.getSegment('seg0')).toStrictEqual(mutableRundown.segments[0])
		expect(mutableRundown.getSegment('seg0') instanceof MutableIngestSegmentImpl).toBe(true)
		expect(mutableRundown.getSegment('seg1')).toStrictEqual(mutableRundown.segments[1])
		expect(mutableRundown.getSegment('seg1') instanceof MutableIngestSegmentImpl).toBe(true)
		expect(mutableRundown.getSegment('seg2')).toStrictEqual(mutableRundown.segments[2])
		expect(mutableRundown.getSegment('seg2') instanceof MutableIngestSegmentImpl).toBe(true)
		expect(mutableRundown.getSegment('seg3')).toBeUndefined()

		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))
	})

	describe('removeSegment', () => {
		test('good', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			expect(mutableRundown.removeSegment('seg1')).toBeTruthy()

			// compare properties
			expect(mutableRundown.segments.length).toBe(2)
			expect(mutableRundown.getSegment('seg1')).toBeUndefined()

			// check it has changes
			const expectedIngestRundown = clone(ingestRundown)
			removeSegmentFromIngestRundown(expectedIngestRundown, 'seg1')
			const expectedChanges = createNoChangesObject(expectedIngestRundown)
			expectedChanges.computedChanges.segmentsToRemove.push('seg1')
			expectedChanges.computedChanges.segmentsUpdatedRanks = { seg2: 1 }
			expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)

			// try removing a second time
			expect(mutableRundown.removeSegment('seg1')).toBeFalsy()
			expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(
				createNoChangesObject(expectedIngestRundown)
			)
		})

		test('unknown id', () => {
			const ingestRundown = getBasicIngestRundown()
			const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

			expect(mutableRundown.removeSegment('segX')).toBeFalsy()

			// compare properties
			expect(mutableRundown.segments.length).toBe(ingestRundown.segments.length)

			// ensure no changes
			expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(
				createNoChangesObject(ingestRundown)
			)
		})
	})

	test('forceRegenerate', () => {
		const ingestRundown = getBasicIngestRundown()
		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown), true)

		// ensure no changes
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(createNoChangesObject(ingestRundown))

		mutableRundown.forceFullRegenerate()

		// check it has changes
		const expectedChanges = createNoChangesObject(ingestRundown)
		addChangedRundown(expectedChanges)
		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
	})

	// describe('replacePart', () => {
	// 	test('replace existing with a move', () => {
	// 		const ingestRundown = getBasicIngestRundown()
	// 		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown))

	// 		expect(mutableRundown.getSegment('part1')).toBeDefined()
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part0', 'part1', 'part2', 'part3'])

	// 		const newPart: Omit<IngestPart, 'rank'> = {
	// 			externalId: 'part1',
	// 			name: 'new name',
	// 			payload: {
	// 				val: 'new-val',
	// 			},
	// 		}
	// 		const replacedPart = mutableRundown.replacePart(newPart, null)
	// 		expect(replacedPart).toBeDefined()
	// 		// ensure the inserted part looks correct
	// 		expect(replacedPart?.externalId).toBe(newPart.externalId)
	// 		expect(replacedPart?.name).toBe(newPart.name)
	// 		expect(replacedPart?.payload).toEqual(newPart.payload)

	// 		// check it has changes
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part0', 'part2', 'part3', 'part1'])
	// 		const expectedIngestRundown = clone(ingestRundown)
	// 		removePartFromIngestRundown(expectedIngestRundown, 'part1')
	// 		expectedIngestRundown.segments.push({ ...newPart, rank: 3, modified: 0 })

	// 		const expectedChanges = createNoChangesObject(expectedIngestRundown)
	// 		expectedChanges.partOrderHasChanged = true
	// 		expectedChanges.partIdsWithChanges.push('part1')
	// 		expectedChanges.changedCacheObjects.push(
	// 			ingestObjectGenerator.generatePartObject(
	// 				getSegmentId(ingestObjectGenerator.rundownId, ingestRundown.externalId),
	// 				{ ...newPart, rank: 3 }
	// 			)
	// 		)

	// 		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
	// 	})

	// 	test('insert new', () => {
	// 		const ingestRundown = getBasicIngestRundown()
	// 		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown))

	// 		expect(mutableRundown.getSegment('partX')).toBeUndefined()
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part0', 'part1', 'part2', 'part3'])

	// 		const newPart: Omit<IngestPart, 'rank'> = {
	// 			externalId: 'partX',
	// 			name: 'new name',
	// 			payload: {
	// 				val: 'new-val',
	// 			},
	// 		}
	// 		const replacedPart = mutableRundown.replacePart(newPart, null)
	// 		expect(replacedPart).toBeDefined()
	// 		// ensure the inserted part looks correct
	// 		expect(replacedPart?.externalId).toBe(newPart.externalId)
	// 		expect(replacedPart?.name).toBe(newPart.name)
	// 		expect(replacedPart?.payload).toEqual(newPart.payload)

	// 		// check it has changes
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part0', 'part1', 'part2', 'part3', 'partX'])
	// 		const expectedIngestRundown = clone(ingestRundown)
	// 		expectedIngestRundown.segments.push({ ...newPart, rank: 4, modified: 0 })

	// 		const expectedChanges = createNoChangesObject(expectedIngestRundown)
	// 		expectedChanges.partOrderHasChanged = true
	// 		expectedChanges.partIdsWithChanges.push('partX')
	// 		expectedChanges.changedCacheObjects.push(
	// 			ingestObjectGenerator.generatePartObject(
	// 				getSegmentId(ingestObjectGenerator.rundownId, ingestRundown.externalId),
	// 				{ ...newPart, rank: 4 }
	// 			)
	// 		)

	// 		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)
	// 	})

	// 	test('insert at position', () => {
	// 		const ingestRundown = getBasicIngestRundown()
	// 		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown))

	// 		expect(mutableRundown.getSegment('partX')).toBeUndefined()
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part0', 'part1', 'part2', 'part3'])

	// 		const newPart: Omit<IngestPart, 'rank'> = {
	// 			externalId: 'partX',
	// 			name: 'new name',
	// 			payload: {
	// 				val: 'new-val',
	// 			},
	// 		}

	// 		// insert at the end
	// 		expect(mutableRundown.replacePart(newPart, null)).toBeDefined()
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part0', 'part1', 'part2', 'part3', 'partX'])

	// 		// insert at the beginning
	// 		expect(mutableRundown.replacePart(newPart, 'part0')).toBeDefined()
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['partX', 'part0', 'part1', 'part2', 'part3'])

	// 		// insert in the middle
	// 		expect(mutableRundown.replacePart(newPart, 'part2')).toBeDefined()
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part0', 'part1', 'partX', 'part2', 'part3'])

	// 		// Only the one should have changes
	// 		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator).partIdsWithChanges).toEqual(['partX'])

	// 		// Try inserting before itself
	// 		expect(() => mutableRundown.replacePart(newPart, newPart.externalId)).toThrow(
	// 			/Cannot insert Part before itself/
	// 		)

	// 		// Try inserting before an unknown part
	// 		expect(() => mutableRundown.replacePart(newPart, 'partY')).toThrow(/Part(.*)not found/)
	// 	})
	// })

	// describe('movePartBefore', () => {
	// 	test('move unknown', () => {
	// 		const ingestRundown = getBasicIngestRundown()
	// 		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown))

	// 		expect(mutableRundown.getSegment('partX')).toBeUndefined()
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part0', 'part1', 'part2', 'part3'])

	// 		expect(() => mutableRundown.movePartBefore('partX', null)).toThrow(/Part(.*)not found/)
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part0', 'part1', 'part2', 'part3'])
	// 	})

	// 	test('move to position', () => {
	// 		const ingestRundown = getBasicIngestRundown()
	// 		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown))

	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part0', 'part1', 'part2', 'part3'])

	// 		// insert at the end
	// 		mutableRundown.movePartBefore('part1', null)
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part0', 'part2', 'part3', 'part1'])

	// 		// insert at the beginning
	// 		mutableRundown.movePartBefore('part1', 'part0')
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part1', 'part0', 'part2', 'part3'])

	// 		// insert in the middle
	// 		mutableRundown.movePartBefore('part1', 'part2')
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part0', 'part1', 'part2', 'part3'])

	// 		// Only the one should have changes
	// 		const expectedChanges = createNoChangesObject(ingestRundown)
	// 		expectedChanges.partOrderHasChanged = true
	// 		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)

	// 		// Try inserting before itself
	// 		expect(() => mutableRundown.movePartBefore('part1', 'part1')).toThrow(/Cannot move Part before itself/)

	// 		// Try inserting before an unknown part
	// 		expect(() => mutableRundown.movePartBefore('part1', 'partY')).toThrow(/Part(.*)not found/)
	// 	})
	// })

	// describe('movePartAfter', () => {
	// 	test('move unknown', () => {
	// 		const ingestRundown = getBasicIngestRundown()
	// 		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown))

	// 		expect(mutableRundown.getSegment('partX')).toBeUndefined()
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part0', 'part1', 'part2', 'part3'])

	// 		expect(() => mutableRundown.movePartAfter('partX', null)).toThrow(/Part(.*)not found/)
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part0', 'part1', 'part2', 'part3'])
	// 	})

	// 	test('move to position', () => {
	// 		const ingestRundown = getBasicIngestRundown()
	// 		const mutableRundown = new MutableIngestRundownImpl(clone(ingestRundown))

	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part0', 'part1', 'part2', 'part3'])

	// 		// insert at the beginning
	// 		mutableRundown.movePartAfter('part1', null)
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part1', 'part0', 'part2', 'part3'])

	// 		// insert at the end
	// 		mutableRundown.movePartAfter('part1', 'part3')
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part0', 'part2', 'part3', 'part1'])

	// 		// insert in the middle
	// 		mutableRundown.movePartAfter('part1', 'part0')
	// 		expect(getSegmentIdOrder(mutableRundown)).toEqual(['part0', 'part1', 'part2', 'part3'])

	// 		// Only the one should have changes
	// 		const expectedChanges = createNoChangesObject(ingestRundown)
	// 		expectedChanges.partOrderHasChanged = true
	// 		expect(mutableRundown.intoIngestRundown(ingestObjectGenerator)).toEqual(expectedChanges)

	// 		// Try inserting before itself
	// 		expect(() => mutableRundown.movePartAfter('part1', 'part1')).toThrow(/Cannot move Part after itself/)

	// 		// Try inserting before an unknown part
	// 		expect(() => mutableRundown.movePartAfter('part1', 'partY')).toThrow(/Part(.*)not found/)
	// 	})
	// })
})
