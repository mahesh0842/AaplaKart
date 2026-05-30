import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OrderCard from '../components/OrderCard';
import { COLORS } from '../utils/constants';
import { useDeliveryStore } from '../store/deliveryStore';

const FILTERS = [
  { key: 'active', label: 'Active', icon: 'bicycle' },
  { key: 'accepted', label: 'My Orders', icon: 'checkmark-circle' },
  { key: 'delivered', label: 'Delivered', icon: 'time' },
];

export default function OrdersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const orders = useDeliveryStore((s) => s.orders);
  const acceptedIds = useDeliveryStore((s) => s.acceptedIds);
  const loadOrders = useDeliveryStore((s) => s.loadOrders);
  const acceptOrder = useDeliveryStore((s) => s.acceptOrder);
  const rejectOrder = useDeliveryStore((s) => s.rejectOrder);
  const releaseOrder = useDeliveryStore((s) => s.releaseOrder);
  const [filter, setFilter] = useState('active');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadOrders(); }, []);

  const onRefresh = useCallback(async () => { setRefreshing(true); await loadOrders(); setRefreshing(false); }, [loadOrders]);

  const filtered = useMemo(() => {
    if (filter === 'accepted') return orders.filter(o => acceptedIds.has(o.id) && o.status !== 'cancelled');
    if (filter === 'delivered') return orders.filter(o => o.status === 'delivered');
    return orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
  }, [orders, acceptedIds, filter]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>{filtered.length} orders</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} style={[styles.filterBtn, filter === f.key && styles.filterActive]} onPress={() => setFilter(f.key)}>
            <Ionicons name={f.icon} size={14} color={filter === f.key ? '#fff' : COLORS.mutedText} />
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="bicycle-outline" size={48} color={COLORS.mutedText} />
            <Text style={styles.emptyTitle}>No orders</Text>
            <Text style={styles.emptySub}>{filter === 'delivered' ? 'No delivered orders yet' : 'New orders will appear here'}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isAccepted = acceptedIds.has(item.id);
          return (
            <OrderCard
              order={item}
              accepted={isAccepted}
              onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
              onAccept={!isAccepted && item.status === 'pending' ? acceptOrder : undefined}
              onReject={!isAccepted && item.status === 'pending' ? rejectOrder : undefined}
              onRelease={isAccepted ? () => releaseOrder(item.id) : undefined}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.mutedText, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: '#fde6cf' },
  filterActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.mutedText },
  filterTextActive: { color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 12 },
  emptySub: { fontSize: 13, color: COLORS.mutedText, marginTop: 6, textAlign: 'center' },
});
