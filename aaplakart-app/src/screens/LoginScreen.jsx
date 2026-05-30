/**
 * LoginScreen — Phone OTP login screen
 *
 * Features:
 *  ✅ Brand header with logo
 *  ✅ Close button (modal mode)
 *  ✅ Terms & Privacy footer
 *  ✅ Keyboard-aware layout
 *  ✅ SafeArea-aware padding
 */
import React from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PhoneLogin from '../components/auth/PhoneLogin';
import { COLORS } from '../utils/constants';

const LoginScreen = ({ onAuthenticated, onClose }) => {
  const insets = useSafeAreaInsets();

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          enabled
        >
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
          {/* ── Close button ─────────────────────────────── */}
          {onClose && (
            <View style={styles.closeRow}>
              <Pressable
                accessibilityLabel="Close login"
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={12}
              >
                <Ionicons name="close" size={22} color={COLORS.mutedText} />
              </Pressable>
            </View>
          )}

          {/* ── Branding ─────────────────────────────────── */}
          <View style={styles.branding}>
            <View style={styles.logoWrap}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logoImg}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandName}>AaplaKart</Text>
            <Text style={styles.tagline}>Fresh groceries, delivered fast</Text>
          </View>

          {/* ── Phone login form ─────────────────────────── */}
          <View style={styles.formCard}>
            <PhoneLogin onAuthenticated={onAuthenticated} />
          </View>

          {/* ── Footer ───────────────────────────────────── */}
          <Text style={styles.footerNote}>
            By continuing, you agree to our{' '}
            <Text style={styles.footerLink}>Terms of Service</Text> and{' '}
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },

  // ── Close ────────────────────────────────────────────
  closeRow: {
    alignItems: 'flex-end',
    paddingTop: 4,
    marginBottom: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.mutedBg,
  },

  // ── Branding ─────────────────────────────────────────
  branding: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoImg: {
    width: 64,
    height: 64,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.mutedText,
    marginTop: 4,
    letterSpacing: 0.3,
  },

  // ── Form card ────────────────────────────────────────
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },

  // ── Footer ───────────────────────────────────────────
  footerNote: {
    fontSize: 12,
    color: COLORS.mutedText,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  footerLink: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default LoginScreen;

