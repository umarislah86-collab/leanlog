type Change = { kind: 'state' | 'guards'; source?: object };
const listeners = new Set<(change: Change) => void>();
export function subscribeRedCoinsChanges(listener: (change: Change) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function emitRedCoinsChange(kind: Change['kind'], source?: object) {
  listeners.forEach((listener) => {
    try { listener({ kind, source }); } catch (error) { console.warn('RedCoins listener failed', error); }
  });
}
