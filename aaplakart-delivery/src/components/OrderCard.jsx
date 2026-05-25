import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from './StatusBadge';
import { COLORS } from '../utils/constants';

const OrderCard = ({ order, onPress }) => {
  const items = order.items || [];
  const itemCount = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const address = order.address_line1 || order.address?.line1 || '';
  const city = order.address_city || order.address?.city || '';
  const dist = order.distanceFromShop;
  return (
    <Pressable onPress={() => onPress?.(order)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.header}>
        <Text style={styles.orderId}>{order.id}</Text>
        <StatusBadge status={order.status} />
      </View>
      <View style={styles.addressRow}>
        <Ionicons name="location-outline" size={14} color={COLORS.primary} />
        <Text style={styles.address} numberOfLines={1}>{address}, {city}</Text>
        {dist != null && (
          <View style={styles.distBadge}>
            <Text style={styles.distText}>{dist.toFixed(1)}km</Text>
          </View>
        )}
      </View>
      <View style={styles.itemsPreview}>
        {items.slice(0, 3).map((item) => (
          <Text key={item.product_id || item.name} style={styles.itemText} numberOfLines={1}>{item.quantity}x {item.name}</Text>
        ))}
        {items.length > 3 && <Text style={styles.moreText}>+{items.length - 3} more</Text>}
      </View>
      <View style={styles.footer}>
        <Text style={styles.total}>₹{Number(order.total || 0).toFixed(0)}</Text>
        <Text style={styles.payment}>{order.payment_method?.toUpperCase()}</Text>
        <Text style={styles.itemCount}>{itemCount} item(s)</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.card, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#fde6cf' },
  pressed: { opacity: 0.85 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  orderId: { fontSize: 14, fontWeight: '800', color: COLORS.text, flex: 1 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  address: { fontSize: 13, color: COLORS.mutedText, flex: 1 },
  distBadge: { backgroundColor: '#fff7ed', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  distText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  itemsPreview: { marginBottom: 10 },
  itemText: { fontSize: 12, color: COLORS.text, lineHeight: 18 },
  moreText: { fontSize: 11, color: COLORS.mutedText, marginTop: 2, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#fde6cf', paddingTop: 10 },
  total: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  payment: { fontSize: 11, fontWeight: '700', color: COLORS.accent },
  itemCount: { fontSize: 11, color: COLORS.mutedText },
});

export default OrderCard;
