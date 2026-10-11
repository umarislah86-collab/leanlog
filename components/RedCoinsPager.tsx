import React, { useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { redcoinsSections, redcoinsPageTarget } from '../services/redcoinsSwipe';

type Section = typeof redcoinsSections[number];
export type RedCoinsPagerHandle = { showSection: (section: Section) => void };
export function RedCoinsPager({ section, enabled, onSection, onPreview, onExit, renderSection, pagerControlRef }: {
  section: Section;
  enabled: boolean;
  onSection: (section: Section) => void;
  onPreview: (section: Section) => void;
  onExit: (route: 'Coach' | 'Settings') => void;
  renderSection: (section: Section) => React.ReactNode;
  pagerControlRef: React.Ref<RedCoinsPagerHandle>;
}) {
  const pager = useRef<PagerView>(null);
  const initialPosition = useRef(redcoinsSections.indexOf(section) + 1).current;
  const nativePosition = useRef(initialPosition);
  const requestedPosition = useRef<number | null>(null);
  useImperativeHandle(pagerControlRef, () => ({
    showSection(next) {
      const position = redcoinsSections.indexOf(next) + 1;
      if (nativePosition.current === position) return;
      nativePosition.current = position;
      requestedPosition.current = position;
      // Issue native navigation in the tap/Back/deep-link handler, before the
      // heavy screen render. Delayed React commits must never move it back.
      pager.current?.setPageWithoutAnimation(position);
    },
  }), []);
  return <PagerView
    ref={pager}
    testID="redcoins-section-pager"
    style={{ flex: 1 }}
    initialPage={initialPosition}
    scrollEnabled={enabled}
    keyboardDismissMode="on-drag"
    offscreenPageLimit={1}
    onPageScrollStateChanged={({ nativeEvent }) => {
      if (nativeEvent.pageScrollState === 'dragging') requestedPosition.current = null;
    }}
    onPageScroll={({ nativeEvent }) => {
      if (requestedPosition.current !== null) return;
      const position = Math.max(1, Math.min(5, Math.round(nativeEvent.position + nativeEvent.offset)));
      onPreview(redcoinsSections[position - 1]);
    }}
    onPageSelected={({ nativeEvent }) => {
      const position = nativeEvent.position;
      // Ignore callbacks from older rapid taps until the latest command lands.
      if (requestedPosition.current !== null) {
        if (requestedPosition.current === position) requestedPosition.current = null;
        return;
      }
      const target = redcoinsPageTarget(position);
      if (!target) return;
      if ('route' in target) {
        const edge = target.route === 'Coach' ? 1 : 5;
        nativePosition.current = edge;
        pager.current?.setPageWithoutAnimation(edge);
        onPreview(redcoinsSections[edge - 1]);
        onExit(target.route);
      } else {
        onPreview(target.section);
        if (nativePosition.current === position) return;
        nativePosition.current = position;
        onSection(target.section);
      }
    }}
  >
    <View key="exit-coach" collapsable={false} style={{ flex: 1 }} />
    {redcoinsSections.map(name => <View key={name} collapsable={false} style={{ flex: 1 }}>
      {renderSection(name)}
    </View>)}
    <View key="exit-settings" collapsable={false} style={{ flex: 1 }} />
  </PagerView>;
}
