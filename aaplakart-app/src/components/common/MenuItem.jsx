// Reusable menu row — icon + label + subtitle + chevron. Extracted from ProfileScreen.
// Can be used in any settings/profile/options list.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

/**
 * @param {object} props
 * @param {string} props.icon - Ionicons name
 * @param {string} props.label - Primary row text
 * @param {string} [props.subtitle] - Optional secondary text
 * @param {() => void} props.onPress
 * @param {string} [props.color] - Accent color for icon background (defaults to primary)
 * @param {boolean} [props.danger] - If true, uses red styling for destructive actions
 */
const MenuItem = ({ icon, label, subtitle, onPress, color, danger = false }) => {
  const resolvedColor = danger ? COLORS.dangerText : (color || COLORS.primary);
  const bgColor = danger ? COLORS.dangerBg : `${resolvedColor}18`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={20} color={resolvedColor} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.label, danger && styles.labelDanger]}>{label}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.mutedText} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  pressed: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  labelDanger: {
    color: COLORS.dangerText,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.mutedText,
  },
});

export default MenuItem;
