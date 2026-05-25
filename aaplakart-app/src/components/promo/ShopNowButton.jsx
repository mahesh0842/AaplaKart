// GUI category: Promo banner. Scrolls the user from the offer banner to the product grid.
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

const ShopNowButton = ({ onPress }) => (
  <Pressable
    accessibilityLabel="Shop now"
    onPress={onPress}
    style={({ pressed }) => [styles.button, pressed && styles.pressed]}
  >
    <Text style={styles.text}>Shop Now →</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    marginTop: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
  },
  pressed: {
    opacity: 0.92,
  },
  text: {
    color: '#ea580c',
    fontWeight: '700',
    fontSize: 12,
  },
});

export default ShopNowButton;

