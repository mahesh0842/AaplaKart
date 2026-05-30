import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from './StatusBadge';
import { COLORS } from '../utils/constants';

const REJECT_REASONS = ['Too far away', 'I am busy', 'Not my area', 'Other'];

const OrderCard = ({ order, onPress, accepted, onAccept, onRelease, onReject }) => {
  const [showReject, setShowReject] = useState(false);
  const items = order.items || [];
  const itemCount = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const address = order.address_line1 || order.address?.line1 || '';
  const city = order.address_city || order.address?.city || '';
  const dist = order.distanceFromShop;
  const timeAgo = order.placed_at ? Math.round((Date.now() - new Date(order.placed_at).getTime()) / 60000) : null;

  const handleReject = (reason) => {
    setShowReject(false);
    if (onReject) {
      onReject(order.id, reason);
    }
  };

  const showRejectOptions = () => {
    Alert.alert('Reject Order', 'Why are you rejecting this order?', [
      ...REJECT_REASONS.map((r) => ({ text: r, onPress: () => handleReject(r) })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Pressable onPress={() => onPress?.(order)} style={({ pressed }) => [styles.card, pressed && styles.pressed, accepted && styles.accepted]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderId}>{order.id}</Text>
          {timeAgo != null && <Text style={styles.timeAgo}>{timeAgo}m ago</Text>}
        </View>
        <StatusBadge status={order.status} />
      </View>

      {/* Address */}
      <View style={styles.addressRow}>
        <Ionicons name="location-outline" size={14} color={COLORS.primary} />
        <Text style={styles.address} numberOfLines={1}>{address}, {city}</Text>
        {dist != null && (
          <View style={styles.distBadge}>
            <Ionicons name="navigate" size={10} color={COLORS.primary} />
            <Text style={styles.distText}>{dist.toFixed(1)}km</Text>
          </View>
        )}
      </View>

      {/* Items preview */}
      <View style={styles.itemsPreview}>
        {items.slice(0, 3).map((item) => (
          <Text key={item.product_id || item.name} style={styles.itemText} numberOfLines={1}>
            {item.quantity}x {item.name}
          </Text>
        ))}
        {items.length > 3 && <Text style={styles.moreText}>+{items.length - 3} more</Text>}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.total}>₹{Number(order.total || 0).toFixed(0)}</Text>
        <View style={styles.footerRight}>
          {order.payment_method === 'cod' ? (
            <Text style={styles.codBadge}>COD</Text>
          ) : (
            <Text style={styles.onlineBadge}>Online</Text>
          )}
          <Text style={styles.itemCount}>{itemCount}</Text>
        </View>
      </View>

      {/* Action buttons */}
      {!accepted && onAccept && (
        <View style={styles.actionRow}>
          <Pressable style={styles.acceptBtn} onPress={() => onAccept(order.id)}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>Accept</Text>
          </Pressable>
          {onReject && (
            <Pressable style={styles.rejectBtn} onPress={showRejectOptions}>
              <Ionicons name="close-circle" size={16} color={COLORS.dangerText} />
              <Text style={styles.rejectBtnText}>Reject</Text>
            </Pressable>
          )}
        </View>
      )}
      {accepted && onRelease && (
        <Pressable style={styles.releaseBtn} onPress={onRelease}>
          <Ionicons name="close-circle-outline" size={16} color={COLORS.dangerText} />
          <Text style={styles.releaseText}>Release</Text>
        </Pressable>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.card, borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#fde6cf' },
  accepted: { borderColor: COLORS.primary, borderWidth: 1.5 },
  pressed: { opacity: 0.85 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  orderId: { fontSize: 14, fontWeight: '800', color: COLORS.text, flex: 1 },
  timeAgo: { fontSize: 10, color: COLORS.mutedText, marginTop: 1 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  address: { fontSize: 12, color: COLORS.mutedText, flex: 1 },
  distBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#fff7ed', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  distText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  itemsPreview: { marginBottom: 8 },
  itemText: { fontSize: 12, color: COLORS.text, lineHeight: 18 },
  moreText: { fontSize: 11, color: COLORS.mutedText, marginTop: 1, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#fde6cf', paddingTop: 8 },
  total: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codBadge: { fontSize: 10, fontWeight: '700', color: '#92400e', backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  onlineBadge: { fontSize: 10, fontWeight: '700', color: '#1e40af', backgroundColor: '#dbeafe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  itemCount: { fontSize: 11, color: COLORS.mutedText },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  acceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 10 },
  rejectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fee2e2', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#fecaca' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  rejectBtnText: { color: COLORS.dangerText, fontSize: 13, fontWeight: '700' },
  releaseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fee2e2', borderRadius: 12, paddingVertical: 8, marginTop: 8, borderWidth: 1, borderColor: '#fecaca' },
  releaseText: { color: COLORS.dangerText, fontSize: 13, fontWeight: '700' },
});

export default OrderCard;
