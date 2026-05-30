// GUI category: Common. Rating prompt modal — shown after 3rd delivered order.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOrdersStore } from '../../store/ordersStore';
import { COLORS } from '../../utils/constants';

const RATING_KEY = '@aaplakart/rating-shown';
const DELIVERY_COUNT_KEY = '@aaplakart/delivered-count';
const THRESHOLD = 3;

export default function RatingPrompt() {
  const orders = useOrdersStore((s) => s.orders);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const alreadyShown = await AsyncStorage.getItem(RATING_KEY);
      if (alreadyShown === 'true') return;

      const delivered = orders.filter((o) => o.status === 'delivered').length;
      const prevCount = parseInt(await AsyncStorage.getItem(DELIVERY_COUNT_KEY) || '0', 10);

      if (delivered > prevCount) {
        await AsyncStorage.setItem(DELIVERY_COUNT_KEY, String(delivered));
        if (delivered >= THRESHOLD && active) {
          setTimeout(() => setVisible(true), 2000); // slight delay after UI settles
        }
      }
    })();
    return () => { active = false; };
  }, [orders]);

  const handleRate = async () => {
    await AsyncStorage.setItem(RATING_KEY, 'true');
    setVisible(false);
    // Open Play Store / App Store
    const storeUrl = 'https://play.google.com/store/apps/details?id=com.aaplakart.app';
    try {
      const { Linking } = require('react-native');
      Linking.openURL(storeUrl);
    } catch {}
  };

  const handleLater = async () => {
    await AsyncStorage.setItem(RATING_KEY, 'true'); // don't ask again
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleLater}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.emoji}>⭐</Text>
          <Text style={styles.title}>Enjoying AaplaKart?</Text>
          <Text style={styles.subtitle}>
            You've placed {THRESHOLD}+ orders! Help us grow by leaving a rating.
          </Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Ionicons key={n} name="star" size={28} color="#f59e0b" />
            ))}
          </View>
          <Pressable style={styles.rateBtn} onPress={handleRate}>
            <Text style={styles.rateBtnText}>Rate on Play Store</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
          <Pressable style={styles.laterBtn} onPress={handleLater}>
            <Text style={styles.laterText}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    padding: 30,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 24,
    padding: 28, alignItems: 'center', width: '100%', maxWidth: 340,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.mutedText, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  stars: { flexDirection: 'row', gap: 4, marginTop: 16 },
  rateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14, marginTop: 20, width: '100%',
    justifyContent: 'center',
  },
  rateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  laterBtn: { marginTop: 12, padding: 8 },
  laterText: { color: COLORS.mutedText, fontSize: 14, fontWeight: '500' },
});
