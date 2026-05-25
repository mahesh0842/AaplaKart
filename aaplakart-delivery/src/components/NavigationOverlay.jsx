// ── In-App Navigation Overlay (MapMyIndia/Mappls Turn-by-Turn) ──
// Opens when partner clicks "Navigate" — full-screen driving UI
// with voice guidance, ETA, stop navigation buttons
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../utils/constants';

// ── Try to load Mappls Direction Widget ─────────────────────────
let MapplsDirectionWidget = null;
try {
  MapplsDirectionWidget = require('mappls-direction-widget-react-native').default;
} catch {}

const NavigationOverlay = ({ visible, onClose, origin, destination, address }) => {
  const insets = useSafeAreaInsets();
  const [starting, setStarting] = useState(false);
  const [navFailed, setNavFailed] = useState(false);

  useEffect(() => {
    if (visible && destination) {
      setStarting(true);
      setNavFailed(false);
    }
  }, [visible, destination]);

  if (!visible) return null;

  // ── If Direction Widget not available → fallback to external maps ──
  const openExternalNav = () => {
    const dest = `${destination.latitude},${destination.longitude}`;
    const url = Platform.select({
      ios: `maps://app?daddr=${dest}`,
      android: `google.navigation:q=${dest}`,
    });
    const fallback = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    Linking.canOpenURL(url).then((ok) => Linking.openURL(ok ? url : fallback)).catch(() => Linking.openURL(fallback));
    onClose();
  };

  // ── Mappls Direction Widget available → in-app navigation ─────────
  if (MapplsDirectionWidget) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.topTitle}>Navigation</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Direction Widget takes over full screen */}
        <View style={{ flex: 1 }}>
          <MapplsDirectionWidget
            destination={{
              longitude: destination.longitude,
              latitude: destination.latitude,
              name: address || 'Delivery',
              address: address || '',
            }}
            source={origin ? {
              longitude: origin.longitude,
              latitude: origin.latitude,
              name: 'Shop',
              address: '',
            } : undefined}
            profile="driving"
            resource="route_eta"
            showStartNavigation={true}
            showAlternative={false}
            style={{ flex: 1 }}
            onStartNavigation={() => setStarting(false)}
            onRouteResponse={(data) => {
              setStarting(false);
            }}
            onError={(err) => {
              setNavFailed(true);
              setStarting(false);
            }}
          />
        </View>

        {/* Bottom action bar */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <Pressable onPress={onClose} style={styles.stopBtn}>
            <Ionicons name="stop-circle-outline" size={20} color="#fff" />
            <Text style={styles.stopBtnText}>Stop Navigation</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Fallback: Starting state / loading ────────────────────────────
  if (starting && !navFailed) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Starting navigation...</Text>
          <Text style={styles.loadingSub}>Using Mappls SDK</Text>
        </View>
      </View>
    );
  }

  // ── Fallback: No SDK → external nav ──────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Pressable onPress={onClose} style={styles.closeBtn}>
        <Ionicons name="close" size={24} color="#fff" />
      </Pressable>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 }}>
        <Ionicons name="map-outline" size={56} color={COLORS.primary} />
        <Text style={styles.fallbackTitle}>Open in Maps?</Text>
        <Text style={styles.fallbackText}>
          In-app navigation not available. Open Google Maps for turn-by-turn directions?
        </Text>
        <Pressable onPress={openExternalNav} style={styles.openBtn}>
          <Ionicons name="navigate" size={18} color="#fff" />
          <Text style={styles.openBtnText}>Open Google Maps</Text>
        </Pressable>
        <Pressable onPress={onClose} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1a1a2e', zIndex: 9999 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.3)' },
  closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  bottomBar: { backgroundColor: '#1a1a2e', paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#333' },
  stopBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#ef4444', borderRadius: 14, paddingVertical: 14 },
  stopBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  loadingText: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 16 },
  loadingSub: { color: '#94a3b8', fontSize: 13, marginTop: 6 },
  fallbackTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 16 },
  fallbackText: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, marginTop: 24 },
  openBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cancelBtn: { marginTop: 16, paddingVertical: 12 },
  cancelText: { color: '#94a3b8', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});

export default NavigationOverlay;
