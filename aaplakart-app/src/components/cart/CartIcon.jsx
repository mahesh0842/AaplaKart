// GUI category: Cart. Badge icon used in tab bar.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

const CartIcon = ({ color, size, badgeCount }) => (
  <View style={styles.wrapper}>
    <Ionicons name="cart-outline" size={size} color={color} />
    {badgeCount > 0 && (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  wrapper: { position: 'relative', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: COLORS.primary, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});

export default CartIcon;
