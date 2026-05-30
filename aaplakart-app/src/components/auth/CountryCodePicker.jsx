// GUI category: Auth. Modern country-code picker for phone login.
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

const OPTIONS = [
  { label: 'India', code: '+91', flag: '🇮🇳' },
  { label: 'United States', code: '+1', flag: '🇺🇸' },
  { label: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { label: 'Canada', code: '+1', flag: '🇨🇦' },
  { label: 'Australia', code: '+61', flag: '🇦🇺' },
  { label: 'UAE', code: '+971', flag: '🇦🇪' },
];

const CountryCodePicker = ({ value, onChange }) => {
  const [visible, setVisible] = useState(false);

  const selectedOption = useMemo(
    () => OPTIONS.find((option) => option.code === value) || OPTIONS[0],
    [value]
  );

  return (
    <>
      <Pressable
        accessibilityLabel="Choose country code"
        onPress={() => setVisible(true)}
        style={styles.trigger}
      >
        <Text style={styles.flag}>{selectedOption.flag}</Text>
        <Text style={styles.code}>{selectedOption.code}</Text>
        <Ionicons name="chevron-down" size={14} color={COLORS.mutedText} />
      </Pressable>

      <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Country</Text>
              <Pressable onPress={() => setVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={COLORS.mutedText} />
              </Pressable>
            </View>
            {OPTIONS.map((option, idx) => (
              <Pressable
                key={`${option.code}-${idx}`}
                onPress={() => {
                  onChange(option.code);
                  setVisible(false);
                }}
                style={[
                  styles.option,
                  option.code === value && styles.optionSelected,
                ]}
              >
                <Text style={styles.optionFlag}>{option.flag}</Text>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionCode}>{option.code}</Text>
                </View>
                {option.code === value && (
                  <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  flag: {
    fontSize: 18,
  },
  code: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f0ea',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  optionSelected: {
    backgroundColor: '#fff7ed',
  },
  optionFlag: {
    fontSize: 20,
    marginRight: 14,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  optionCode: {
    color: COLORS.mutedText,
    marginTop: 2,
    fontSize: 13,
  },
});

export default CountryCodePicker;

