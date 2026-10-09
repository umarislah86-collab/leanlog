import React, { createContext, forwardRef, useContext } from 'react';
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput, type TextProps, type TextInputProps } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { themeFont, type AppThemeId, type TypographyRole } from '../services/appTheme';
export type ThemeText = NativeText;
const NestedText = createContext(false);
const PreviewTypography = createContext<AppThemeId | null>(null);
export function ThemeTypographyPreview({ id, children }: { id: AppThemeId; children: React.ReactNode }) {
  return <PreviewTypography.Provider value={id}>{children}</PreviewTypography.Provider>;
}
export const ThemeText = forwardRef<NativeText, TextProps & { typographyRole?: TypographyRole }>((props, ref) => {
  const { palette, fontsLoaded } = useTheme();
  const nested = useContext(NestedText);
  const previewId = useContext(PreviewTypography);
  const { typographyRole, ...nativeProps } = props;
  const style = StyleSheet.flatten(props.style) ?? {};
  const hasOwnType = typographyRole || style.fontFamily || style.fontWeight || style.fontSize;
  const numericText = typeof props.children === 'string' && /^\s*[+−–-]?\s*(?:RM\s*)?\d[\d,.\s]*(?:%|kg|kcal)?\s*$/.test(props.children);
  const font = fontsLoaded && (!nested || hasOwnType) ? themeFont(previewId ?? palette.id, style, typographyRole ?? (numericText ? 'number' : undefined)) : {};
  return <NativeText {...nativeProps} ref={ref} style={[!nested && { color: palette.text }, props.style, font]}><NestedText.Provider value={true}>{props.children}</NestedText.Provider></NativeText>;
});
ThemeText.displayName = 'ThemeText';
export type ThemeTextInput = NativeTextInput;
export const ThemeTextInput = forwardRef<NativeTextInput, TextInputProps>((props, ref) => {
  const { palette, fontsLoaded } = useTheme();
  const numeric = ['numeric', 'decimal-pad', 'number-pad'].includes(props.keyboardType ?? '') || props.inputMode === 'decimal' || props.inputMode === 'numeric';
  const font = fontsLoaded ? themeFont(palette.id, StyleSheet.flatten(props.style) ?? {}, numeric ? 'number' : 'body') : {};
  return <NativeTextInput placeholderTextColor={palette.muted} keyboardAppearance={palette.dark ? 'dark' : 'light'} selectionColor={palette.accent} {...props} ref={ref} style={[{ color: palette.text }, props.style, font]} />;
});
ThemeTextInput.displayName = 'ThemeTextInput';
