// Small floating checkout bubble — centered above tab bar.
// Appears when cart has items. Tap → direct checkout.
import React, { useMemo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../utils/constants';
import { formatCurrency, getCartCount, getCartSubtotal, getShadowStyle } from '../../utils/helpers';
import { useCartStore } from '../../store/cartStore';

const FloatingCartBar = ({ onCheckout }) => {
  const items = useCartStore((state) => state.items);
  const insets = useSafeAreaInsets();

  const itemCount = useMemo(() => getCartCount(items), [items]);
  const subtotal = useMemo(() => getCartSubtotal(items), [items]);

  const handlePress = useCallback(() => {
    onCheckout?.();
  }, [onCheckout]);

  if (itemCount === 0) return null;

  return (
    <View style={[styles.wrapper, { bottom: 68 + Math.max(insets.bottom, 8) }]}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.bubble, pressed && styles.bubblePressed]}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="cart" size={20} color="#fff" />
        </View>
       
        <View style={styles.arrowWrap}>
          <Ionicons name="chevron-forward" size={14} color="#fff" />
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 100,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...getShadowStyle(COLORS.primary),
  },
  bubblePressed: { opacity: 0.88 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
 
  arrowWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default FloatingCartBar;
