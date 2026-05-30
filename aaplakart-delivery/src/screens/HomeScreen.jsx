import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OrderCard from '../components/OrderCard';
import ActionButton from '../components/ActionButton';
import EarningsCard from '../components/EarningsCard';
import DeliveryProofModal from '../components/DeliveryProofModal';
import { COLORS } from '../utils/constants';
import { useDeliveryStore } from '../store/deliveryStore';
import { useAuthStore } from '../store/authStore';
import { startRealtime } from '../services/websocketService';
import { initNotificationSound, playNewOrderAlert } from '../services/notificationService';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const orders = useDeliveryStore((s) => s.orders);
  const acceptedIds = useDeliveryStore((s) => s.acceptedIds);
  const loadOrders = useDeliveryStore((s) => s.loadOrders);
  const isLoading = useDeliveryStore((s) => s.isLoading);
  const acceptOrder = useDeliveryStore((s) => s.acceptOrder);
  const releaseOrder = useDeliveryStore((s) => s.releaseOrder);
  const logout = useAuthStore((s) => s.logout);
  const partnerName = useAuthStore((s) => s.user?.displayName || 'Partner');
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    initNotificationSound();
    useDeliveryStore.getState().initAccepted();
    useDeliveryStore.getState().loadShop();
    loadOrders();
    return startRealtime(10000);
  }, []);

  const onRefresh = useCallback(async () => { setRefreshing(true); await loadOrders(); setRefreshing(false); }, [loadOrders]);

  const accepted = useMemo(() => orders.filter(o => acceptedIds.has(o.id) && o.status !== 'delivered' && o.status !== 'cancelled'), [orders, acceptedIds]);
  const available = useMemo(() => orders.filter(o => !acceptedIds.has(o.id) && o.status !== 'delivered' && o.status !== 'cancelled'), [orders, acceptedIds]);
  const delivered = useMemo(() => orders.filter(o => o.status === 'delivered'), [orders]);

  const todayEarnings = useMemo(() => delivered.reduce((sum, o) => sum + Number(o.total || 0), 0), [delivered]);
  const [proofOrder, setProofOrder] = useState(null);

  const handleAccept = useCallback(async (orderId) => {
    await acceptOrder(orderId);
  }, [acceptOrder]);

  const handleReject = useCallback(async (orderId) => {
    await releaseOrder(orderId);
  }, [releaseOrder]);

  const handleDeliveryProof = useCallback((orderId) => {
    setProofOrder(orderId);
  }, []);

  const handleProofConfirm = useCallback(async (photo) => {
    if (proofOrder) {
      await releaseOrder(proofOrder);
    }
    setProofOrder(null);
  }, [proofOrder, releaseOrder]);

  // Play sound when new available orders appear (MUST be after available is defined)
  const prevCount = useRef(0);
  useEffect(() => {
    if (available.length > prevCount.current) {
      playNewOrderAlert();
    }
    prevCount.current = available.length;
  }, [available.length]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {partnerName}</Text>
          <Text style={styles.subtitle}>{accepted.length} active · {available.length} available</Text>
        </View>
        <Pressable onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.dangerText} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Online/Offline Toggle */}
        <Pressable style={[styles.toggle, online ? styles.toggleOn : styles.toggleOff]} onPress={() => setOnline(!online)}>
          <View style={[styles.toggleDot, online ? styles.toggleDotOn : styles.toggleDotOff]} />
          <Text style={[styles.toggleText, { color: online ? '#fff' : COLORS.mutedText }]}>
            {online ? '🟢 Online — Accepting Orders' : '🔴 Offline — Paused'}
          </Text>
        </Pressable>

        {/* Earnings Summary */}
        <EarningsCard today={todayEarnings} week={todayEarnings * 5} deliveries={delivered.length} km={delivered.length * 3} />

        {/* My Deliveries */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>My Deliveries ({accepted.length})</Text>
          <Pressable onPress={() => navigation.navigate('OrdersTab')}><Text style={styles.viewAll}>View All</Text></Pressable>
        </View>
        {accepted.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="bicycle-outline" size={48} color={COLORS.mutedText} />
            <Text style={styles.emptyTitle}>No active deliveries</Text>
            <Text style={styles.emptySub}>Accept orders from below to start delivering.</Text>
          </View>
        ) : accepted.map((o) => (
          <OrderCard key={o.id} order={o} accepted onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })} onRelease={() => releaseOrder(o.id)} />
        ))}

        {/* Available Orders */}
        {available.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Available ({available.length})</Text>
            {available.slice(0, 5).map((o) => (
              <OrderCard key={o.id} order={o} onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })} onAccept={handleAccept} onReject={handleReject} />
            ))}
            {available.length > 5 && (
              <ActionButton label={`View ${available.length} Available Orders`} variant="secondary" style={{ marginTop: 4 }} onPress={() => navigation.navigate('OrdersTab')} />
            )}
          </>
        )}
      </ScrollView>

      <DeliveryProofModal
        visible={!!proofOrder}
        onClose={() => setProofOrder(null)}
        onConfirm={handleProofConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  greeting: { fontSize: 20, fontWeight: '900', color: COLORS.text },
  subtitle: { fontSize: 12, color: COLORS.mutedText, marginTop: 2 },
  logoutBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 30 },
  
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 12, marginBottom: 16 },
  toggleOn: { backgroundColor: COLORS.accent },
  toggleOff: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: '#fde6cf' },
  toggleDot: { width: 10, height: 10, borderRadius: 5 },
  toggleDotOn: { backgroundColor: '#fff' },
  toggleDotOff: { backgroundColor: '#ccc' },
  toggleText: { fontSize: 14, fontWeight: '700' },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  viewAll: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  
  empty: { alignItems: 'center', paddingVertical: 30, backgroundColor: COLORS.card, borderRadius: 18, borderWidth: 1, borderColor: '#fde6cf', marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginTop: 8 },
  emptySub: { fontSize: 12, color: COLORS.mutedText, marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },
});
