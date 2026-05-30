/**
 * PhoneLogin — Phone OTP login with step-by-step flow
 *
 * Features:
 *  ✅ Step 1: Phone number entry with country code picker
 *  ✅ Step 2: OTP entry with auto-verify (4 digits)
 *  ✅ Smart OTP sender: Mock → Backend REST → Firebase SDK (fallback chain)
 *  ✅ Resend cooldown timer
 *  ✅ Inline error messages (no Toast dependency for OTP flow)
 *  ✅ Loading states with spinner
 *  ✅ Smooth step transitions
 *  ✅ Keyboard-aware layout
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CountryCodePicker from './CountryCodePicker';
import OTPInput from './OTPInput';
import { COLORS } from '../../utils/constants';
import { normalizePhoneNumber } from '../../utils/helpers';
import { mockOtpEnabled, firebaseReady } from '../../services/firebase';
import {
  clearRecaptchaVerifier,
  smartSendOtp,
  smartConfirmOtp,
} from '../../services/authService';

const RESEND_COOLDOWN = 30;

const PhoneLogin = ({ onAuthenticated }) => {
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [otpMethod, setOtpMethod] = useState(null);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const timerRef = useRef(null);
  const phoneInputRef = useRef(null);

  // ── Derived ─────────────────────────────────────────────────
  const fullPhoneNumber = useMemo(
    () => normalizePhoneNumber(countryCode, phoneNumber),
    [countryCode, phoneNumber],
  );

  const isPhoneValid = fullPhoneNumber.length >= 11;

  // ── Resend timer ────────────────────────────────────────────
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resendTimer > 0]);

  // Cleanup reCAPTCHA on unmount
  useEffect(() => {
    return () => {
      clearRecaptchaVerifier();
    };
  }, []);

  const startResendTimer = useCallback(
    () => setResendTimer(RESEND_COOLDOWN),
    [],
  );

  // ── Block web ───────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webBlock}>
        <Ionicons name="phone-portrait-outline" size={48} color={COLORS.primary} />
        <Text style={styles.webBlockTitle}>Login on your phone</Text>
        <Text style={styles.webBlockText}>
          Open Expo Go on your phone and scan the QR code to log in.
        </Text>
      </View>
    );
  }

  // ── Send OTP ────────────────────────────────────────────────
  const handleSendOtp = useCallback(async () => {
    Keyboard.dismiss();
    setError('');

    if (!isPhoneValid) {
      setError('Please enter a complete mobile number.');
      return;
    }

    if (!firebaseReady && !mockOtpEnabled) {
      setError('Firebase is not configured. Set EXPO_PUBLIC_FIREBASE_* env vars.');
      return;
    }

    setLoading(true);

    try {
      const { method, data } = await smartSendOtp(
        fullPhoneNumber,
        'recaptcha-container',
      );

      setOtpMethod(method);
      setConfirmation(data);
      setStep('otp');
      setOtpCode('');
      startResendTimer();
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('invalid-phone')) {
        setError('Invalid phone number. Please check and try again.');
      } else if (msg.includes('too-many') || msg.includes('quota')) {
        setError('Too many requests. Please try again later.');
      } else if (msg.includes('network') || msg.includes('timeout')) {
        setError('Network error. Check your connection and try again.');
      } else {
        setError(err?.message || 'Could not send OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [fullPhoneNumber, isPhoneValid, startResendTimer]);

  // ── Verify OTP ──────────────────────────────────────────────
  const handleVerifyOtp = useCallback(async () => {
    setError('');

    if (otpCode.length !== 4) return;

    if (!confirmation) {
      setError('Session expired. Please request a new code.');
      return;
    }

    setLoading(true);

    try {
      const session = await smartConfirmOtp(
        otpMethod,
        confirmation,
        fullPhoneNumber,
        otpCode,
      );

      if (onAuthenticated) {
        await onAuthenticated(session);
      }
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      if (
        msg.includes('invalid') ||
        msg.includes('expired') ||
        msg.includes('mismatch') ||
        msg.includes('wrong')
      ) {
        setError('Invalid or expired OTP. Please try again.');
        setOtpCode('');
      } else {
        setError(err?.message || 'Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [otpCode, confirmation, otpMethod, fullPhoneNumber, onAuthenticated]);

  // ── Go back to phone step ───────────────────────────────────
  const handleBackToPhone = useCallback(() => {
    setStep('phone');
    setOtpCode('');
    setError('');
    setConfirmation(null);
    setOtpMethod(null);
    clearRecaptchaVerifier();
  }, []);

  // ── Resend handler ─────────────────────────────────────────
  const handleResend = useCallback(() => {
    if (resendTimer > 0) return;
    handleSendOtp();
  }, [handleSendOtp, resendTimer]);

  // ── Format timer ────────────────────────────────────────────
  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── OTP change handler ──────────────────────────────────────
  const handleOtpChange = useCallback(
    (val) => {
      setOtpCode(val);
      if (error) setError('');
    },
    [error],
  );

  return (
    <View style={styles.wrapper}>
      {/* Hidden reCAPTCHA container */}
      <View nativeID="recaptcha-container" style={styles.recaptcha} />

      {/* ── Phone Input Step ──────────────────────────────── */}
      {step === 'phone' ? (
        <>
          <View style={styles.inputCard}>
            <View style={styles.inputRow}>
              <CountryCodePicker value={countryCode} onChange={setCountryCode} />
              <View style={styles.inputDivider} />
              <TextInput
                ref={phoneInputRef}
                autoFocus
                placeholder="Enter mobile number"
                placeholderTextColor="#c4b5a5"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={(t) => {
                  setPhoneNumber(t.replace(/\D/g, ''));
                  if (error) setError('');
                }}
                maxLength={10}
                style={styles.phoneField}
                selectionColor={COLORS.primary}
                editable={!loading}
              />
            </View>
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorWrap}>
              <Ionicons name="alert-circle" size={16} color={COLORS.dangerText} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Send OTP button */}
          <Pressable
            onPress={handleSendOtp}
            disabled={loading || !isPhoneValid}
            style={({ pressed }) => [
              styles.ctaButton,
              (!isPhoneValid || loading) && styles.ctaButtonDisabled,
              pressed && !loading && isPhoneValid && styles.ctaButtonPressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={styles.ctaInner}>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
                <Text style={styles.ctaText}>Send OTP</Text>
              </View>
            )}
          </Pressable>

          <Text style={styles.hint}>
            We&apos;ll send a 4-digit code to verify your number.
          </Text>
        </>
      ) : (
        /* ── OTP Step ───────────────────────────────────────── */
        <>
          {/* OTP Input */}
          <View style={styles.otpSection}>
            {/* Edit number row — clean, no phone visible */}
            <View style={styles.otpHeader}>
              <Text style={styles.otpTitle}>Enter verification code</Text>
              <Pressable
                onPress={handleBackToPhone}
                hitSlop={8}
                disabled={loading}
              >
                <Text style={styles.editNumberText}>Edit number</Text>
              </Pressable>
            </View>

            <OTPInput
              value={otpCode}
              onChange={handleOtpChange}
              hasError={!!error}
              onComplete={handleVerifyOtp}
              disabled={loading}
            />

            {/* Error */}
            {error ? (
              <View style={styles.errorWrap}>
                <Ionicons name="alert-circle" size={16} color={COLORS.dangerText} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Loading */}
            {loading && (
              <ActivityIndicator
                color={COLORS.primary}
                size="small"
                style={styles.otpLoader}
              />
            )}

            {/* Resend */}
            <View style={styles.otpActions}>
              {resendTimer > 0 ? (
                <Text style={styles.timerText}>
                  Resend in {formatTimer(resendTimer)}
                </Text>
              ) : (
                <Pressable onPress={handleResend} hitSlop={12} disabled={loading}>
                  <Text style={styles.secondaryText}>Resend code</Text>
                </Pressable>
              )}
            </View>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  recaptcha: {
    height: 0,
    width: 0,
    opacity: 0,
    position: 'absolute',
  },

  // ── Phone input ──────────────────────────────────────────────
  inputCard: {
    backgroundColor: '#faf7f2',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#ede4d5',
    marginBottom: 14,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
  },
  inputDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e5d9c6',
    marginHorizontal: 4,
  },
  phoneField: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    paddingVertical: 14,
    paddingRight: 12,
    letterSpacing: 2,
  },

  // ── CTA Button ───────────────────────────────────────────────
  ctaButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaButtonDisabled: {
    opacity: 0.5,
  },
  ctaButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  hint: {
    fontSize: 12,
    color: COLORS.mutedText,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },

  // ── OTP section ──────────────────────────────────────────────
  otpSection: {
    alignItems: 'stretch',
  },
  otpHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  otpTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  editNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  otpLoader: {
    marginTop: 14,
  },
  otpActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 2,
  },

  // ── Shared ───────────────────────────────────────────────────
  errorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: COLORS.dangerBg,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.dangerText,
    fontWeight: '500',
    flex: 1,
    marginLeft: 8,
  },
  secondaryText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  timerText: {
    color: COLORS.mutedText,
    fontSize: 13,
  },

  // ── Web block ────────────────────────────────────────────────
  webBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  webBlockTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 16,
  },
  webBlockText: {
    fontSize: 14,
    color: COLORS.mutedText,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

export default PhoneLogin;
