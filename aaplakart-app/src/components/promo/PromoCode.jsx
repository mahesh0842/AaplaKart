// GUI category: Promo banner. Shows a copyable promo code pill.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';

const PromoCode = ({ code }) => {
  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    Toast.show({
      type: 'success',
      text1: 'Promo copied',
      text2: `${code} is ready for checkout.`,
    });
  };

  return (
    <View style={styles.row}>
      <Text style={styles.caption}>Use code</Text>
      <Pressable
        accessibilityLabel={`Copy promo code ${code}`}
        onPress={handleCopy}
        style={({ pressed }) => [styles.codePill, pressed && styles.pressed]}
      >
        <Text style={styles.code}>{code}</Text>
        <Text style={styles.copyText}>Tap to copy</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    marginTop: 8,
    alignItems: 'center',
  },
  caption: {
    color: '#ffedd5',
    fontSize: 10,
    marginBottom: 4,
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  pressed: {
    opacity: 0.9,
  },
  code: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  copyText: {
    color: '#ffedd5',
    fontSize: 9,
  },
});

export default PromoCode;

