import React, { createContext, forwardRef, useContext } from 'react';
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput, type TextProps, type TextInputProps } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SurfaceContext } from '../context/SurfaceContext';
import { contrastText, solidColour } from '../services/textContrast';
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
  const surface = useContext(SurfaceContext);
  const previewId = useContext(PreviewTypography);
  const { typographyRole, ...nativeProps } = props;
  const style = StyleSheet.flatten(props.style) ?? {};
  const hasOwnType = typographyRole || style.fontFamily || style.fontWeight || style.fontSize;
  const numericText = typeof props.children === 'string' && /^\s*[+−–-]?\s*(?:RM\s*)?\d[\d,.\s]*(?:%|kg|kcal)?\s*$/.test(props.children);
  const font = fontsLoaded && (!nested || hasOwnType) ? themeFont(previewId ?? palette.id, style, typographyRole ?? (numericText ? 'number' : undefined)) : {};
  const background = solidColour(style.backgroundColor, surface ?? palette.canvas) ?? surface;
  const ink = palette.id !== 'cream' && !previewId && background && (!nested || style.color) ? contrastText(style.color ?? palette.text, background) : undefined;
  return <NativeText {...nativeProps} ref={ref} style={[!nested && { color: palette.text }, props.style, ink && { color: ink }, font]}><SurfaceContext.Provider value={background ?? surface}><NestedText.Provider value={true}>{props.children}</NestedText.Provider></SurfaceContext.Provider></NativeText>;
});
ThemeText.displayName = 'ThemeText';
export type ThemeTextInput = NativeTextInput;
export const ThemeTextInput = forwardRef<NativeTextInput, TextInputProps>((props, ref) => {
  const { palette, fontsLoaded } = useTheme();
  const parent = useContext(SurfaceContext) ?? palette.canvas;
  const inputStyle = StyleSheet.flatten(props.style) ?? {};
  const background = solidColour(inputStyle.backgroundColor, parent) ?? parent;
  const ink = palette.id === 'cream' ? undefined : contrastText(inputStyle.color ?? palette.text, background);
  const placeholder = palette.id === 'cream' ? props.placeholderTextColor ?? palette.muted : contrastText(props.placeholderTextColor ?? palette.muted, background);
  const numeric = ['numeric', 'decimal-pad', 'number-pad'].includes(props.keyboardType ?? '') || props.inputMode === 'decimal' || props.inputMode === 'numeric';
  const font = fontsLoaded ? themeFont(palette.id, StyleSheet.flatten(props.style) ?? {}, numeric ? 'number' : 'body') : {};
  return <NativeTextInput keyboardAppearance={palette.dark ? 'dark' : 'light'} selectionColor={palette.accent} {...props} placeholderTextColor={placeholder} ref={ref} style={[{ color: palette.text }, props.style, ink && { color: ink }, font]} />;
});
ThemeTextInput.displayName = 'ThemeTextInput';
