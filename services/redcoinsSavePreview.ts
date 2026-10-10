/** Publish the ledger before disk work; a failed write must undo the preview. */
export async function commitRedCoinsPreview(actions: {
  preview: () => void;
  yieldToUI: () => Promise<void>;
  write: () => Promise<void>;
  rollback: () => Promise<void>;
}): Promise<void> {
  actions.preview();
  try {
    await actions.yieldToUI();
    await actions.write();
  } catch (error) {
    await actions.rollback();
    throw error;
  }
}
