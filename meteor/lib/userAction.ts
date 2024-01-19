export enum UserAction {
	SAVE_EVALUATION,
	ACTIVATE_RUNDOWN_PLAYLIST,
	DEACTIVATE_RUNDOWN_PLAYLIST,
	CREATE_SNAPSHOT_FOR_DEBUG,
	REMOVE_RUNDOWN_PLAYLIST,
	REMOVE_RUNDOWN,
	RESYNC_RUNDOWN,
	RESYNC_RUNDOWN_PLAYLIST,
	DISABLE_NEXT_PIECE,
	TAKE,
	MOVE_NEXT,
	ACTIVATE_HOLD,
	DEACTIVATE_OTHER_RUNDOWN_PLAYLIST,
	RESET_AND_ACTIVATE_RUNDOWN_PLAYLIST,
	PREPARE_FOR_BROADCAST,
	RESET_RUNDOWN_PLAYLIST,
	RELOAD_RUNDOWN_PLAYLIST_DATA,
	SET_NEXT,
	SET_NEXT_SEGMENT,
	TAKE_PIECE,
	UNSYNC_RUNDOWN,
	SET_IN_OUT_POINTS,
	START_ADLIB,
	START_GLOBAL_ADLIB,
	START_STICKY_PIECE,
	START_BUCKET_ADLIB,
	CLEAR_SOURCELAYER,
	RESTART_MEDIA_WORKFLOW,
	ABORT_MEDIA_WORKFLOW,
	PRIORITIZE_MEDIA_WORKFLOW,
	ABORT_ALL_MEDIA_WORKFLOWS,
	PACKAGE_MANAGER_RESTART_WORK,
	PACKAGE_MANAGER_RESTART_PACKAGE_CONTAINER,
	GENERATE_RESTART_TOKEN,
	RESTART_CORE,
	USER_LOG_PLAYER_METHOD,
	UNKNOWN_ACTION,
	CREATE_BUCKET,
	REMOVE_BUCKET,
	MODIFY_BUCKET,
	EMPTY_BUCKET,
	INGEST_BUCKET_ADLIB,
	REMOVE_BUCKET_ADLIB,
	MODIFY_BUCKET_ADLIB,
	SWITCH_ROUTE_SET,
	SAVE_TO_BUCKET,
	RUNDOWN_ORDER_MOVE,
	RUNDOWN_ORDER_RESET,
	PERIPHERAL_DEVICE_REFRESH_DEBUG_STATES,
	ACTIVATE_SCRATCHPAD,
	QUEUE_NEXT_SEGMENT,
	SET_QUICK_LOOP_START,
	SET_QUICK_LOOP_END,
}
