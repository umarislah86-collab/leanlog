import React, { memo } from 'react';

type Props = {
  snapshot: Readonly<Record<string, unknown>>;
  renderContent: () => React.ReactNode;
};

// Form drafts/visibility do not change a page. Compare the explicit page inputs
// rather than the render closure, which the screen recreates on each keystroke.
export function sameRedCoinsPageInputs(previous: Props, next: Props) {
  const keys = Object.keys(previous.snapshot);
  return keys.length === Object.keys(next.snapshot).length
    && keys.every(key => Object.prototype.hasOwnProperty.call(next.snapshot, key)
      && Object.is(previous.snapshot[key], next.snapshot[key]));
}

export const RedCoinsPageContent = memo(function RedCoinsPageContent({ renderContent }: Props) {
  return renderContent();
}, sameRedCoinsPageInputs);
