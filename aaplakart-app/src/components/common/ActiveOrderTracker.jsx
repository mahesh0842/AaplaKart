import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOrdersStore } from '../../store/ordersStore';

const STEPS = [
  { key: 'pending', label: 'Placed', icon: 'document-text', color: '#f97316' },
  { key: 'confirmed', label: 'Confirmed', icon: 'checkmark-circle', color: '#2563eb' },
  { key: 'preparing', label: 'Preparing', icon: 'flame', color: '#16a34a' },
  { key: 'out-for-delivery', label: 'On Way', icon: 'bicycle', color: '#7c3aed' },
  { key: 'delivered', label: 'Delivered', icon: 'checkmark-done', color: '#15803d' },
];
const KEYS = STEPS.map(x => x.key);
const DISAPPEAR_AFTER_DELIVERED = 45_000; // 45 seconds silently

export default function ActiveOrderTracker() {
  const orders = useOrdersStore(s => s.orders);
  const [hideDelivered, setHideDelivered] = useState(false);
  const hideTimerRef = useRef(null);

  // Find most recent trackable order with strict rules:
  // 1. NOT cancelled
  // 2. Has items AND total > 0
  // 3. Has backendId OR placed within last 5 min (prevents stale local-only orders)
  // 4. If delivered: must have been delivered within last 45 seconds
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const fortyFiveSecAgo = Date.now() - DISAPPEAR_AFTER_DELIVERED;
  const trackable = orders.find(o => {
    if (o.status === 'cancelled') return false;
    if (!(o.items?.length > 0 && Number(o.total || 0) > 0)) return false;
    if (!o.backendId && new Date(o.placedAt || o.placed_at || 0).getTime() <= fiveMinAgo) return false;
    // Delivered: only show if delivered within last 45 seconds
    if (o.status === 'delivered') {
      const deliveredAt = o.updatedAt || o.updated_at || o.placedAt || o.placed_at;
      if (deliveredAt && new Date(deliveredAt).getTime() < fortyFiveSecAgo) return false;
    }
    return true;
  });

  const currentStatus = trackable?.status || null;

  // ── Auto-hide: when delivered, start 45s timer to hide from UI ──
  useEffect(() => {
    if (currentStatus !== 'delivered') {
      setHideDelivered(false);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      return;
    }
    // Start fresh 45s timer
    setHideDelivered(false);
    hideTimerRef.current = setTimeout(() => {
      setHideDelivered(true);
    }, DISAPPEAR_AFTER_DELIVERED);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [currentStatus, trackable?.id]);

  // ── Visibility ──
  const showTracker = trackable && !(currentStatus === 'delivered' && hideDelivered);

  const idx = trackable ? KEYS.indexOf(trackable.status) : -1;
  const w = useRef(new Animated.Value(0)).current;
  const borderAnim = useRef(new Animated.Value(0)).current;

  // Animate progress bar + border glow
  useEffect(() => {
    if (showTracker && idx >= 0) {
      Animated.timing(w, {
        toValue: (idx / (STEPS.length - 1)) * 100,
        duration: 800,
        useNativeDriver: false,
      }).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(borderAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
          Animated.timing(borderAnim, { toValue: 0, duration: 1500, useNativeDriver: false }),
        ])
      ).start();
    } else {
      w.setValue(0);
      borderAnim.setValue(0);
      borderAnim.stopAnimation();
    }
  }, [showTracker, idx]);

  if (!showTracker || idx < 0) return null;

  const step = STEPS[idx] || STEPS[0];
  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [step.color + '40', step.color],
  });

  return (
    <Animated.View style={s.wrap}>
      <Animated.View style={[s.row, { borderColor }]}>
        <Ionicons name={step.icon} size={14} color={step.color} />
        <Text style={s.label}>{step.label}</Text>
        <View style={s.barBg}>
          <Animated.View style={[s.barFill, {
            width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            backgroundColor: step.color,
          }]} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginBottom: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#f3d2b2',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  label: { fontSize: 13, fontWeight: '700', color: '#1f2937' },
  barBg: { flex: 1, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
});
