// GUI category: Cart UI. Summarizes totals and renders the checkout action.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../utils/constants';
import { formatCurrency, getShadowStyle } from '../../utils/helpers';

const SummaryRow = ({ label, value, valueStyle }) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={[styles.summaryValue, valueStyle]}>{value}</Text>
  </View>
);

const CartSummary = ({ subtotal, deliveryFee, total, onCheckout }) => (
  <View style={styles.card}>
    <SummaryRow label="Subtotal" value={formatCurrency(subtotal)} />
    <SummaryRow
      label="Delivery Fee"
      value={deliveryFee === 0 ? 'FREE' : formatCurrency(deliveryFee)}
      valueStyle={deliveryFee === 0 ? styles.freeValue : null}
    />
    <View style={styles.divider} />
    <SummaryRow label="Total" value={formatCurrency(total)} valueStyle={styles.totalValue} />
    <Pressable
      accessibilityLabel="Proceed to checkout"
      onPress={onCheckout}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.buttonText}>Proceed to Checkout</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#fde6cf',
    ...getShadowStyle(COLORS.shadow),
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.mutedText,
  },
  summaryValue: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '700',
  },
  freeValue: {
    color: COLORS.successText,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#fed7aa',
    marginBottom: 12,
  },
  button: {
    marginTop: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  pressed: {
    opacity: 0.92,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default CartSummary;

