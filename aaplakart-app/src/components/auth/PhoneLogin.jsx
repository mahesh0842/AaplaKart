// GUI category: Auth. Handles phone number and OTP login via backend API.
// Sends OTP through backend -> Firebase REST API, verifies via backend.
// Mobile-only (uses Platform.OS check). No web support.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import CountryCodePicker from './CountryCodePicker';
import OTPInput from './OTPInput';
import AuthFooter from './AuthFooter';
import { COLORS, MOCK_OTP_CODE } from '../../utils/constants';
import { getShadowStyle, normalizePhoneNumber, sleep } from '../../utils/helpers';
import { mockOtpEnabled } from '../../services/firebase';
import { requestLocationPermission, getCurrentLocation } from '../../services/locationService';
import { useGoogleAuth, handleGoogleSignInResponse } from '../../services/googleAuth';
import { sendOtp as apiSendOtp, verifyOtp as apiVerifyOtp } from '../../services/api';

const RESEND_COOLDOWN = 120; // 2 minutes

const PhoneLogin = ({ onAuthenticated }) => {
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState('phone');
  const [loading, setLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [otpError, setOtpError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [usingMockFallback, setUsingMockFallback] = useState(false);

  const timerRef = useRef(null);

  // ── 2-minute resend timer ──────────────────────────────────────
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
  }, [resendTimer > 0]); // eslint-disable-line

  const startResendTimer = () => setResendTimer(RESEND_COOLDOWN);

  const googleAuth = useGoogleAuth();

  const fullPhoneNumber = useMemo(
    () => normalizePhoneNumber(countryCode, phoneNumber),
    [countryCode, phoneNumber]
  );

  // ── Block web ───────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webBlock}>
        <Ionicons name="phone-portrait-outline" size={48} color={COLORS.primary} />
        <Text style={styles.webBlockTitle}>Login on your phone</Text>
        <Text style={styles.webBlockText}>
          Open Expo Go on your phone and scan the QR code to log in.
        </Text>
        <Text style={styles.webBlockHint}>Google Sign-In will be available on web soon.</Text>
      </View>
    );
  }

  // ── Google Sign-In ─────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    try {
      if (!googleAuth.promptAsync) {
        Toast.show({
          type: 'error',
          text1: 'Google Sign-In unavailable',
          text2: 'Google client ID is not configured.',
        });
        return;
      }

      const result = await googleAuth.promptAsync();

      if (result?.type === 'cancel' || result?.type === 'dismiss') {
        // User cancelled — silently ignore
        return;
      }

      const session = await handleGoogleSignInResponse(result);

      if (!session.success) {
        if (!session.cancelled) {
          Toast.show({
            type: 'error',
            text1: 'Google Sign-In failed',
            text2: session.message || 'Please try again.',
          });
        }
        return;
      }

      const locationResult = await requestLocationPermission();
      if (locationResult.granted) {
        const loc = await getCurrentLocation();
        if (loc.success) {
          session.latitude = loc.latitude;
          session.longitude = loc.longitude;
        }
      }

      if (onAuthenticated) {
        await onAuthenticated(session);
      }

      Toast.show({
        type: 'success',
        text1: 'Welcome to AaplaKart',
        text2: session.provider === 'google-fallback'
          ? 'Signed in with Google.'
          : 'Signed in with Google successfully.',
      });
    } catch (error) {
      console.log('[Google] Sign-In error:', error);
      Toast.show({
        type: 'error',
        text1: 'Google Sign-In error',
        text2: error?.message || 'Could not complete Google Sign-In.',
      });
    }
  };

  // ── Send OTP ───────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!fullPhoneNumber || fullPhoneNumber.length < 11) {
      Toast.show({
        type: 'error',
        text1: 'Enter a valid phone number',
        text2: 'Please enter a complete mobile number (e.g., 98765 43210).',
      });
      return;
    }

    setLoading(true);
    setOtpError('');

    try {
      // Mock mode – no API call needed
      if (mockOtpEnabled) {
        await sleep(700);
        setSessionInfo('mock-session');
        setUsingMockFallback(false);
        setStep('otp');
        setOtpCode('');
        startResendTimer();
        Toast.show({
          type: 'info',
          text1: 'Mock OTP sent',
          text2: `Use ${MOCK_OTP_CODE} to continue in demo mode.`,
        });
        return;
      }

      // Real mode – try calling backend API
      try {
        const result = await apiSendOtp(fullPhoneNumber);
        setSessionInfo(result.session_info);
        setUsingMockFallback(false);
        setStep('otp');
        setOtpCode('');
        startResendTimer();
        Toast.show({
          type: 'success',
          text1: 'OTP sent',
          text2: `A verification code was sent to ${fullPhoneNumber}.`,
        });
      } catch (apiError) {
        // Auto-fallback: if backend is unreachable, use mock mode
        console.log('[PhoneLogin] Backend unreachable, falling back to mock OTP:', apiError?.message);
        await sleep(500);
        setSessionInfo('mock-session');
        setUsingMockFallback(true);
        setStep('otp');
        setOtpCode('');
        startResendTimer();
        Toast.show({
          type: 'info',
          text1: 'Demo OTP mode',
          text2: `Backend unavailable — use ${MOCK_OTP_CODE} to continue.`,
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Could not send OTP',
        text2: error?.message || 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Verify OTP ─────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    // Clear any previous error immediately on new attempt
    setOtpError('');

    if (otpCode.length !== 6) {
      Toast.show({
        type: 'error',
        text1: 'Enter the 6-digit OTP',
        text2: 'Please enter the full six-digit code.',
      });
      return;
    }

    if (!sessionInfo) {
      Toast.show({
        type: 'error',
        text1: 'Session expired',
        text2: 'Please go back and request a new OTP.',
      });
      return;
    }

    setLoading(true);

    try {
      let session;

      if (sessionInfo === 'mock-session') {
        // ── Mock verification ─────────────────────────────────
        await sleep(600); // simulate network delay

        if (otpCode !== MOCK_OTP_CODE) {
          setOtpError('OTP Mismatch, please enter again');
          setOtpCode(''); // clear OTP so user can retry
          Toast.show({
            type: 'error',
            text1: 'Invalid OTP',
            text2: `The code you entered is incorrect. Try ${MOCK_OTP_CODE} in demo mode.`,
          });
          setLoading(false);
          return;
        }

        session = {
          uid: `mock-${Date.now()}`,
          phoneNumber: fullPhoneNumber,
          provider: 'mock',
          idToken: '',
        };
      } else {
        // ── Real verification via backend API ─────────────────
        try {
          const result = await apiVerifyOtp(fullPhoneNumber, otpCode, sessionInfo);
          session = {
            uid: result.uid,
            phoneNumber: result.phone_number || fullPhoneNumber,
            provider: 'firebase',
            idToken: result.id_token || '',
          };
        } catch (apiError) {
          const msg = (apiError?.message || '').toLowerCase();

          if (msg.includes('invalid') || msg.includes('expired') || msg.includes('mismatch') || msg.includes('wrong')) {
            setOtpError('OTP Mismatch, please enter again');
            setOtpCode(''); // clear so user can retry
            Toast.show({
              type: 'error',
              text1: 'Invalid OTP',
              text2: 'The code is incorrect or expired. Please try again.',
            });
            setLoading(false);
            return;
          }

          // Other errors – also allow retry
          setOtpError('Verification failed, please try again');
          Toast.show({
            type: 'error',
            text1: 'Verification failed',
            text2: apiError?.message || 'Could not verify. Try again.',
          });
          setLoading(false);
          return;
        }
      }

      // ── Success – attach location if available ──────────────
      try {
        const locationResult = await requestLocationPermission();
        if (locationResult.granted) {
          const loc = await getCurrentLocation();
          if (loc.success) {
            session.latitude = loc.latitude;
            session.longitude = loc.longitude;
          }
        }
      } catch {
        // location is optional, ignore errors
      }

      // ── Navigate to home ────────────────────────────────────
      if (onAuthenticated) {
        await onAuthenticated(session);
      }

      Toast.show({
        type: 'success',
        text1: 'Welcome to AaplaKart',
        text2: 'Your phone number has been verified successfully.',
      });
    } catch (error) {
      setOtpError('Unexpected error, please try again');
      Toast.show({
        type: 'error',
        text1: 'Something went wrong',
        text2: error?.message || 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setOtpCode('');
    setOtpError('');
    setSessionInfo(null);
    setUsingMockFallback(false);
  };

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Fresh groceries in a few taps</Text>
          <Text style={styles.title}>Login with your phone</Text>
          <Text style={styles.subtitle}>
            Enter your number to continue shopping with quick OTP verification.
          </Text>
        </View>

        <View style={styles.card}>
          {step === 'phone' ? (
            <>
              <Text style={styles.sectionTitle}>Phone Number</Text>
              <Text style={styles.sectionSubtitle}>
                We will send a one-time password to verify your account.
              </Text>
              <View style={styles.inputRow}>
                <CountryCodePicker value={countryCode} onChange={setCountryCode} />
                <TextInput
                  accessibilityLabel="Enter phone number"
                  placeholder="98765 43210"
                  placeholderTextColor={COLORS.mutedText}
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={(text) => setPhoneNumber(text.replace(/\D/g, ''))}
                  maxLength={10}
                  style={styles.phoneInput}
                />
              </View>
              <Pressable
                accessibilityLabel="Send OTP"
                onPress={handleSendOtp}
                disabled={loading}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && !loading && styles.buttonPressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Send OTP</Text>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                accessibilityLabel="Sign in with Google"
                onPress={handleGoogleSignIn}
                style={({ pressed }) => [
                  styles.googleButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <View style={styles.googleIconWrap}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Enter OTP</Text>
              <Text style={styles.sectionSubtitle}>
                We sent a 6-digit code to {fullPhoneNumber}.
              </Text>

              {/* Show hint when using mock/demo mode */}
              {(mockOtpEnabled || usingMockFallback) && (
                <View style={styles.demoHintWrap}>
                  <Ionicons name="information-circle-outline" size={14} color={COLORS.primaryDark} />
                  <Text style={styles.demoHintText}>
                    Demo mode — use code <Text style={styles.demoHintCode}>{MOCK_OTP_CODE}</Text>
                  </Text>
                </View>
              )}

              <OTPInput
                value={otpCode}
                onChange={(val) => {
                  setOtpCode(val);
                  if (otpError) setOtpError(''); // clear error on edit
                }}
                hasError={!!otpError}
              />

              {/* OTP Mismatch / Error message */}
              {otpError ? (
                <View style={styles.otpErrorWrap}>
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.dangerText} />
                  <Text style={styles.otpErrorText}>{otpError}</Text>
                </View>
              ) : null}

              <Pressable
                accessibilityLabel="Verify OTP"
                onPress={handleVerifyOtp}
                disabled={loading || otpCode.length !== 6}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && !loading && styles.buttonPressed,
                  (loading || otpCode.length !== 6) && styles.buttonDisabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Verify OTP</Text>
                )}
              </Pressable>

              <View style={styles.secondaryActions}>
                <Pressable accessibilityLabel="Edit phone number" onPress={handleBackToPhone}>
                  <Text style={styles.secondaryText}>Edit number</Text>
                </Pressable>

                {/* Resend with 2-minute timer */}
                {resendTimer > 0 ? (
                  <View style={styles.resendTimerWrap}>
                    <Text style={styles.resendTimerText}>
                      Resend in {formatTimer(resendTimer)}
                    </Text>
                  </View>
                ) : (
                  <Pressable accessibilityLabel="Resend OTP" onPress={handleSendOtp}>
                    <Text style={styles.secondaryText}>Resend OTP</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
          <AuthFooter />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 28,
  },
  hero: {
    marginBottom: 26,
  },
  eyebrow: {
    color: COLORS.primaryDark,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    marginTop: 8,
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 10,
    color: COLORS.mutedText,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: '#fde6cf',
    ...getShadowStyle(COLORS.shadow),
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionSubtitle: {
    marginTop: 8,
    color: COLORS.mutedText,
    fontSize: 14,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#fff7ed',
    borderRadius: 16,
    paddingHorizontal: 16,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 20,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.92,
  },
  secondaryActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryText: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  otpErrorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.dangerBg,
    borderRadius: 12,
  },
  otpErrorText: {
    color: COLORS.dangerText,
    fontSize: 13,
    fontWeight: '700',
  },
  demoHintWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  demoHintText: {
    color: COLORS.primaryDark,
    fontSize: 13,
    fontWeight: '600',
  },
  demoHintCode: {
    fontWeight: '800',
    letterSpacing: 2,
  },
  resendTimerWrap: {
    paddingVertical: 2,
  },
  resendTimerText: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  webBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  webBlockTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12,
  },
  webBlockText: {
    fontSize: 14,
    color: COLORS.mutedText,
    textAlign: 'center',
    lineHeight: 22,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#fed7aa',
  },
  dividerText: {
    marginHorizontal: 14,
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '600',
  },
  googleButton: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#dadce0',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 18,
  },
  googleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4285F4',
    fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
  },
  googleButtonText: {
    color: '#1f1f1f',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default PhoneLogin;
