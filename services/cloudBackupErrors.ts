// Error context only: never attach the stored payload or credentials.
export function backupWriteError(error: unknown, key: string, value: string) {
  const original = error as { code?: string; message?: string };
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0)!;
    bytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  }
  return Object.assign(new Error(original?.message || 'Cloud backup write failed.'), {
    code: original?.code || 'unknown', backupKey: key, backupBytes: bytes,
  });
}

export function cloudBackupFailure(error: unknown, malay: boolean): string {
  const e = error as { code?: string; message?: string; backupKey?: string; backupBytes?: number };
  const code = e?.code?.replace(/^firestore\//, '') || 'unknown';
  let reason: string;
  if (code === 'permission-denied') reason = malay ? 'Firebase menolak akses. Semak akaun dan rules cloud.' : 'Firebase denied access. Check the signed-in account and cloud rules.';
  else if (code === 'unauthenticated' || /Sign in before/.test(e?.message || '')) reason = malay ? 'Log masuk semula sebelum backup.' : 'Sign in again before backing up.';
  else if (code === 'resource-exhausted') reason = malay ? 'Kuota Firebase atau had resource telah dicapai.' : 'Firebase quota or resource limits were reached.';
  else if (/maximum.*(size|bytes)|too large|exceeds.*(size|bytes)|1048576/i.test(e?.message || '') || (code === 'invalid-argument' && (e.backupBytes || 0) > 1040000)) reason = malay ? 'Data terlalu besar untuk satu dokumen Firestore (had 1MiB). Format backup perlu dipecahkan.' : 'Data is too large for one Firestore document (1MiB limit). The backup format needs chunking.';
  else if (code === 'unavailable' || code === 'deadline-exceeded') reason = malay ? 'Sambungan ke Firebase tidak tersedia atau timeout. Cuba semula.' : 'Firebase is unavailable or the connection timed out. Retry.';
  else reason = e?.message || (malay ? 'Backup gagal; punca tidak diketahui.' : 'Backup failed; cause unknown.');
  const context = e?.backupKey ? `\n${e.backupKey} · ${((e.backupBytes || 0) / 1048576).toFixed(2)} MiB` : '';
  return `❌ ${reason}\n[${code}]${context}`;
}
