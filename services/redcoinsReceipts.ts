import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { loadRedCoins, saveRedCoins } from './redcoins';
import { receiptFileName, type RedCoinsReceipt } from './receiptFiles';

const FOLDER_KEY = 'redcoins_receipt_folder_v1';
const MAX_BYTES = 20 * 1024 * 1024;
const extensions: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'image/gif': 'gif', 'image/tiff': 'tiff', 'image/bmp': 'bmp' };
const directory = () => {
  if (!FileSystem.documentDirectory) throw new Error('Receipt storage is unavailable on this device.');
  return `${FileSystem.documentDirectory}redcoins-receipts/`;
};
/** Never trust arbitrary file URIs from a restored/imported JSON backup. */
export function receiptLocalUri(receipt: RedCoinsReceipt) {
  if (!receipt.localFileName || !/^[\w-]{8,160}\.(pdf|jpg|png|webp|heic|heif|gif|tiff|bmp)$/.test(receipt.localFileName) || !receipt.localFileName.startsWith(`${receipt.id}.`)) return undefined;
  return `${directory()}${receipt.localFileName}`;
}
/** Only call for unsaved drafts; persisted originals are deliberately retained. */
export async function discardReceiptDrafts(drafts: RedCoinsReceipt[]) {
  for (const receipt of drafts) {
    if (receipt.savedUri || receipt.status !== 'pending') continue;
    const uri = receiptLocalUri(receipt);
    if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
export async function stageRedCoinsReceipt(uri: string, originalName: string, suppliedType?: string): Promise<RedCoinsReceipt> {
  const suffix = originalName.split('.').pop()?.toLowerCase();
  const mimeType = suppliedType && extensions[suppliedType] ? suppliedType : Object.keys(extensions).find(type => extensions[type] === (suffix === 'jpeg' ? 'jpg' : suffix));
  if (!mimeType) throw new Error('Choose a receipt photo or PDF.');
  const info = await FileSystem.getInfoAsync(uri, { md5: true });
  if (!info.exists || info.isDirectory || !info.size) throw new Error('The receipt file is empty or unavailable.');
  if (info.size > MAX_BYTES) throw new Error('Choose a receipt smaller than 20 MB.');
  const id = `rc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 8)}`;
  const localFileName = `${id}.${extensions[mimeType]}`;
  await FileSystem.makeDirectoryAsync(directory(), { intermediates: true });
  const target = `${directory()}${localFileName}`;
  try {
    await FileSystem.copyAsync({ from: uri, to: target });
    const copied = await FileSystem.getInfoAsync(target, { md5: true });
    if (!copied.exists || copied.isDirectory || copied.size !== info.size || !copied.md5 || copied.md5 !== info.md5) throw new Error('The original receipt could not be saved completely. Please choose it again.');
    return { id, originalName, mimeType, size: copied.size, md5: copied.md5, localFileName, createdAt: new Date().toISOString(), status: 'pending' };
  } catch (error) {
    await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});
    throw error;
  }
}
export interface ReceiptFolder { folderUri: string }
export async function savedReceiptFolder(): Promise<ReceiptFolder | null> {
  const raw = await AsyncStorage.getItem(FOLDER_KEY);
  try { const folder = raw ? JSON.parse(raw) : null; return typeof folder?.folderUri === 'string' && folder.folderUri.startsWith('content://') ? folder : null; } catch { return null; }
}
export async function chooseReceiptFolder() {
  if (Platform.OS !== 'android') throw new Error('Receipt folders are currently Android-only.');
  const previous = await savedReceiptFolder();
  const access = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(previous?.folderUri);
  if (!access.granted) return null;
  const folder = { folderUri: access.directoryUri };
  await AsyncStorage.setItem(FOLDER_KEY, JSON.stringify(folder));
  return folder;
}
export async function clearReceiptFolder() { await AsyncStorage.removeItem(FOLDER_KEY); }

/** Update only one receipt on the newest version, preserving financial edits. */
export async function updateRedCoinsReceipt(entryId: string, receipt: RedCoinsReceipt) {
  const { localUri: _temporaryUri, ...durable } = receipt;
  for (let attempt = 0; attempt < 3; attempt++) {
    const state = await loadRedCoins();
    const entry = state.entries.find(row => row.id === entryId);
    if (!entry) throw new Error('This transaction was removed. The receipt original is retained.');
    const existing = entry.receipts || [];
    if (!existing.some(row => row.id === receipt.id)) throw new Error('This receipt is no longer attached to the transaction.');
    const next = { ...state, entries: state.entries.map(row => row.id === entryId ? { ...row, receipts: existing.map(value => value.id === receipt.id ? durable : value) } : row) };
    try { await saveRedCoins(next, undefined, [entryId]); return durable; }
    catch (error) {
      const message = (error as { message?: unknown })?.message;
      if (attempt === 2 || typeof message !== 'string' || !/changed|stale|revision/i.test(message)) throw error;
    }
  }
  throw new Error('Receipt changed. Please retry.');
}
const copies = new Set<string>();
export async function saveReceiptToFolder(entryId: string, receiptId: string) {
  const key = `${entryId}:${receiptId}`;
  if (copies.has(key)) throw new Error('This receipt is already being saved.');
  copies.add(key);
  let latest: RedCoinsReceipt | undefined;
  try {
    const state = await loadRedCoins();
    const entry = state.entries.find(row => row.id === entryId);
    latest = entry?.receipts?.find(row => row.id === receiptId);
    if (!entry || !latest) throw new Error('Save the transaction before saving its receipt to a folder.');
    if (latest.status === 'saved') return latest;
    const folder = await savedReceiptFolder();
    if (!folder) throw new Error('Choose a receipt folder first.');
    if (latest.savedFolderUri && latest.savedFolderUri !== folder.folderUri) throw new Error('Choose the original receipt folder to retry this copy.');
    const localUri = receiptLocalUri(latest);
    if (!localUri) throw new Error('The original is not on this phone. Add it again.');
    const info = await FileSystem.getInfoAsync(localUri, { md5: true });
    if (!info.exists || info.isDirectory || info.size !== latest.size || !latest.md5 || info.md5 !== latest.md5) throw new Error('The local original is missing or changed. Add it again.');
    // Only a current, user-granted folder may be written. Never trust a restored URI alone.
    const children = await FileSystem.StorageAccessFramework.readDirectoryAsync(folder.folderUri);
    const reservationKey = `redcoins_receipt_destination_v1:${entryId}:${receiptId}`;
    let reserved: { uri?: string; folder?: string } | null = null;
    try { reserved = JSON.parse(await AsyncStorage.getItem(reservationKey) || 'null'); } catch {}
    // A JSON restore cannot authorize overwriting another document, even inside this folder.
    if (latest.savedUri && (reserved?.uri !== latest.savedUri || reserved?.folder !== folder.folderUri || !children.includes(latest.savedUri))) {
      latest = await updateRedCoinsReceipt(entryId, { ...latest, savedUri: undefined, savedFolderUri: undefined, savedName: undefined });
    }
    const bytes = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    if (!latest.savedUri) {
      const savedName = receiptFileName(entry, latest);
      const savedUri = reserved?.folder === folder.folderUri && reserved.uri && children.includes(reserved.uri)
        ? reserved.uri : await FileSystem.StorageAccessFramework.createFileAsync(folder.folderUri, savedName, latest.mimeType);
      await AsyncStorage.setItem(reservationKey, JSON.stringify({ uri: savedUri, folder: folder.folderUri }));
      // Persist destination before writing so retries reuse the same file.
      latest = await updateRedCoinsReceipt(entryId, { ...latest, savedUri, savedName, savedFolderUri: folder.folderUri });
    }
    let verified = false;
    try { verified = await FileSystem.readAsStringAsync(latest.savedUri!, { encoding: FileSystem.EncodingType.Base64 }) === bytes; } catch {}
    if (!verified) {
      await FileSystem.writeAsStringAsync(latest.savedUri!, bytes, { encoding: FileSystem.EncodingType.Base64 });
      if (await FileSystem.readAsStringAsync(latest.savedUri!, { encoding: FileSystem.EncodingType.Base64 }) !== bytes) throw new Error('Receipt copy verification failed. Your local original is kept; retry saving.');
    }
    return await updateRedCoinsReceipt(entryId, { ...latest, status: 'saved', error: undefined });
  } catch (error) {
    if (latest) {
      try { await updateRedCoinsReceipt(entryId, { ...latest, status: 'failed', error: error instanceof Error ? error.message : 'Could not save receipt. Retry.' }); } catch {}
    }
    throw error;
  } finally { copies.delete(key); }
}
