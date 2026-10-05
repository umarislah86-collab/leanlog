type Change = { kind: 'state' | 'guards' };
const listeners = new Set<(change: Change) => void>();
export function subscribeRedCoinsChanges(listener: (change: Change) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function emitRedCoinsChange(kind: Change['kind']) {
  listeners.forEach((listener) => {
    try { listener({ kind }); } catch (error) { console.warn('RedCoins listener failed', error); }
  });
}
