import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OrderCard from '../components/OrderCard';
import { COLORS } from '../utils/constants';
import { useDeliveryStore } from '../store/deliveryStore';
import { startPolling } from '../services/realtime';

const AssignedOrdersScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const orders = useDeliveryStore((s) => s.orders);
  const loadOrders = useDeliveryStore((s) => s.loadOrders);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadOrders(); return startPolling(5000); }, []);

  const onRefresh = async () => { setRefreshing(true); await loadOrders(); setRefreshing(false); };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>All Orders</Text>
        <Text style={styles.subtitle}>{orders.length} order(s)</Text>
      </View>
      <FlatList
        data={orders} keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<View style={{ alignItems: 'center', paddingVertical: 60 }}><Text style={{ fontSize: 15, color: COLORS.mutedText, fontWeight: '600' }}>No orders</Text></View>}
        renderItem={({ item }) => <OrderCard order={item} onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.mutedText, marginTop: 4 },
});

export default AssignedOrdersScreen;
