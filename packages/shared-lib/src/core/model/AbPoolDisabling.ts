export interface StudioAbPoolDisabling {
	/** Whether the player is disabled in this pool */
	players: Record<string, StudioAbPlayerDisabling>
}

export interface StudioAbPlayerDisabling {
	/** Whether the player is disabled in this pool */
	disabled: boolean
}
