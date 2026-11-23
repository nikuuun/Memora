import { Text as RNText, StyleSheet, TextInput as RNTextInput, type TextInputProps, type TextProps } from 'react-native';

import { fonts } from '../theme';

const BY_WEIGHT: Record<string, string> = {
  '400': fonts.regular,
  normal: fonts.regular,
  '500': fonts.medium,
  '600': fonts.semibold,
  '700': fonts.bold,
  bold: fonts.bold,
  '800': fonts.bold,
  '900': fonts.bold,
};

/**
 * Custom fonts ship one family per weight, so `fontWeight: '600'` alone would
 * fall back to the system font. This maps the weight to the matching DM Sans
 * face, unless the style already names a font (e.g. the Playfair headings).
 */
function withFont<S>(style: S) {
  const flat = StyleSheet.flatten(style as never) as { fontFamily?: string; fontWeight?: string | number } | undefined;
  if (flat?.fontFamily) return style;
  const family = BY_WEIGHT[String(flat?.fontWeight ?? '400')] ?? fonts.regular;
  return [style, { fontFamily: family, fontWeight: undefined }];
}

/** Drop-in for React Native's Text, in the Memora fonts. */
export function Text(props: TextProps) {
  return <RNText {...props} style={withFont(props.style)} />;
}

/** Drop-in for React Native's TextInput, in the Memora fonts. */
export function TextInput(props: TextInputProps) {
  return <RNTextInput {...props} style={withFont(props.style)} />;
}
