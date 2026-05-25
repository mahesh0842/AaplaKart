// GUI category: Auth. Captures the 6-digit one-time password using a mobile-friendly box UI.
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS } from '../../utils/constants';

const OTPInput = ({ value, onChange, hasError }) => {
  const inputRef = useRef(null);

  // Auto-focus the hidden input when the component mounts (after navigation to OTP screen)
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const digits = value.padEnd(6, ' ').split('');

  return (
    <Pressable style={styles.container} onPress={() => inputRef.current?.focus()}>
      <View style={styles.boxRow}>
        {digits.map((digit, index) => (
          <View
            key={`otp-${index}`}
            style={[
              styles.box,
              digit.trim() ? styles.filledBox : null,
              hasError ? styles.errorBox : null,
            ]}
          >
            <Text style={[styles.digit, hasError && digit.trim() ? styles.errorDigit : null]}>
              {digit.trim()}
            </Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        accessibilityLabel="Enter 6 digit OTP"
        keyboardType="number-pad"
        maxLength={6}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, ''))}
        style={styles.hiddenInput}
        caretHidden={true}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
  },
  boxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  box: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filledBox: {
    borderColor: COLORS.primary,
    backgroundColor: '#fff7ed',
  },
  errorBox: {
    borderColor: COLORS.dangerText,
    backgroundColor: COLORS.dangerBg,
  },
  digit: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  errorDigit: {
    color: COLORS.dangerText,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
});

export default OTPInput;

