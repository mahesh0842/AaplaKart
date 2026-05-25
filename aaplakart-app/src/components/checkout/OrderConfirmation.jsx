// GUI category: Checkout UI. Shows order success confirmation with details and next steps.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, ORDER_STATUS_LABELS } from '../../utils/constants';
import { formatCurrency, getShadowStyle } from '../../utils/helpers';

const OrderConfirmation = ({ order, onContinueShopping }) => (
  <View style={styles.content}>
    <View style={styles.successIcon}>
      <Ionicons name="checkmark-circle" size={72} color={COLORS.accent} />
    </View>
    <Text style={styles.successTitle}>Order Placed!</Text>
    <Text style={styles.successSubtitle}>
      Your order has been placed successfully.
    </Text>

    <View style={styles.card}>
      <View style={styles.orderIdRow}>
        <Text style={styles.orderIdLabel}>Order ID</Text>
        <Text style={styles.orderIdValue}>{order.id}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.detailRow}>
        <Ionicons name="cube-outline" size={18} color={COLORS.primary} />
        <Text style={styles.detailText}>
          {(order.items || []).reduce((sum, item) => sum + item.quantity, 0)} item(s)
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="card-outline" size={18} color={COLORS.primary} />
        <Text style={styles.detailText}>
          {{
            cod: 'Cash on Delivery',
            upi: 'UPI',
          }[order.paymentMethod] || order.paymentMethod}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="location-outline" size={18} color={COLORS.primary} />
        <Text style={styles.detailText} numberOfLines={2}>
          {order.address.line1}, {order.address.city}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="time-outline" size={18} color={COLORS.primary} />
        <Text style={styles.detailText}>
          Delivery: {order.deliverySlotLabel || 'ASAP'}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="navigate-outline" size={18} color={COLORS.primary} />
        <Text style={styles.detailText}>
          Est. by {new Date(order.estimatedDelivery).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="checkmark-done-outline" size={18} color={COLORS.accent} />
        <Text style={[styles.detailText, { color: COLORS.accent, fontWeight: '700' }]}>
          {ORDER_STATUS_LABELS[order.status]}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Paid</Text>
        <Text style={styles.totalValue}>{formatCurrency(order.total)}</Text>
      </View>
    </View>

    <Pressable
      accessibilityLabel="Continue shopping"
      onPress={onContinueShopping}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Text style={styles.buttonText}>Continue Shopping</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  successSubtitle: {
    fontSize: 15,
    color: COLORS.mutedText,
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#fde6cf',
    ...getShadowStyle(COLORS.shadow),
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderIdLabel: {
    fontSize: 13,
    color: COLORS.mutedText,
  },
  orderIdValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#fed7aa',
    marginVertical: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  detailText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  button: {
    width: '100%',
    marginTop: 20,
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default OrderConfirmation;
