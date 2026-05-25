import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { COLORS } from '../utils/constants';

const ActionButton = ({ label, onPress, variant = 'primary', loading = false, disabled = false, style }) => (
  <Pressable onPress={onPress} disabled={disabled || loading}
    style={({ pressed }) => [
      styles.base, variant === 'primary' && styles.primary, variant === 'secondary' && styles.secondary,
      variant === 'danger' && styles.danger, (disabled || loading) && styles.disabled, pressed && styles.pressed, style,
    ]}>
    {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.text, variant === 'secondary' && styles.secondaryText]}>{label}</Text>}
  </Pressable>
);

const styles = StyleSheet.create({
  base: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: COLORS.primary },
  secondary: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  danger: { backgroundColor: COLORS.dangerText },
  disabled: { opacity: 0.5 }, pressed: { opacity: 0.85 },
  text: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryText: { color: COLORS.text },
});

export default ActionButton;
