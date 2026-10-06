import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { FlatList, View, useWindowDimensions } from 'react-native';
import type { RedCoinsEntry } from '../services/redcoins';
import { buildLedgerLayout, captureLedgerAnchor, restoreLedgerAnchor, type LedgerCell } from '../services/redcoinsLedgerLayout';

export function RedCoinsLedgerList({ entries, filterKey, extraData, renderEntry, renderDay, empty, contentStyle, emptyStyle }: {
  entries: RedCoinsEntry[]; filterKey: string; extraData: unknown;
  renderEntry: (entry: RedCoinsEntry) => React.ReactElement;
  renderDay: (day: Extract<LedgerCell, { kind: 'day' }>) => React.ReactElement;
  empty: React.ReactElement; contentStyle: object; emptyStyle: object;
}) {
  const { fontScale } = useWindowDimensions();
  const layout = useMemo(() => buildLedgerLayout(entries, fontScale), [entries, fontScale]);
  const list = useRef<FlatList<LedgerCell>>(null);
  const scrollOffset = useRef(0);
  const pendingOffset = useRef<number | null>(null);
  const previous = useRef({ cells: layout.cells, filterKey });
  useLayoutEffect(() => {
    const old = previous.current;
    const reset = old.filterKey !== filterKey;
    const target = reset ? 0 : restoreLedgerAnchor(captureLedgerAnchor(old.cells, scrollOffset.current), old.cells, layout.cells);
    previous.current = { cells: layout.cells, filterKey };
    if (reset || Math.abs(target - scrollOffset.current) > .5) {
      scrollOffset.current = target;
      pendingOffset.current = target;
      list.current?.scrollToOffset({ offset: target, animated: false });
    }
  }, [layout, filterKey]);
  return <FlatList
    ref={list}
    data={layout.cells}
    keyExtractor={cell => cell.key}
    renderItem={({ item }) => <View style={{ height: item.length }}>{item.kind === 'day' ? renderDay(item) : renderEntry(item.entry)}</View>}
    getItemLayout={(_, index) => ({ index, length: layout.cells[index].length, offset: layout.cells[index].offset })}
    stickyHeaderIndices={layout.stickyIndices}
    extraData={extraData}
    initialNumToRender={16}
    maxToRenderPerBatch={16}
    updateCellsBatchingPeriod={16}
    windowSize={11}
    removeClippedSubviews={false}
    onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
    scrollEventThrottle={16}
    onScrollBeginDrag={() => { pendingOffset.current = null; }}
    onContentSizeChange={() => {
      if (pendingOffset.current == null) return;
      const offset = pendingOffset.current; pendingOffset.current = null;
      scrollOffset.current = offset;
      list.current?.scrollToOffset({ offset, animated: false });
    }}
    keyboardShouldPersistTaps="always"
    keyboardDismissMode="on-drag"
    ListEmptyComponent={empty}
    showsVerticalScrollIndicator={false}
    contentContainerStyle={entries.length ? contentStyle : emptyStyle}
  />;
}
