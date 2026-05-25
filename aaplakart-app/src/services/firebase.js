// GUI category: App services. Initializes Firebase Auth and Storage with Expo-friendly persistence.
// Wraps initialization in try-catch to prevent app crashes when Firebase config is incomplete.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const hasRequiredConfig = Object.values(firebaseConfig).every(Boolean);
const isPlaceholder = (val) => !val || val.includes('YOUR_') || val.includes('your-');
const hasValidConfig = hasRequiredConfig && !isPlaceholder(firebaseConfig.appId) && !isPlaceholder(firebaseConfig.apiKey);

export const firebaseReady = hasValidConfig;
export const mockOtpEnabled = process.env.EXPO_PUBLIC_USE_MOCK_OTP === 'true';

let appInstance = null;
let authInstance = null;
let storageInstance = null;

function initFirebase() {
  if (!firebaseReady) {
    console.log('[Firebase] Config incomplete or has placeholder values — skipping init.');
    return;
  }

  try {
    appInstance = getApps().length ? getApp() : initializeApp(firebaseConfig);

    if (Platform.OS === 'web') {
      authInstance = getAuth(appInstance);
    } else {
      try {
        authInstance = initializeAuth(appInstance, {
          persistence: getReactNativePersistence(AsyncStorage),
        });
      } catch (error) {
        console.log('[Firebase] initializeAuth failed, falling back to getAuth:', error?.message);
        authInstance = getAuth(appInstance);
      }
    }

    storageInstance = getStorage(appInstance);
    console.log('[Firebase] Initialized successfully for project:', firebaseConfig.projectId);
  } catch (error) {
    console.log('[Firebase] Init failed — auth features disabled:', error?.message);
    appInstance = null;
    authInstance = null;
    storageInstance = null;
  }
}

initFirebase();

export const app = appInstance;
export const auth = authInstance;
export const storage = storageInstance;

