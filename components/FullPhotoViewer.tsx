import React, { useState } from 'react';
import { Image, Modal, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemeText as Text } from './ThemePrimitives';

export function FullPhotoViewer({ photos, selectedId, onSelect, onClose }: {
  photos: { id: string; uri: string; label: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const index = photos.findIndex(photo => photo.id === selectedId);
  const photo = photos[index];
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return <Modal visible={!!photo} animationType="fade" onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080809' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
        <Text style={{ flex: 1, color: '#FFF8E8', fontSize: 14 }}>{photo?.label} · {index + 1}/{photos.length}</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Close full photo" hitSlop={12}><Ionicons name="close" size={28} color="#FFF8E8" /></TouchableOpacity>
      </View>
      {photo && <Image key={photo.id} source={{ uri: photo.uri }} resizeMode="contain" style={{ flex: 1, width: '100%' }} onError={() => setFailedUri(photo.uri)} />}
      {photo && failedUri === photo.uri && <Text style={{ color: '#FFF8E8', textAlign: 'center', padding: 12 }}>Photo could not be loaded.</Text>}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 18 }}>
        <TouchableOpacity disabled={index <= 0} onPress={() => onSelect(photos[index - 1].id)} accessibilityLabel="Previous photo" style={{ padding: 12, opacity: index <= 0 ? .3 : 1 }}><Ionicons name="chevron-back" size={28} color="#FFF8E8" /></TouchableOpacity>
        <TouchableOpacity disabled={index < 0 || index >= photos.length - 1} onPress={() => onSelect(photos[index + 1].id)} accessibilityLabel="Next photo" style={{ padding: 12, opacity: index >= photos.length - 1 ? .3 : 1 }}><Ionicons name="chevron-forward" size={28} color="#FFF8E8" /></TouchableOpacity>
      </View>
    </SafeAreaView>
  </Modal>;
}
