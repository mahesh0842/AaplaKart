// GUI category: Auth. Displays the terms and privacy footnote below login actions.
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { COLORS } from '../../utils/constants';

const AuthFooter = () => (
  <Text style={styles.text}>
    By continuing, you agree to AaplaKart&apos;s Terms of Service and Privacy Policy.
  </Text>
);

const styles = StyleSheet.create({
  text: {
    marginTop: 18,
    textAlign: 'center',
    color: COLORS.mutedText,
    fontSize: 12,
    lineHeight: 19,
  },
});

export default AuthFooter;

