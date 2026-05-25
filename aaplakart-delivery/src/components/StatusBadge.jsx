import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { STATUS_LABELS, STATUS_COLORS } from '../utils/constants';

const StatusBadge = ({ status, size = 'md' }) => {
  const color = STATUS_COLORS[status] || '#6b7280';
  const label = STATUS_LABELS[status] || status;
  return (
    <View style={[styles.badge, { backgroundColor: color + '18' }, size === 'sm' && styles.small]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }, size === 'sm' && styles.smallText]} numberOfLines={1}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
  small: { paddingHorizontal: 8, paddingVertical: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '700' },
  smallText: { fontSize: 10 },
});

export default StatusBadge;
