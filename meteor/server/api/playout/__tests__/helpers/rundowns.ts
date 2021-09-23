import * as _ from 'underscore'
import {
	PartHoldMode,
	PieceLifespan,
} from '@sofie-automation/blueprints-integration'
import { getCurrentTime, protectString } from '../../../../../lib/lib'
import { DBRundown, Rundowns, RundownId } from '../../../../../lib/collections/Rundowns'
import { DBSegment, Segments } from '../../../../../lib/collections/Segments'
import { DBPart, Parts } from '../../../../../lib/collections/Parts'
import { Piece, Pieces } from '../../../../../lib/collections/Pieces'
import { RundownAPI } from '../../../../../lib/api/rundown'
import { RundownPlaylistId } from '../../../../../lib/collections/RundownPlaylists'
import { RundownBaselineAdLibItem, RundownBaselineAdLibPieces } from '../../../../../lib/collections/RundownBaselineAdLibPieces'
import { AdLibPiece, AdLibPieces } from '../../../../../lib/collections/AdLibPieces'
import { DefaultEnvironment, LAYER_IDS } from '../../../../../__mocks__/helpers/database'

export function setupRundownBase (
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	partPropsOverride: Partial<DBPart> = {}
) {
	const rundown: DBRundown = {
		peripheralDeviceId: env.ingestDevice._id,
		organizationId: null,
		studioId: env.studio._id,
		showStyleBaseId: env.showStyleBase._id,
		showStyleVariantId: env.showStyleVariant._id,
		timing: {
			type: 'none' as any,
		},

		playlistId: playlistId,
		_rank: 0,

		_id: rundownId,
		externalId: 'MOCK_RUNDOWN',
		name: 'Default Rundown',

		created: getCurrentTime(),
		modified: getCurrentTime(),
		importVersions: {
			studio: '',
			showStyleBase: '',
			showStyleVariant: '',
			blueprint: '',
			core: '',
		},

		externalNRCSName: 'mock',
	}
	Rundowns.insert(rundown)

	const segment0: DBSegment = {
		_id: protectString(rundownId + '_segment0'),
		_rank: 0,
		externalId: 'MOCK_SEGMENT_0',
		rundownId: rundown._id,
		name: 'Segment 0',
		externalModified: 1,
	}
	Segments.insert(segment0)
	/* tslint:disable:ter-indent*/
	//
	const part00: DBPart = {
		_id: protectString(rundownId + '_part0_0'),
		segmentId: segment0._id,
		rundownId: rundown._id,
		_rank: 0,
		externalId: 'MOCK_PART_0_0',
		title: 'Part 0 0',

		...partPropsOverride
	}
	Parts.insert(part00)

	const piece000: Piece = {
		_id: protectString(rundownId + '_piece000'),
		externalId: 'MOCK_PIECE_000',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 000',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece000)

	const piece001: Piece = {
		_id: protectString(rundownId + '_piece001'),
		externalId: 'MOCK_PIECE_001',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 001',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[1]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece001)

	return { rundown, segment0, part00 }
}

export function setupRundownWithPreroll(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0, part00 } = setupRundownBase(env, playlistId, rundownId)

	const part01: DBPart = {
		_id: protectString(rundownId + '_part0_1'),
		segmentId: segment0._id,
		rundownId: segment0.rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',

		prerollDuration: 500
	}
	Parts.insert(part01)

	const piece010: Piece = {
		_id: protectString(rundownId + '_piece010'),
		externalId: 'MOCK_PIECE_010',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 010',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece010)

	return rundownId
}

export function setupRundownWithInTransition(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0, part00 } = setupRundownBase(env, playlistId, rundownId)

	const part01: DBPart = {
		_id: protectString(rundownId + '_part0_1'),
		segmentId: segment0._id,
		rundownId: segment0.rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',

        transitionDuration: 1000,
        transitionKeepaliveDuration: 1000,
        transitionPrerollDuration: 0
	}
	Parts.insert(part01)

	const piece010: Piece = {
		_id: protectString(rundownId + '_piece010'),
		externalId: 'MOCK_PIECE_010',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 010',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece010)

	return rundownId
}

export function setupRundownWithInTransitionPlannedPiece(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0, part00 } = setupRundownBase(env, playlistId, rundownId)

	const part01: DBPart = {
		_id: protectString(rundownId + '_part0_1'),
		segmentId: segment0._id,
		rundownId: segment0.rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',

		transitionDuration: 1000,
		transitionKeepaliveDuration: 1000,
		transitionPrerollDuration: 500,
	}
	Parts.insert(part01)

	const piece010: Piece = {
		_id: protectString(rundownId + '_piece010'),
		externalId: 'MOCK_PIECE_010',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 010',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece010)

    const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[2]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
		isTransition: true,
	}
	Pieces.insert(piece011)
	
	// delayed piece
	const piece012: Piece = {
		_id: protectString(rundownId + '_piece012'),
		externalId: 'MOCK_PIECE_012',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 012',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 1000,
			duration: 1000,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[3]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece012)

	return rundownId
}

export function setupRundownWithInTransitionPreroll(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0, part00 } = setupRundownBase(env, playlistId, rundownId)

	const part01: DBPart = {
		_id: protectString(rundownId + '_part0_1'),
		segmentId: segment0._id,
		rundownId: segment0.rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',

		transitionDuration: 1000,
		transitionKeepaliveDuration: 1000,
		transitionPrerollDuration: 500,
	}
	Parts.insert(part01)

	const piece010: Piece = {
		_id: protectString(rundownId + '_piece010'),
		externalId: 'MOCK_PIECE_010',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 010',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece010)

    const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[2]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
		isTransition: true,
	}
	Pieces.insert(piece011)

	return rundownId
}

export function setupRundownWithInTransitionPrerollAndPreroll(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0, part00 } = setupRundownBase(env, playlistId, rundownId)

	const part01: DBPart = {
		_id: protectString(rundownId + '_part0_1'),
		segmentId: segment0._id,
		rundownId: segment0.rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',

		transitionDuration: 1000,
		transitionKeepaliveDuration: 1000,
		transitionPrerollDuration: 500,
        prerollDuration: 250
	}
	Parts.insert(part01)

	const piece010: Piece = {
		_id: protectString(rundownId + '_piece010'),
		externalId: 'MOCK_PIECE_010',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 010',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece010)
	
    const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[2]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
        isTransition: true
	}
	Pieces.insert(piece011)

	return rundownId
}

export function setupRundownWithInTransitionExistingInfinite(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0, part00 } = setupRundownBase(env, playlistId, rundownId)

	const piece002: Piece = {
		_id: protectString(rundownId + '_piece002'),
		externalId: 'MOCK_PIECE_002',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 002',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[3]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.OutOnSegmentEnd,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece002)

	const part01: DBPart = {
		_id: protectString(rundownId + '_part0_1'),
		segmentId: segment0._id,
		rundownId: segment0.rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',

		transitionDuration: 1000,
		transitionKeepaliveDuration: 1000,
		transitionPrerollDuration: 500,
	}
	Parts.insert(part01)

	const piece010: Piece = {
		_id: protectString(rundownId + '_piece010'),
		externalId: 'MOCK_PIECE_010',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 010',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece010)

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[2]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
		isTransition: true,
	}
	Pieces.insert(piece011)

	return rundownId
}

export function setupRundownWithInTransitionNewInfinite(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0, part00 } = setupRundownBase(env, playlistId, rundownId)

	const part01: DBPart = {
		_id: protectString(rundownId + '_part0_1'),
		segmentId: segment0._id,
		rundownId: segment0.rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',

		transitionDuration: 1000,
		transitionKeepaliveDuration: 1000,
		transitionPrerollDuration: 500,
	}
	Parts.insert(part01)

	const piece010: Piece = {
		_id: protectString(rundownId + '_piece010'),
		externalId: 'MOCK_PIECE_010',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 010',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece010)

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[2]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
		isTransition: true,
	}
	Pieces.insert(piece011)
    

	const piece012: Piece = {
		_id: protectString(rundownId + '_piece012'),
		externalId: 'MOCK_PIECE_012',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part01._id,
		name: 'Piece 012',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[3]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.OutOnSegmentEnd,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece012)

	return rundownId
}

export function setupRundownWithInTransitionEnableHold(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0, part00 } = setupRundownBase(env, playlistId, rundownId, { holdMode: PartHoldMode.FROM })

	const part01: DBPart = {
		_id: protectString(rundownId + '_part0_1'),
		segmentId: segment0._id,
		rundownId: segment0.rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',
		holdMode: PartHoldMode.TO,

		transitionDuration: 1000,
		transitionKeepaliveDuration: 1000,
		transitionPrerollDuration: 500,
	}
	Parts.insert(part01)

	const piece010: Piece = {
		_id: protectString(rundownId + '_piece010'),
		externalId: 'MOCK_PIECE_010',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 010',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece010)

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[2]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
		isTransition: true,
	}
	Pieces.insert(piece011)

	return rundownId
}

export function setupRundownWithInTransitionDisabled(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const rundown: DBRundown = {
		peripheralDeviceId: env.ingestDevice._id,
		organizationId: null,
		studioId: env.studio._id,
		showStyleBaseId: env.showStyleBase._id,
		showStyleVariantId: env.showStyleVariant._id,
		timing: {
			type: 'none' as any,
		},

		playlistId: playlistId,
		_rank: 0,

		_id: rundownId,
		externalId: 'MOCK_RUNDOWN',
		name: 'Default Rundown',

		created: getCurrentTime(),
		modified: getCurrentTime(),
		importVersions: {
			studio: '',
			showStyleBase: '',
			showStyleVariant: '',
			blueprint: '',
			core: '',
		},

		externalNRCSName: 'mock',
	}
	Rundowns.insert(rundown)

	const segment0: DBSegment = {
		_id: protectString(rundownId + '_segment0'),
		_rank: 0,
		externalId: 'MOCK_SEGMENT_0',
		rundownId: rundown._id,
		name: 'Segment 0',
		externalModified: 1,
	}
	Segments.insert(segment0)
	/* tslint:disable:ter-indent*/
	//
	const part00: DBPart = {
		_id: protectString(rundownId + '_part0_0'),
		segmentId: segment0._id,
		rundownId: rundown._id,
		_rank: 0,
		externalId: 'MOCK_PART_0_0',
		title: 'Part 0 0',
		disableOutTransition: true,
	}
	Parts.insert(part00)

	const piece000: Piece = {
		_id: protectString(rundownId + '_piece000'),
		externalId: 'MOCK_PIECE_000',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 000',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece000)

	const piece001: Piece = {
		_id: protectString(rundownId + '_piece001'),
		externalId: 'MOCK_PIECE_001',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 001',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[1]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece001)

	const part01: DBPart = {
		_id: protectString(rundownId + '_part0_1'),
		segmentId: segment0._id,
		rundownId: segment0.rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',

		transitionDuration: 1000,
		transitionKeepaliveDuration: 1000,
		transitionPrerollDuration: 500,
	}
	Parts.insert(part01)

	const piece010: Piece = {
		_id: protectString(rundownId + '_piece010'),
		externalId: 'MOCK_PIECE_010',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 010',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece010)

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[2]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
		isTransition: true,
	}
	Pieces.insert(piece011)

	return rundownId
}

