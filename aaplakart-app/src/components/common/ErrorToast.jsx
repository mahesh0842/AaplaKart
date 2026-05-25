// GUI category: Common primitives. Centralizes toast presentation for success, info, and error states.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../utils/constants';
import { getShadowStyle } from '../../utils/helpers';

const variantStyles = {
  success: {
    borderColor: COLORS.accent,
    titleColor: COLORS.text,
    textColor: COLORS.mutedText,
  },
  error: {
    borderColor: COLORS.dangerText,
    titleColor: COLORS.text,
    textColor: COLORS.mutedText,
  },
  info: {
    borderColor: COLORS.primary,
    titleColor: COLORS.text,
    textColor: COLORS.mutedText,
  },
};

const ToastCard = ({ title, message, variant }) => {
  const currentVariant = variantStyles[variant] || variantStyles.info;

  return (
    <View style={[styles.card, { borderLeftColor: currentVariant.borderColor }]}>
      <Text style={[styles.title, { color: currentVariant.titleColor }]} numberOfLines={1}>
        {title}
      </Text>
      {message ? (
        <Text style={[styles.message, { color: currentVariant.textColor }]} numberOfLines={2}>
          {message}
        </Text>
      ) : null}
    </View>
  );
};

export const toastConfig = {
  success: ({ text1, text2 }) => (
    <ToastCard title={text1} message={text2} variant="success" />
  ),
  error: ({ text1, text2 }) => (
    <ToastCard title={text1} message={text2} variant="error" />
  ),
  info: ({ text1, text2 }) => (
    <ToastCard title={text1} message={text2} variant="info" />
  ),
};

const styles = StyleSheet.create({
  card: {
    width: '92%',
    alignSelf: 'center',
    borderLeftWidth: 4,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...getShadowStyle(COLORS.shadow),
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
});

