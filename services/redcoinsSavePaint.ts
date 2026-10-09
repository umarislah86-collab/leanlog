/** Let React commit the modal close and give native UI a frame before ledger work. */
export function afterRedCoinsPaint(): Promise<void> {
  return new Promise(resolve => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(fallback);
      resolve();
    };
    // Frames may pause when the user backgrounds the app just after Save.
    // Do not strand the pending write/lock waiting for a visible screen.
    const fallback = setTimeout(finish, 100);
    requestAnimationFrame(() => { if (!finished) requestAnimationFrame(finish); });
  });
}
