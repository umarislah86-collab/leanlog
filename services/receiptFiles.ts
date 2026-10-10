/** Backup stores metadata only; originals live on the phone and in the chosen folder. */
export interface RedCoinsReceipt {
  id: string; originalName: string; mimeType: string; size: number; createdAt: string;
  localUri?: string; localFileName?: string; md5?: string;
  status: 'pending' | 'saved' | 'failed';
  savedUri?: string; savedFolderUri?: string; savedName?: string; error?: string;
}
export function receiptFileName(entry: { id: string; item: string; amount: number; date: string }, receipt: RedCoinsReceipt) {
  const date = new Date(entry.date);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid transaction date.');
  const day = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const safe = (value: string) => value.replace(/[\x00-\x1f<>:"/\\|?*]/g, '_').trim().slice(0,65) || 'receipt';
  const extension = receipt.localFileName?.split('.').pop() || 'pdf';
  return `${day}_${safe(entry.item)}_RM${entry.amount.toFixed(2)}_${safe(entry.id)}_${safe(receipt.id)}.${extension}`;
}
