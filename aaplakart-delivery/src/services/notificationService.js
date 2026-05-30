/**
 * Notification Service — sound + vibration for new orders.
 * Uses expo-av for sound. Falls back silently if unavailable.
 */
import { Vibration } from 'react-native';

let _sound = null;
let _loaded = false;

/** Preload the notification sound */
export async function initNotificationSound() {
  try {
    const { Audio } = require('expo-av');
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://cdn.jsdelivr.net/npm/@expo/vector-icons@latest/builtins/notification.wav' },
      { shouldPlay: false }
    );
    _sound = sound;
    _loaded = true;
  } catch {
    _loaded = false;
  }
}

/** Play notification sound + vibrate */
export async function playNewOrderAlert() {
  try {
    Vibration.vibrate([0, 200, 100, 200]); // pattern: wait, vibrate, wait, vibrate
    if (_loaded && _sound) {
      await _sound.replayAsync();
    }
  } catch {}
}

/** Cleanup sound */
export async function cleanupNotificationSound() {
  if (_sound) {
    try { await _sound.unloadAsync(); } catch {}
    _sound = null;
    _loaded = false;
  }
}
