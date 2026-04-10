/**
 * Floating tab bar metrics — keep in sync with `app/(tabs)/_layout.tsx` `tabBarStyle`.
 * Used so tab screens can pad content above the overlaid bar + home indicator.
 */
export const FLOATING_TAB_BAR_BOTTOM = 20;
export const FLOATING_TAB_BAR_HEIGHT = 78;

/** Distance from the physical bottom of the screen to the top edge of the tab bar pill. */
export const FLOATING_TAB_BAR_TOP_FROM_BOTTOM = FLOATING_TAB_BAR_BOTTOM + FLOATING_TAB_BAR_HEIGHT;
