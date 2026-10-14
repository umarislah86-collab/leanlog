/** Bound UI waiting; SDK writes already submitted cannot be cancelled. */
export async function cloudDeadline<T>(work: (check: () => void) => Promise<T>, milliseconds = 60000, message = 'Cloud upload was not confirmed within 60 seconds. A submitted write may still be pending; this backup is not confirmed.'): Promise<T> {
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = Object.assign(new Error(message), { code: 'deadline-exceeded' });
  const check = () => { if (expired) throw timeout; };
  try {
    return await Promise.race([
      work(check),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { expired = true; reject(timeout); }, milliseconds); }),
    ]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
