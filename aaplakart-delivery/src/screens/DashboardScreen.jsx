import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OrderCard from '../components/OrderCard';
import ActionButton from '../components/ActionButton';
import { COLORS, SHOP_LOCATION } from '../utils/constants';
import { useDeliveryStore } from '../store/deliveryStore';
import { useAuthStore } from '../store/authStore';
import { startPolling } from '../services/realtime';

const DashboardScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const orders = useDeliveryStore((s) => s.orders);
  const loadOrders = useDeliveryStore((s) => s.loadOrders);
  const logout = useAuthStore((s) => s.logout);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    useDeliveryStore.getState().loadShop();
    loadOrders();
    return startPolling(5000);
  }, []);

  const onRefresh = async () => { setRefreshing(true); await loadOrders(); setRefreshing(false); };
  const activeOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>Real-time — updates every 5s</Text>
        </View>
        <Ionicons name="log-out-outline" size={24} color={COLORS.dangerText} onPress={logout} />
      </View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.statsRow}>
          {[
            { icon: 'bicycle', value: activeOrders.length, label: 'Active', color: COLORS.primary },
            { icon: 'checkmark-circle', value: deliveredCount, label: 'Delivered', color: COLORS.accent },
            { icon: 'time-outline', value: orders.length, label: 'Total', color: COLORS.warningText },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Ionicons name={s.icon} size={22} color={s.color} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.row}>
          <Text style={styles.sectionTitle}>Active ({activeOrders.length})</Text>
          <ActionButton label="All Orders" variant="secondary" style={{ paddingVertical: 8, paddingHorizontal: 12 }} onPress={() => navigation.navigate('AssignedOrders')} />
        </View>
        {activeOrders.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="bicycle-outline" size={56} color={COLORS.mutedText} />
            <Text style={styles.emptyTitle}>No active deliveries</Text>
            <Text style={styles.emptySub}>New orders appear here automatically.</Text>
          </View>
        ) : activeOrders.map((o) => (
          <OrderCard key={o.id} order={o} onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })} />
        ))}
        {deliveredCount > 0 && (
          <><Text style={[styles.sectionTitle, { marginTop: 12 }]}>Recent</Text>
          {orders.filter((o) => o.status === 'delivered').slice(0, 3).map((o) => (
            <OrderCard key={o.id} order={o} onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })} />
          ))}</>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.text },
  subtitle: { fontSize: 12, color: COLORS.mutedText, marginTop: 2 },
  content: { paddingHorizontal: 20, paddingBottom: 30 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 18, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#fde6cf' },
  statValue: { fontSize: 22, fontWeight: '900', color: COLORS.text, marginTop: 6 },
  statLabel: { fontSize: 11, color: COLORS.mutedText, fontWeight: '600', marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 12 },
  emptySub: { fontSize: 13, color: COLORS.mutedText, marginTop: 6, textAlign: 'center' },
});

export default DashboardScreen;
