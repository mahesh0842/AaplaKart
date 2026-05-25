// GUI category: Screen. Hosts the phone login flow (modal or full-screen).
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Container from '../components/common/Container';
import PhoneLogin from '../components/auth/PhoneLogin';
import { COLORS } from '../utils/constants';

const LoginScreen = ({ onAuthenticated, onClose }) => (
  <Container edges={['top', 'left', 'right', 'bottom']}>
    {onClose && (
      <View style={styles.closeRow}>
        <Pressable
          accessibilityLabel="Close login"
          onPress={onClose}
          style={styles.closeButton}
          hitSlop={12}
        >
          <Ionicons name="close" size={24} color={COLORS.text} />
        </Pressable>
      </View>
    )}
    <PhoneLogin onAuthenticated={onAuthenticated} />
  </Container>
);

const styles = StyleSheet.create({
  closeRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LoginScreen;

