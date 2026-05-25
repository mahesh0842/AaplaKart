// GUI category: Auth. Offers a lightweight country-code picker for the phone login flow.
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
        <Ionicons name="chevron-down" size={16} color={COLORS.mutedText} />
      </Pressable>

      <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.sheet}>
            {OPTIONS.map((option) => (
              <Pressable
                key={option.code}
                onPress={() => {
                  onChange(option.code);
                  setVisible(false);
                }}
                style={styles.option}
              >
                <Text style={styles.optionFlag}>{option.flag}</Text>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionCode}>{option.code}</Text>
                </View>
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
    backgroundColor: '#fff7ed',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginRight: 10,
  },
  flag: {
    fontSize: 16,
    marginRight: 8,
  },
  code: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginRight: 4,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.3)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    paddingVertical: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  optionFlag: {
    fontSize: 18,
    marginRight: 12,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  optionCode: {
    color: COLORS.mutedText,
    marginTop: 3,
  },
});

export default CountryCodePicker;

