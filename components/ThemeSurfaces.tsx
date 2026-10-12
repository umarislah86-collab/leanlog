import React, { forwardRef, useContext } from 'react';
import { View, TouchableOpacity, Pressable, ScrollView, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SurfaceContext } from '../context/SurfaceContext';
import { useTheme } from '../context/ThemeContext';
import { solidColour } from '../services/textContrast';
function useSurfaceParent() {
  const { palette } = useTheme();
  return useContext(SurfaceContext) ?? palette.canvas;
}
/** Same native component, props/ref and geometry; provide its painted background to text. */
function surface<T extends React.ElementType>(Native: T, name: string) {
  const Wrapped = forwardRef<any, React.ComponentPropsWithoutRef<T>>((props: any, ref) => {
    const parent = useSurfaceParent();
    const content = (style: any, children: React.ReactNode) => {
      const own = solidColour(StyleSheet.flatten(style)?.backgroundColor, parent) ?? parent;
      return <SurfaceContext.Provider value={own}>{children}</SurfaceContext.Provider>;
    };
    // Pressable's state callbacks must keep their native pressed/hovered semantics.
    if ((Native as React.ElementType) === Pressable) return <Pressable {...props} ref={ref}>{(state: any) => content(typeof props.style === 'function' ? props.style(state) : props.style, typeof props.children === 'function' ? props.children(state) : props.children)}</Pressable>;
    return <Native {...props} ref={ref}>{content((Native as React.ElementType) === ScrollView ? [props.style, props.contentContainerStyle] : props.style, props.children)}</Native>;
  });
  Wrapped.displayName = name;
  return Wrapped;
}
export const ThemeView = surface(View, 'ThemeView');
export const ThemeTouchableOpacity = surface(TouchableOpacity, 'ThemeTouchableOpacity');
export const ThemePressable = surface(Pressable, 'ThemePressable');
export const ThemeScrollView = surface(ScrollView, 'ThemeScrollView');
export const ThemeSafeAreaView = surface(SafeAreaView, 'ThemeSafeAreaView');

export const ThemeAnimatedView = surface(Animated.View, 'ThemeAnimatedView');
