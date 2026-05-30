/**
 * AaplaKart Auth Service
 * ======================
 * Centralised authentication module.
 *
 * Handles:
 *  📞 Phone OTP (Firebase SDK + Backend REST API + Custom SMS)
 *  ✉️ Email/Password login & signup
 *  🟢 Google Sign-In
 *  🎭 Mock/dev mode
 *
 * Session persistence via AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { MOCK_AUTH_STORAGE_KEY, MOCK_OTP_CODE } from '../utils/constants';
import {
  setAuthToken,
  clearAuthToken,
  verifyFirebaseToken,
  simpleLogin,
  sendOtp as apiSendOtp,
  verifyOtp as apiVerifyOtp,
  rawPost,
  getApiBase,
} from './api';
import { auth, mockOtpEnabled } from './firebase';

// ═════════════════════════════════════════════════════════════════
//  Session Persistence
// ═════════════════════════════════════════════════════════════════

export async function persistSession(session) {
  await AsyncStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(session));
}

export async function restoreSession() {
  try {
    const raw = await AsyncStorage.getItem(MOCK_AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearSession() {
  await AsyncStorage.removeItem(MOCK_AUTH_STORAGE_KEY);
  clearAuthToken();
}

// ═════════════════════════════════════════════════════════════════
//  reCAPTCHA Verifier (Firebase Phone Auth)
// ═════════════════════════════════════════════════════════════════

let _recaptchaVerifier = null;

export function getRecaptchaVerifier(containerId = 'recaptcha-container') {
  if (_recaptchaVerifier) return _recaptchaVerifier;
  if (!auth) {
    throw new Error('Firebase Auth is not initialized.');
  }
  _recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {},
    'expired-callback': () => {
      _recaptchaVerifier = null;
    },
  });
  return _recaptchaVerifier;
}

export function clearRecaptchaVerifier() {
  if (_recaptchaVerifier) {
    try {
      _recaptchaVerifier.clear();
    } catch {
      /* ignore */
    }
    _recaptchaVerifier = null;
  }
}

// ═════════════════════════════════════════════════════════════════
//  Firebase Client SDK Phone OTP
// ═════════════════════════════════════════════════════════════════

export async function sendPhoneOtp(phoneNumber, recaptchaContainerId = 'recaptcha-container') {
  if (!auth) throw new Error('Firebase Auth not initialized.');
  const verifier = getRecaptchaVerifier(recaptchaContainerId);
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    return {
      verificationId: confirmationResult.verificationId,
      confirm: confirmationResult.confirm,
    };
  } catch (err) {
    clearRecaptchaVerifier();
    throw err;
  }
}

export async function confirmPhoneOtp(confirmation, otp) {
  if (!confirmation?.confirm) {
    throw new Error('OTP session expired. Please request a new code.');
  }
  try {
    const userCredential = await confirmation.confirm(otp);
    const user = userCredential.user;
    const idToken = await user.getIdToken();
    // Register with backend (non-blocking)
    try {
      await verifyFirebaseToken(idToken, user.phoneNumber);
    } catch {
      /* optional */
    }
    return {
      uid: user.uid,
      phoneNumber: user.phoneNumber,
      displayName: user.displayName || 'AaplaKart User',
      email: user.email || '',
      provider: 'firebase',
      idToken,
    };
  } catch (err) {
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('invalid') || msg.includes('expired') || msg.includes('mismatch') || msg.includes('wrong')) {
      throw new Error('Invalid or expired OTP. Please try again.');
    }
    throw err;
  }
}

// ═════════════════════════════════════════════════════════════════
//  Backend REST API Phone OTP
// ═════════════════════════════════════════════════════════════════

export async function sendPhoneOtpViaBackend(phoneNumber) {
  const result = await apiSendOtp(phoneNumber);
  return { sessionInfo: result.session_info };
}

export async function confirmPhoneOtpViaBackend(phoneNumber, otp, sessionInfo) {
  const result = await apiVerifyOtp(phoneNumber, otp, sessionInfo);
  return {
    uid: result.uid,
    phoneNumber: result.phone_number || phoneNumber,
    displayName: result.display_name || 'AaplaKart User',
    email: result.email || '',
    provider: 'sms',
    idToken: result.id_token || '',
  };
}

// ═════════════════════════════════════════════════════════════════
//  Custom SMS OTP (Fast2SMS / Twilio / MSG91)
// ═════════════════════════════════════════════════════════════════

export async function sendCustomSmsOtp(phoneNumber) {
  const base = getApiBase();
  const result = await rawPost(`${base}/auth/send-sms-otp`, { phone_number: phoneNumber });
  return { sessionInfo: result.session_info };
}

export async function confirmCustomSmsOtp(phoneNumber, otp, sessionInfo) {
  const base = getApiBase();
  const result = await rawPost(`${base}/auth/verify-sms-otp`, {
    phone_number: phoneNumber,
    otp,
    session_info: sessionInfo,
  });
  return {
    uid: result.uid,
    phoneNumber: result.phone_number || phoneNumber,
    displayName: result.display_name || 'AaplaKart User',
    email: result.email || '',
    provider: 'sms',
    idToken: result.id_token || '',
  };
}

// ═════════════════════════════════════════════════════════════════
//  Mock OTP (dev mode)
// ═════════════════════════════════════════════════════════════════

export async function sendMockOtp(phoneNumber) {
  return { mockSession: true };
}

export async function confirmMockOtp(phoneNumber, otp) {
  if (otp !== MOCK_OTP_CODE) {
    throw new Error('Invalid OTP. Use ' + MOCK_OTP_CODE + ' in demo mode.');
  }
  return {
    uid: `mock-${Date.now()}`,
    phoneNumber,
    displayName: 'AaplaKart User',
    email: '',
    provider: 'mock',
    idToken: '',
  };
}

// ═════════════════════════════════════════════════════════════════
//  Smart OTP (Auto-selects best method)
// ═════════════════════════════════════════════════════════════════

export async function smartSendOtp(phoneNumber, recaptchaContainerId = 'recaptcha-container') {
  // 1. Mock mode
  if (mockOtpEnabled) {
    const data = await sendMockOtp(phoneNumber);
    return { method: 'mock', data };
  }
  // 2. Custom SMS provider
  try {
    const data = await sendCustomSmsOtp(phoneNumber);
    return { method: 'sms', data };
  } catch {
    /* fall through */
  }
  // 3. Backend Firebase REST API
  try {
    const data = await sendPhoneOtpViaBackend(phoneNumber);
    return { method: 'backend', data };
  } catch {
    /* fall through */
  }
  // 4. Firebase Client SDK
  try {
    const data = await sendPhoneOtp(phoneNumber, recaptchaContainerId);
    return { method: 'firebase-sdk', data };
  } catch {
    /* fall through */
  }
  // 5. Auto-fallback to mock
  const data = await sendMockOtp(phoneNumber);
  return { method: 'mock', data };
}

export async function smartConfirmOtp(method, data, phoneNumber, otp) {
  switch (method) {
    case 'mock':
      return confirmMockOtp(phoneNumber, otp);
    case 'sms':
      return confirmCustomSmsOtp(phoneNumber, otp, data.sessionInfo);
    case 'backend': {
      const session = await confirmPhoneOtpViaBackend(phoneNumber, otp, data.sessionInfo);
      try {
        const result = await simpleLogin(session.phoneNumber, session.displayName, session.email);
        if (result.id_token) setAuthToken(result.id_token);
      } catch {
        /* ignore */
      }
      return session;
    }
    case 'firebase-sdk':
      return confirmPhoneOtp(data, otp);
    default:
      throw new Error('Unknown OTP method: ' + method);
  }
}

// ═════════════════════════════════════════════════════════════════
//  Mock / Simple Login (dev mode)
// ═════════════════════════════════════════════════════════════════

export async function loginWithMock(phoneNumber, displayName = '', email = '') {
  const result = await simpleLogin(phoneNumber, displayName, email);
  return {
    uid: result.uid,
    phoneNumber: result.phone_number || phoneNumber,
    displayName: result.display_name || displayName || 'AaplaKart User',
    email: email || '',
    provider: 'mock',
    idToken: result.id_token || '',
  };
}

// ═════════════════════════════════════════════════════════════════
//  Backend Registration (post-login)
// ═════════════════════════════════════════════════════════════════

export async function registerWithBackend(session) {
  const alreadyRegistered = ['firebase', 'email'].includes(session.provider);
  if (alreadyRegistered) return session;

  try {
    const result = await simpleLogin(
      session.phoneNumber || '',
      session.displayName || '',
      session.email || '',
    );
    if (result.id_token) {
      setAuthToken(result.id_token);
      session.uid = result.uid;
    }
  } catch {
    /* non-blocking */
  }
  return session;
}
