import { SomeObjectOverrideOp, ObjectWithOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useRef, useMemo, useEffect } from 'react'
import {
	getAllCurrentAndDeletedItemsFromOverrides,
	getAllCurrentItemsFromOverrides,
	WrappedOverridableItem,
	WrappedOverridableItemDeleted,
	WrappedOverridableItemNormal,
	OverrideOpHelper,
	OverrideOpHelperImpl,
	OverrideOpHelperForItemContents,
} from '@sofie-automation/corelib/dist/overrideOpHelperBackend'
export {
	getAllCurrentAndDeletedItemsFromOverrides,
	getAllCurrentItemsFromOverrides,
	WrappedOverridableItem,
	WrappedOverridableItemDeleted,
	WrappedOverridableItemNormal,
	OverrideOpHelper,
	OverrideOpHelperForItemContents,
}

/**
 * A helper to work with modifying an ObjectWithOverrides<T>
 */
export function useOverrideOpHelper<T extends object>(
	saveOverrides: (newOps: SomeObjectOverrideOp[]) => void,
	objectWithOverrides: ObjectWithOverrides<T>
): OverrideOpHelper {
	const objectWithOverridesRef = useRef(objectWithOverrides)

	const helper = useMemo(
		() => new OverrideOpHelperImpl(saveOverrides, objectWithOverridesRef.current),
		[saveOverrides, objectWithOverridesRef]
	)

	// Use a ref to minimise reactivity when it changes
	useEffect(() => {
		objectWithOverridesRef.current = objectWithOverrides
	}, [objectWithOverrides])

	return helper
}
