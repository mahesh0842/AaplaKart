// GUI category: App services. Google Sign-In using Expo's built-in Google provider.
// Uses expo-auth-session/providers/google which handles redirect URIs automatically
// - In Expo Go: uses the avd-exp:// or exp:// scheme (no HTTPS needed)
// - In standalone: uses the app's custom scheme (aaplakart://)
// The Google ID token is sent to our backend (/api/auth/google) for verification
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { googleSignIn } from './api';

WebBrowser.maybeCompleteAuthSession();

// ── OAuth Configuration ──────────────────────────────────────────
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
  || '';

const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
  || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
  || '';

const hasClientId = Boolean(WEB_CLIENT_ID) || Boolean(ANDROID_CLIENT_ID);

/**
 * Decode a JWT payload (base64 decode without verification).
 * The actual verification happens on the backend.
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

// ── Hook ─────────────────────────────────────────────────────────

/**
 * Custom hook that wraps Expo's Google.useAuthRequest.
 * Handles the redirect URI automatically for Expo Go and standalone builds.
 * Returns { request, response, promptAsync } for backward compatibility.
 */
export const useGoogleAuth = () => {
  // Provide androidClientId to prevent crash on Android
  const config = {
    webClientId: WEB_CLIENT_ID,
    selectAccount: true,
  };
  if (ANDROID_CLIENT_ID) {
    config.androidClientId = ANDROID_CLIENT_ID;
  }

  let request, response, promptAsync;
  try {
    [request, response, promptAsync] = Google.useAuthRequest(config);
  } catch (e) {
    // If Google auth hook fails (e.g., missing platform-specific client ID),
    // provide a no-op promptAsync so the UI doesn't crash
    console.warn('[googleAuth] useAuthRequest init failed:', e?.message);
    promptAsync = async () => ({ type: 'error', error: new Error('Google auth configuration error: ' + e.message) });
  }

  return {
    request: hasClientId ? (request || null) : null,
    response,
    promptAsync: async () => {
      if (!hasClientId) {
        return { type: 'error', error: new Error('Google client ID not configured') };
      }

      try {
        const result = await promptAsync();

        console.log('[googleAuth] Auth result type:', result?.type);

        if (result?.type === 'cancel' || result?.type === 'dismiss') {
          return { type: 'cancel' };
        }

        if (result?.type === 'error') {
          console.log('[googleAuth] Error:', result?.error?.message || result?.params?.error_description);
          return { type: 'error', error: result.error };
        }

        if (result?.type === 'success') {
          const { idToken, accessToken } = result.params || {};

          if (!idToken) {
            return { type: 'error', error: new Error('No ID token received from Google') };
          }

          // Decode the id_token to get email/name
          const userInfo = decodeJwtPayload(idToken);

          return {
            type: 'success',
            params: {
              idToken,
              email: userInfo.email || '',
              name: userInfo.name || '',
              accessToken,
            },
          };
        }

        return { type: 'error', error: new Error('Unexpected Google Sign-In result') };
      } catch (error) {
        console.log('[googleAuth] Error:', error?.message);
        return { type: 'error', error };
      }
    },
  };
};

/**
 * Handle the Google sign-in response by sending the ID token to our backend.
 * The backend verifies the token and creates/finds the user by email.
 *
 * @param {object} authResult - { type: 'success', params: { idToken, email, name } }
 * @returns {object} { success, uid, email, displayName, isNewUser, cancelled }
 */
export const handleGoogleSignInResponse = async (authResult) => {
  if (!authResult || authResult.type === 'cancel' || authResult.type === 'dismiss') {
    return { success: false, cancelled: true };
  }

  if (authResult.type === 'error') {
    return {
      success: false,
      cancelled: false,
      message: authResult.error?.message || 'Google Sign-In failed',
    };
  }

  const { idToken, email, name } = authResult.params || {};

  if (!idToken) {
    return { success: false, cancelled: false, message: 'No ID token received from Google' };
  }

  try {
    // Send Google ID token to our backend for verification & user creation
    const result = await googleSignIn(idToken, name || '', '');

    if (!result.success) {
      return { success: false, cancelled: false, message: result.message || 'Backend verification failed' };
    }

    return {
      success: true,
      cancelled: false,
      provider: 'google',
      uid: result.uid,
      email: email || '',
      displayName: name || '',
      phoneNumber: result.phone_number || '',
      isNewUser: result.is_new_user || false,
    };
  } catch (error) {
    console.error('[googleAuth] Backend verification error:', error);
    return {
      success: false,
      cancelled: false,
      message: error?.message || 'Could not complete Google Sign-In',
    };
  }
};

