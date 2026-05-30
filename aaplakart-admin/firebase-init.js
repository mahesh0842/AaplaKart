// ── Firebase Init (Firestore direct read/write) ──
const firebaseConfig = {
  apiKey: 'AIzaSyAFVEbPpNJLEGubs2Zk56YcTQVvdXIiAhs',
  authDomain: 'aaplakart.firebaseapp.com',
  projectId: 'aaplakart',
  appId: '1:624909896040:android:e8acafa51342e9d3c5eedd'
};
firebase.initializeApp(firebaseConfig);
const firestore = firebase.firestore();

// ── Firestore timeout helper (avoids hanging the UI) ──
async function fsWithTimeout(promise, ms = 2000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), ms))
  ]);
}
