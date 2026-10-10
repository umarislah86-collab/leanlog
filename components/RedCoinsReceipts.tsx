import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { ThemeText as Text } from './ThemePrimitives';
import { useTheme } from '../context/ThemeContext';
import type { RedCoinsEntry } from '../services/redcoins';
import type { RedCoinsReceipt } from '../services/receiptFiles';
import { chooseReceiptFolder, clearReceiptFolder, discardReceiptDrafts, receiptLocalUri, savedReceiptFolder, stageRedCoinsReceipt, saveReceiptToFolder, type ReceiptFolder } from '../services/redcoinsReceipts';

export function RedCoinsReceipts({ entry, drafts, onChange, onBusy, visible, disabled }: {
  entry?: RedCoinsEntry; drafts: RedCoinsReceipt[]; onChange: (receipts: RedCoinsReceipt[]) => void; onBusy: (busy: boolean) => void; visible: boolean; disabled?: boolean;
}) {
  const { palette } = useTheme();
  const [account, setAccount] = useState<ReceiptFolder | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    void savedReceiptFolder().then(value => { if (active) { setAccount(value); setLoadError(''); } }).catch(() => { if (active) setLoadError('Could not read the receipt folder. Choose it again.'); });
    return () => { active = false; };
  }, [visible]);
  async function perform(label: string, work: () => Promise<void>) {
    if (lock.current || disabled) return;
    lock.current = true;
    setBusy(label);
    onBusy(true);
    try { await work(); }
    catch (error) {
      if ((error as { code?: string })?.code !== 'RECEIPT_CANCELLED') Alert.alert('Receipt', error instanceof Error ? error.message : 'Could not complete this action. Please retry.');
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
      onBusy(false);
    }
  }
  async function choose(kind: 'camera' | 'photo' | 'file') {
    await perform('Preparing receipt…', async () => {
      let asset: { uri: string; name: string; mimeType?: string } | undefined;
      if (kind === 'file') {
        const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: false, copyToCacheDirectory: true });
        if (!result.canceled) asset = result.assets[0];
      } else {
        if (kind === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Allow camera access to photograph your receipt.');
        const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 1 };
        const result = kind === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
        if (!result.canceled) {
          const image = result.assets[0];
          asset = { uri: image.uri, name: image.fileName || `receipt.${image.mimeType === 'image/png' ? 'png' : 'jpg'}`, mimeType: image.mimeType || 'image/jpeg' };
        }
      }
      if (!asset) return;
      const receipt = await stageRedCoinsReceipt(asset.uri, asset.name, asset.mimeType);
      if (mounted.current) onChange([...drafts, receipt]);
    });
  }
  const button = (label: string, action: () => void, icon?: React.ComponentProps<typeof Ionicons>['name']) => <TouchableOpacity accessibilityRole="button" disabled={!!busy || disabled} onPress={action} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10, backgroundColor: palette.surfaceAlt, opacity: busy || disabled ? .5 : 1 }}>
    {icon && <Ionicons name={icon} size={15} color={palette.text} />}<Text style={{ fontSize: 12, fontWeight: '700', color: palette.text }}>{label}</Text>
  </TouchableOpacity>;
  const rows = [...(entry?.receipts || []), ...drafts];
  return <View style={{ padding: 12, gap: 9, marginTop: 8, borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.surface }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Ionicons name="receipt-outline" size={18} color={palette.text} /><Text style={{ flex: 1, color: palette.text, fontSize: 14, fontWeight: '800' }}>Receipts</Text></View>
    <Text style={{ color: palette.muted, fontSize: 11 }}>{account ? `Folder selected · ${account.folderUri.split("/").pop() || "Receipts"}` : 'Choose a folder for receipt originals. No sign-in required.'}</Text>
    {!!loadError && <Text style={{ color: palette.expense, fontSize: 11 }}>{loadError}</Text>}
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {button(account ? 'Change folder' : 'Choose folder', () => { void perform('Choosing folder…', async () => { const value = await chooseReceiptFolder(); if (value && mounted.current) { setAccount(value); setLoadError(''); } }); }, 'folder-outline')}
      {account && button('Clear folder', () => { void perform('Clearing folder…', async () => { await clearReceiptFolder(); if (mounted.current) setAccount(null); }); })}
    </View>
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {button('Camera', () => { void choose('camera'); }, 'camera-outline')}
      {button('Photos', () => { void choose('photo'); }, 'images-outline')}
      {button('PDF / file', () => { void choose('file'); }, 'document-outline')}
    </View>
    {rows.map(receipt => {
      const draft = drafts.some(row => row.id === receipt.id);
      return <View key={receipt.id} style={{ gap: 5, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.border }}>
        <Text numberOfLines={2} style={{ fontSize: 12, fontWeight: '700', color: palette.text }}>{receipt.originalName}</Text>
        <Text style={{ fontSize: 11, color: palette.muted }}>{(receipt.size / 1024 / 1024).toFixed(2)} MB · {draft ? 'Ready · save entry first' : receipt.status === 'saved' ? `Saved · ${receipt.savedName || 'selected folder'}` : receipt.status === 'failed' ? 'Folder copy failed · original kept on phone' : 'Saved on phone · ready to copy'}</Text>
        {receipt.status === 'failed' && !!receipt.error && <Text style={{ fontSize: 11, color: palette.expense }}>{receipt.error}</Text>}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {!draft && entry && receipt.status !== 'saved' && button(receipt.status === 'failed' ? 'Retry save' : 'Save to folder', () => { void perform('Saving receipt…', async () => {
            if (!account) { const value = await chooseReceiptFolder(); if (!value) return; if (mounted.current) setAccount(value); }
            await saveReceiptToFolder(entry.id, receipt.id);
          }); }, 'folder-outline')}
          {receipt.localFileName && button('Local copy', () => { void perform('Opening original…', async () => {
            const uri = receiptLocalUri(receipt);
            if (!uri || !(await FileSystem.getInfoAsync(uri)).exists) throw new Error('The local original is not on this phone. Find the saved receipt in your selected folder, or add the original again.');
            if (!await Sharing.isAvailableAsync()) throw new Error('This phone cannot open the local receipt through sharing.');
            await Sharing.shareAsync(uri, { mimeType: receipt.mimeType, dialogTitle: receipt.originalName });
          }); }, 'document-attach-outline')}
          {draft && button('Remove', () => { void perform('Removing draft…', async () => { await discardReceiptDrafts([receipt]); if (mounted.current) onChange(drafts.filter(row => row.id !== receipt.id)); }); }, 'close-outline')}
        </View>
      </View>;
    })}
    {drafts.length > 0 && <Text style={{ fontSize: 11, color: palette.muted }}>{account ? 'Save the entry below to copy receipts to your chosen folder.' : 'Choose a folder, then save the entry to copy receipts there.'} A failed copy won’t change your transaction.</Text>}
    <Text style={{ fontSize: 10, color: palette.muted }}>Files use transaction date, item and amount. JSON backups contain receipt metadata, not the original files.</Text>
    {busy && <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ActivityIndicator size="small" color={palette.text} /><Text style={{ fontSize: 12, color: palette.text }}>{busy}</Text></View>}
  </View>;
}
