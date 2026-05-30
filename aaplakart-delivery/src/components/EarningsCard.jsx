import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';

export default function EarningsCard({ today = 0, week = 0, deliveries = 0, km = 0 }) {
  const items = [
    { icon: 'cash', value: `₹${today}`, label: 'Today', color: COLORS.accent },
    { icon: 'calendar', value: `₹${week}`, label: 'This Week', color: '#2563eb' },
    { icon: 'checkmark-circle', value: `${deliveries}`, label: 'Deliveries', color: COLORS.primary },
    { icon: 'navigate', value: `${km}km`, label: 'Distance', color: '#7c3aed' },
  ];
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <View key={item.label} style={styles.card}>
          <Ionicons name={item.icon} size={18} color={item.color} />
          <Text style={styles.value}>{item.value}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  card: { flex: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#fde6cf' },
  value: { fontSize: 16, fontWeight: '900', color: COLORS.text, marginTop: 4 },
  label: { fontSize: 9, color: COLORS.mutedText, fontWeight: '600', marginTop: 1 },
});
