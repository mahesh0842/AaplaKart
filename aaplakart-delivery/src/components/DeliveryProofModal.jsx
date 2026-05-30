import React, { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ActionButton from './ActionButton';
import { COLORS } from '../utils/constants';

export default function DeliveryProofModal({ visible, onClose, onConfirm }) {
  const [photo, setPhoto] = useState(null);
  const [capturing, setCapturing] = useState(false);

  const handleCapture = async () => {
    try {
      setCapturing(true);

      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Camera permission is required to capture delivery proof.');
        setCapturing(false);
        return;
      }

      // Launch camera to take a photo
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const capturedPhoto = result.assets[0];
        setPhoto({
          uri: capturedPhoto.uri,
          width: capturedPhoto.width,
          height: capturedPhoto.height,
          type: 'image/jpeg',
        });
      }
    } catch (err) {
      console.warn('[DeliveryProof] Camera error:', err?.message);
      alert('Could not open camera. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const handleConfirm = () => {
    onConfirm?.(photo);
    setPhoto(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>📸 Delivery Proof</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={24} color={COLORS.mutedText} /></Pressable>
          </View>

          <Text style={styles.desc}>Capture a photo of the delivered order as proof.</Text>

          {photo ? (
            <View style={styles.preview}>
              <Image source={{ uri: photo.uri }} style={styles.previewImage} resizeMode="cover" />
              <Text style={styles.capturedText}>Photo captured ✅</Text>
            </View>
          ) : (
            <Pressable style={styles.cameraBtn} onPress={handleCapture} disabled={capturing}>
              <Ionicons name="camera" size={40} color={COLORS.primary} />
              <Text style={styles.cameraText}>{capturing ? 'Opening Camera...' : 'Tap to Capture'}</Text>
            </Pressable>
          )}

          <View style={styles.actions}>
            <ActionButton label="Skip" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
            <View style={{ width: 10 }} />
            <ActionButton label="Confirm Delivery" style={{ flex: 1 }} onPress={handleConfirm} disabled={!photo} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  desc: { fontSize: 14, color: COLORS.mutedText, marginBottom: 20 },
  preview: { alignItems: 'center', paddingVertical: 30, backgroundColor: '#f0fdf4', borderRadius: 16, marginBottom: 20 },
  previewImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 8 },
  capturedText: { fontSize: 15, fontWeight: '700', color: COLORS.accent, marginTop: 8 },
  cameraBtn: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#fff7ed', borderRadius: 16, borderWidth: 2, borderColor: '#fed7aa', borderStyle: 'dashed', marginBottom: 20 },
  cameraText: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginTop: 8 },
  actions: { flexDirection: 'row' },
});
