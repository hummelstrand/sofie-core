/* eslint-disable */
/**
 * This file was automatically generated using and @asyncapi/parser @asyncapi/modelina.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source AsyncAPI schema files,
 * and run "yarn generate-schema-types" to regenerate this file.
 */
type Slash = AnonymousSchema_11 | AnonymousSchema_13 | AnonymousSchema_16 | AnonymousSchema_18 | AnonymousSchema_22 | AnonymousSchema_31 | AnonymousSchema_84 | AnonymousSchema_90 | AnonymousSchema_106;

interface AnonymousSchema_11 {
  reservedEvent: 'pong';
  /**
   * Client originated ID reflected in response message.
   */
  reqid: number;
}

interface AnonymousSchema_13 {
  reservedEvent: 'heartbeat';
}

interface AnonymousSchema_16 {
  errorMessage: string;
  reservedEvent: 'subscriptionStatus';
  /**
   * Client originated ID reflected in response message.
   */
  reqid: number;
  subscription: AnonymousSchema_20;
}

interface AnonymousSchema_20 {
  /**
   * The name of the topic related to this status.
   */
  reservedName: AnonymousSchema_7;
  /**
   * The current status of the subscription
   */
  reservedStatus: AnonymousSchema_21;
}

/**
 * The name of the topic related to this status.
 */
enum AnonymousSchema_7 {
  STUDIO = "studio",
  ACTIVE_PLAYLIST = "activePlaylist",
}

/**
 * The current status of the subscription
 */
enum AnonymousSchema_21 {
  SUBSCRIBED = "subscribed",
  UNSUBSCRIBED = "unsubscribed",
}

interface AnonymousSchema_18 {
  reservedEvent: 'subscriptionStatus';
  /**
   * Client originated ID reflected in response message.
   */
  reqid: number;
  subscription: AnonymousSchema_20;
}

interface AnonymousSchema_22 {
  reservedEvent: 'studio';
  /**
   * Unique id of the studio
   */
  id: string;
  /**
   * User-presentable name for the studio installation
   */
  reservedName: string;
  /**
   * The playlists that are currently loaded in the studio
   */
  playlists: AnonymousSchema_27[];
}

interface AnonymousSchema_27 {
  /**
   * Unique id of the playlist
   */
  id: string;
  /**
   * The user defined playlist name
   */
  reservedName: string;
  /**
   * Whether this playlist is currently active or in rehearsal
   */
  activationStatus: AnonymousSchema_30;
}

/**
 * Whether this playlist is currently active or in rehearsal
 */
enum AnonymousSchema_30 {
  DEACTIVATED = "deactivated",
  REHEARSAL = "rehearsal",
  ACTIVATED = "activated",
}

interface AnonymousSchema_31 {
  reservedEvent: 'activePlaylist';
  /**
   * Unique id of the active playlist
   */
  id: string;
  /**
   * User-presentable name for the active playlist
   */
  reservedName: string;
  /**
   * The set of rundownIds in the active playlist
   */
  rundownIds: string[];
  currentPart: AnonymousSchema_38 | null;
  currentSegment: AnonymousSchema_60;
  nextPart: AnonymousSchema_39 | null;
  /**
   * Optional arbitrary data
   */
  publicData?: any;
  /**
   * Information about the current quickLoop, if any
   */
  quickLoop?: AnonymousSchema_70;
  /**
   * Timing information about the active playlist
   */
  timing: AnonymousSchema_78;
}

interface AnonymousSchema_38 {
  /**
   * Unique id of the part
   */
  id: string;
  /**
   * User name of the part
   */
  reservedName: string;
  /**
   * Unique id of the segment this part belongs to
   */
  segmentId: string;
  /**
   * If this part will progress to the next automatically
   */
  autoNext?: boolean;
  /**
   * All pieces in this part
   */
  pieces: AnonymousSchema_45[];
  /**
   * Optional arbitrary data
   */
  publicData?: any;
  /**
   * Timing information about the current part
   */
  timing: AnonymousSchema_55;
  additionalProperties?: Record<string, any>;
}

interface AnonymousSchema_45 {
  /**
   * Unique id of the Piece
   */
  id: string;
  /**
   * User-facing name of the Piece
   */
  reservedName: string;
  /**
   * The source layer name for this Piece
   */
  sourceLayer: string;
  /**
   * The output layer name for this Piece
   */
  outputLayer: string;
  /**
   * Tags attached to this Piece
   */
  tags?: string[];
  /**
   * Optional arbitrary data
   */
  publicData?: any;
}

/**
 * Timing information about the current part
 */
interface AnonymousSchema_55 {
  /**
   * Unix timestamp of when the part started (milliseconds)
   */
  startTime: number;
  /**
   * Expected duration of the part (milliseconds)
   */
  expectedDurationMs: number;
  /**
   * Unix timestamp of when the part is projected to end (milliseconds). A sum of `startTime` and `expectedDurationMs`.
   */
  projectedEndTime: number;
  additionalProperties?: Record<string, any>;
}

interface AnonymousSchema_60 {
  /**
   * Unique id of the segment
   */
  id: string;
  /**
   * Timing information about the current segment
   */
  timing: AnonymousSchema_62;
}

/**
 * Timing information about the current segment
 */
interface AnonymousSchema_62 {
  /**
   * Expected duration of the segment
   */
  expectedDurationMs: number;
  /**
   * Budget duration of the segment
   */
  budgetDurationMs?: number;
  /**
   * Unix timestamp of when the segment is projected to end (milliseconds). The time this segment started, offset by its budget duration, if the segment has a defined budget duration. Otherwise, the time the current part started, offset by the difference between expected durations of all parts in this segment and the as-played durations of the parts that already stopped.
   */
  projectedEndTime: number;
  /**
   * Countdown type within the segment. Default: `part_expected_duration`
   */
  countdownType?: AnonymousSchema_66;
  additionalProperties?: Record<string, any>;
}

/**
 * Countdown type within the segment. Default: `part_expected_duration`
 */
enum AnonymousSchema_66 {
  PART_EXPECTED_DURATION = "part_expected_duration",
  SEGMENT_BUDGET_DURATION = "segment_budget_duration",
}

interface AnonymousSchema_39 {
  /**
   * Unique id of the part
   */
  id: string;
  /**
   * User name of the part
   */
  reservedName: string;
  /**
   * Unique id of the segment this part belongs to
   */
  segmentId: string;
  /**
   * If this part will progress to the next automatically
   */
  autoNext?: boolean;
  /**
   * All pieces in this part
   */
  pieces: AnonymousSchema_45[];
  /**
   * Optional arbitrary data
   */
  publicData?: any;
  additionalProperties?: Record<string, any>;
}

/**
 * Information about the current quickLoop, if any
 */
interface AnonymousSchema_70 {
  /**
   * Whether the user is allowed to make alterations to the Start/End markers
   */
  locked: boolean;
  /**
   * Whether the loop has two valid markers and is currently running
   */
  running: boolean;
  start?: AnonymousSchema_73;
  end?: AnonymousSchema_73;
  additionalProperties?: Record<string, any>;
}

interface AnonymousSchema_73 {
  /**
   * The type of entity the marker is locked to
   */
  markerType: AnonymousSchema_74;
  /**
   * The rundown that this marker references. This will be set for rundown, segment and part markers
   */
  rundownId?: string;
  /**
   * The segment that this marker references. This will be set for segment and part markers
   */
  segmentId?: string;
  /**
   * The part that this marker references. This will be set for only part markers
   */
  partId?: string;
  additionalProperties?: Record<string, any>;
}

/**
 * The type of entity the marker is locked to
 */
enum AnonymousSchema_74 {
  PLAYLIST = "playlist",
  RUNDOWN = "rundown",
  SEGMENT = "segment",
  PART = "part",
}

/**
 * Timing information about the active playlist
 */
interface AnonymousSchema_78 {
  /**
   * Timing mode for the playlist.
   */
  timingMode: AnonymousSchema_79;
  /**
   * Unix timestamp of when the playlist started (milliseconds)
   */
  startedPlayback?: number;
  /**
   * Unix timestamp of when the playlist is expected to start (milliseconds). Required when the timingMode is set to forward-time.
   */
  expectedStart?: number;
  /**
   * Duration of the playlist in ms
   */
  expectedDuration?: number;
  /**
   * Unix timestamp of when the playlist is expected to end (milliseconds) Required when the timingMode is set to back-time.
   */
  expectedEnd?: number;
}

/**
 * Timing mode for the playlist.
 */
enum AnonymousSchema_79 {
  NONE = "none",
  FORWARD_MINUS_TIME = "forward-time",
  BACK_MINUS_TIME = "back-time",
}

interface AnonymousSchema_84 {
  reservedEvent: 'activePieces';
  /**
   * Unique id of the rundown playlist, or null if no playlist is active
   */
  rundownPlaylistId: string | null;
  /**
   * Pieces that are currently active (on air)
   */
  activePieces: AnonymousSchema_45[];
}

interface AnonymousSchema_90 {
  reservedEvent: 'segments';
  /**
   * Unique id of the rundown playlist, or null if no playlist is active
   */
  rundownPlaylistId: string | null;
  /**
   * The segments that are in the currently active rundown playlist, in order
   */
  segments: AnonymousSchema_96[];
}

interface AnonymousSchema_96 {
  /**
   * Unique id of the segment
   */
  id: string;
  /**
   * User-facing identifier that can be used to identify the contents of a segment in the Rundown source system
   */
  identifier?: string;
  /**
   * Unique id of the rundown this segment belongs to
   */
  rundownId: string;
  /**
   * Name of the segment
   */
  reservedName: string;
  timing: AnonymousSchema_101;
  /**
   * Optional arbitrary data
   */
  publicData?: any;
}

interface AnonymousSchema_101 {
  /**
   * Expected duration of the segment (milliseconds)
   */
  expectedDurationMs: number;
  /**
   * Budget duration of the segment (milliseconds)
   */
  budgetDurationMs?: number;
  /**
   * Countdown type within the segment. Default: `part_expected_duration`
   */
  countdownType?: AnonymousSchema_104;
  additionalProperties?: Record<string, any>;
}

/**
 * Countdown type within the segment. Default: `part_expected_duration`
 */
enum AnonymousSchema_104 {
  PART_EXPECTED_DURATION = "part_expected_duration",
  SEGMENT_BUDGET_DURATION = "segment_budget_duration",
}

interface AnonymousSchema_106 {
  reservedEvent: 'adLibs';
  /**
   * Unique id of the rundown playlist, or null if no playlist is active
   */
  rundownPlaylistId: string | null;
  /**
   * The available AdLibs for this playlist
   */
  adLibs: AnonymousSchema_112[];
  /**
   * The available Global AdLibs for this playlist
   */
  globalAdLibs: AnonymousSchema_113[];
}

interface AnonymousSchema_112 {
  /**
   * Unique id of the AdLib
   */
  id: string;
  /**
   * The user defined AdLib name
   */
  reservedName: string;
  /**
   * The source layer name for this AdLib
   */
  sourceLayer: string;
  /**
   * The output layer name for this AdLib
   */
  outputLayer?: string;
  /**
   * The available action type names that can be used to modify the execution of the AdLib
   */
  actionType: AnonymousSchema_119[];
  /**
   * Tags attached to this AdLib
   */
  tags?: string[];
  /**
   * Optional arbitrary data
   */
  publicData?: any;
  /**
   * Unique id of the segment this adLib belongs to
   */
  segmentId: any;
  /**
   * Unique id of the part this adLib belongs to
   */
  partId: any;
  additionalProperties?: Record<string, any>;
}

interface AnonymousSchema_119 {
  /**
   * The string to be passed to the ExecuteAdlib function
   */
  reservedName: string;
  /**
   * The label for the AdLib type
   */
  label: string;
}

interface AnonymousSchema_113 {
  /**
   * Unique id of the AdLib
   */
  id: string;
  /**
   * The user defined AdLib name
   */
  reservedName: string;
  /**
   * The source layer name for this AdLib
   */
  sourceLayer: string;
  /**
   * The output layer name for this AdLib
   */
  outputLayer?: string;
  /**
   * The available action type names that can be used to modify the execution of the AdLib
   */
  actionType: AnonymousSchema_119[];
  /**
   * Tags attached to this AdLib
   */
  tags?: string[];
  /**
   * Optional arbitrary data
   */
  publicData?: any;
  additionalProperties?: Record<string, any>;
}

export {Slash, AnonymousSchema_11, AnonymousSchema_13, AnonymousSchema_16, AnonymousSchema_20, AnonymousSchema_7, AnonymousSchema_21, AnonymousSchema_18, AnonymousSchema_22, AnonymousSchema_27, AnonymousSchema_30, AnonymousSchema_31, AnonymousSchema_38, AnonymousSchema_45, AnonymousSchema_55, AnonymousSchema_60, AnonymousSchema_62, AnonymousSchema_66, AnonymousSchema_39, AnonymousSchema_70, AnonymousSchema_73, AnonymousSchema_74, AnonymousSchema_78, AnonymousSchema_79, AnonymousSchema_84, AnonymousSchema_90, AnonymousSchema_96, AnonymousSchema_101, AnonymousSchema_104, AnonymousSchema_106, AnonymousSchema_112, AnonymousSchema_119, AnonymousSchema_113};