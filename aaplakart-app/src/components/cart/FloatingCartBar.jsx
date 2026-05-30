// Floating cart bubble — tap opens Checkout directly
// Compact: cart icon + count, orange (1 item) or green (2+ items)
import React, { useMemo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../utils/constants';
import { getCartCount, getShadowStyle } from '../../utils/helpers';
import { useCartStore } from '../../store/cartStore';

const FloatingCartBar = ({ onNavigateCart }) => {
  const items = useCartStore((state) => state.items);
  const insets = useSafeAreaInsets();

  const itemCount = useMemo(() => getCartCount(items), [items]);

  const handlePress = useCallback(() => {
    onNavigateCart?.();
  }, [onNavigateCart]);

  if (itemCount === 0) return null;

  const bgColor = itemCount > 1 ? '#16a34a' : COLORS.primary;

  return (
    <View style={[styles.wrapper, { bottom: 68 + Math.max(insets.bottom, 8) }]}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.bubble,
          { backgroundColor: bgColor },
          pressed && styles.bubblePressed,
        ]}
      >
        <Ionicons name="cart" size={24} color="#fff" />
        <Text style={styles.count}>{itemCount}</Text>
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
    justifyContent: 'center',
    gap: 8,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 22,
    minWidth: 68,
    ...getShadowStyle(COLORS.primary),
  },
  bubblePressed: { opacity: 0.88 },
  count: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});

export default FloatingCartBar;
