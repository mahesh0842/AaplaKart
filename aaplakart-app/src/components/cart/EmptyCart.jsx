// GUI category: Cart UI. Shows a friendly empty state when no products are in the cart.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../utils/constants';

const EmptyCart = () => (
  <View style={styles.card}>
    <Text style={styles.emoji}>🛒</Text>
    <Text style={styles.title}>Your cart is empty</Text>
    <Text style={styles.subtitle}>
      Add a few essentials from Home and they will show up here instantly.
    </Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 26,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fde6cf',
  },
  emoji: {
    fontSize: 40,
  },
  title: {
    marginTop: 14,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.mutedText,
  },
});

export default EmptyCart;

