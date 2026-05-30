/**
 * OTPInput — 4-digit OTP input with always-visible empty boxes.
 *
 * Features:
 *  ✅ 4 empty boxes visible from the start (dashed border, light bg)
 *  ✅ Active box glows with orange border & shadow
 *  ✅ Filled box gets solid orange border with digit
 *  ✅ Auto-submit when all 4 digits entered
 *  ✅ Paste support (auto-distributes digits)
 *  ✅ Numeric keyboard only
 *  ✅ Tap any box to focus
 *  ✅ Error state (red border)
 *  ✅ Responsive sizing
 *  ✅ SMS autofill (textContentType="oneTimeCode")
 */
import React, { useEffect, useRef } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS } from '../../utils/constants';

const DIGIT_COUNT = 4;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getBoxSize = () => {
  const avail = Math.min(SCREEN_WIDTH - 48, 360);
  const box = Math.floor((avail - 8 * (DIGIT_COUNT - 1)) / DIGIT_COUNT);
  return Math.min(box, 60);
};

const OTPInput = ({ value = '', onChange, hasError = false, onComplete, disabled = false }) => {
  const inputRef = useRef(null);
  const boxSize = getBoxSize();

  // Auto-focus hidden input on mount
  useEffect(() => {
    if (disabled) return;
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [disabled]);

  // Auto-submit when all digits entered
  useEffect(() => {
    if (value.length === DIGIT_COUNT && onComplete) {
      onComplete();
    }
  }, [value]);

  // Build digits array — empty slots are '' (not space), so filled check works
  const digits = Array.from({ length: DIGIT_COUNT }, (_, i) => value[i] || '');

  const handleChange = (text) => {
    const cleaned = text.replace(/\D/g, '').slice(0, DIGIT_COUNT);
    if (onChange) onChange(cleaned);
  };

  const focusInput = () => inputRef.current?.focus();

  return (
    <Pressable
      style={[styles.wrapper, disabled && styles.disabledWrapper]}
      onPress={disabled ? undefined : focusInput}
      accessibilityLabel="OTP input, 4 digits"
    >
      <View style={styles.row}>
        {digits.map((char, i) => {
          const filled = char !== '';
          const isActive = i === value.length && !hasError && !disabled;

          return (
            <View
              key={i}
              style={[
                styles.box,
                { width: boxSize, height: boxSize, borderRadius: boxSize * 0.28 },
                filled && styles.boxFilled,
                !filled && !isActive && !hasError && !disabled && styles.boxEmpty,
                isActive && styles.boxActive,
                hasError && styles.boxError,
                disabled && styles.boxDisabled,
              ]}
            >
              {filled ? (
                <Text
                  style={[
                    styles.digit,
                    { fontSize: boxSize * 0.44 },
                    hasError && styles.digitError,
                    disabled && styles.digitDisabled,
                  ]}
                >
                  {char}
                </Text>
              ) : (
                <View
                  style={[
                    styles.cursorDot,
                    {
                      width: boxSize * 0.18,
                      height: boxSize * 0.18,
                      borderRadius: boxSize * 0.09,
                    },
                    isActive && styles.cursorDotActive,
                    disabled && styles.cursorDotDisabled,
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={DIGIT_COUNT}
        caretHidden
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        editable={!disabled}
        style={styles.hiddenInput}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 14,
    marginBottom: 4,
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Empty box (pre-visible, dashed border) ──────────────
  box: {
    backgroundColor: '#faf7f2',
    borderWidth: 2,
    borderColor: '#ede4d5',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  boxEmpty: {
    backgroundColor: '#fff',
    borderColor: '#d4c4b0',
    borderStyle: 'dashed',
  },

  // ── Filled box (digit entered) ──────────────────────────
  boxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: '#fff7ed',
    borderStyle: 'solid',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },

  // ── Active box (next digit position) ────────────────────
  boxActive: {
    borderColor: COLORS.primary,
    borderWidth: 2.5,
    backgroundColor: '#fff',
    borderStyle: 'solid',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },

  // ── Error state ─────────────────────────────────────────
  boxError: {
    borderColor: COLORS.dangerText,
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderStyle: 'solid',
  },

  // ── Digit text ──────────────────────────────────────────
  digit: {
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 1,
  },
  digitDisabled: {
    color: '#d4c4b0',
  },
  digitError: {
    color: COLORS.dangerText,
  },

  // ── Cursor dot in empty boxes ───────────────────────────
  cursorDot: {
    backgroundColor: '#e5d9c6',
  },
  cursorDotActive: {
    backgroundColor: COLORS.primary,
  },
  cursorDotDisabled: {
    backgroundColor: '#e8ddd0',
  },

  // ── Disabled wrapper ────────────────────────────────────
  disabledWrapper: {
    opacity: 0.45,
  },
  boxDisabled: {
    borderColor: '#e8ddd0',
    backgroundColor: '#f5f0ea',
  },

  // ── Hidden TextInput ────────────────────────────────────
  // Hidden TextInput — kept in normal flow (no absolute/negative offset)
  // so ScrollView can auto-scroll to it when keyboard opens.
  hiddenInput: {
    width: 1,
    height: 1,
    opacity: 0,
    margin: 0,
    padding: 0,
  },
});

export default OTPInput;

