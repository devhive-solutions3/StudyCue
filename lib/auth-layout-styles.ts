import { StyleSheet } from 'react-native';

/** Narrow centered card on tablets / Expo web desktop; full-bleed on phones. */
export const authScreenLayoutStyles = StyleSheet.create({
  outer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /** Login + forgot-password; comfortably narrow on desktop web. */
  cardWrap: {
    width: '100%',
    maxWidth: 400,
  },
  /** Registration has more fields; slightly wider card on desktop. */
  cardWrapWide: {
    width: '100%',
    maxWidth: 440,
  },
});
