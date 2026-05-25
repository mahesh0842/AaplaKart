import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import StatusBadge from '../components/StatusBadge';
import ActionButton from '../components/ActionButton';
import DeliveryMap from '../components/DeliveryMap';
import NavigationOverlay from '../components/NavigationOverlay';
import { COLORS, STATUS_LABELS, STATUS_FLOW } from '../utils/constants';
import { useDeliveryStore } from '../store/deliveryStore';
import { fetchOrderDetail } from '../services/api';

const OrderDetailScreen = ({ route, navigation }) => {
  const { orderId } = route.params;
  const insets = useSafeAreaInsets();
  const storeOrders = useDeliveryStore((s) => s.orders);
  const updateStatus = useDeliveryStore((s) => s.updateStatus);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [navigationVisible, setNavigationVisible] = useState(false);

  useEffect(() => {
    const local = storeOrders.find((o) => o.id === orderId);
    if (local) setOrder(local);
    else fetchOrderDetail(orderId).then(setOrder).catch(() => {});
  }, [orderId, storeOrders]);

  if (!order) return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Ionicons name="chevron-back" size={24} color={COLORS.text} onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Order</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: COLORS.mutedText }}>Loading...</Text>
      </View>
    </View>
  );

  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;
  const handleNext = async () => {
    if (!nextStatus) return;
    setLoading(true);
    const result = await updateStatus(order.id, nextStatus);
    setLoading(false);
    if (result.success) {
      Toast.show({ type: 'success', text1: `Order ${STATUS_LABELS[nextStatus]}` });
      setOrder({ ...order, status: nextStatus });
      if (nextStatus === 'delivered') setTimeout(() => navigation.goBack(), 1000);
    } else Toast.show({ type: 'error', text1: 'Failed', text2: result.error });
  };

  const items = order.items || [];
  const itemCount = items.reduce((sum, i) => sum + (i.quantity || 0), 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Ionicons name="chevron-back" size={24} color={COLORS.text} onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Order #{order.id}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 16 }}><StatusBadge status={order.status} /></View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <View style={styles.addressCard}>
            <Ionicons name="location" size={18} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLine}>{order.address_line1 || order.address?.line1 || ''}</Text>
              {order.address_landmark ? <Text style={styles.addressSub}>{order.address_landmark}</Text> : null}
              <Text style={styles.addressSub}>{order.address_city || order.address?.city || ''} - {order.address_pincode || order.address?.pincode || ''}</Text>
              <Text style={styles.addressName}>{order.address_full_name || order.address?.fullName || ''} • {order.address_phone || order.address?.phone || ''}</Text>
            </View>
          </View>

          {/* Build full address string for map & navigation */}
          {(() => {
            const fullAddress = [
              order.address_line1,
              order.address_landmark,
              order.address_city,
              order.address_pincode,
            ].filter(Boolean).join(', ');
            return (
              <DeliveryMap
                latitude={order.address_latitude || 19.076}
                longitude={order.address_longitude || 72.8777}
                address={fullAddress}
                customerName={order.address_full_name || ''}
                customerPhone={order.address_phone || ''}
                status={order.status}
                distanceFromShop={order.distanceFromShop}
              />
            );
          })()}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items ({itemCount})</Text>
          {items.map((item) => (
            <View key={item.product_id || item.name} style={styles.itemRow}>
              <Text style={styles.itemQty}>{item.quantity}x</Text>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text }} numberOfLines={1}>{item.name}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>₹{Number(item.price * item.quantity).toFixed(0)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          {[
            { label: 'Subtotal', value: `₹${Number(order.subtotal || 0).toFixed(0)}` },
            { label: 'Delivery', value: order.delivery_fee === 0 || order.deliveryFee === 0 ? 'FREE' : `₹${Number(order.delivery_fee || order.deliveryFee || 0).toFixed(0)}` },
            { label: 'Total', value: `₹${Number(order.total || 0).toFixed(0)}`, bold: true },
          ].map((r) => (
            <View key={r.label} style={[styles.sumRow, r.bold && styles.sumBold]}>
              <Text style={[styles.sumLabel, r.bold && styles.sumLabelBold]}>{r.label}</Text>
              <Text style={[styles.sumValue, r.bold && styles.sumValueBold]}>{r.value}</Text>
            </View>
          ))}
          <View style={styles.payBadge}>
            <Text style={styles.payText}>{order.payment_method?.toUpperCase()}</Text>
          </View>
        </View>
      </ScrollView>
      {nextStatus && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          {order.status === 'out-for-delivery' ? (
            /* ═══ Two buttons: Navigate + Mark Delivered ═══ */
            <>
              <ActionButton
                label="🗺️ Navigate"
                variant="secondary"
                style={{ marginBottom: 8 }}
                onPress={() => setNavigationVisible(true)}
              />
              <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.mutedText, marginBottom: 8, textAlign: 'center' }}>Reached? Mark as delivered</Text>
              <ActionButton label="✅ Mark Delivered" onPress={handleNext} loading={loading} />
            </>
          ) : (
            /* ═══ Single button for other statuses ═══ */
            <>
              <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.mutedText, marginBottom: 8, textAlign: 'center' }}>Next: {STATUS_LABELS[nextStatus]}</Text>
              <ActionButton label={`🚀 ${STATUS_LABELS[nextStatus]}`} onPress={handleNext} loading={loading} />
            </>
          )}
        </View>
      )}

      {/* ═══ In-App Navigation Overlay ═══ */}
      <NavigationOverlay
        visible={navigationVisible}
        onClose={() => setNavigationVisible(false)}
        origin={order.address_latitude ? { latitude: 19.076, longitude: 72.8777 } : null}
        destination={{ latitude: order.address_latitude || 19.076, longitude: order.address_longitude || 72.8777 }}
        address={[order.address_line1, order.address_landmark, order.address_city, order.address_pincode].filter(Boolean).join(', ')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  content: { paddingHorizontal: 20, paddingBottom: 140 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  addressCard: { flexDirection: 'row', gap: 10, backgroundColor: COLORS.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#fde6cf' },
  addressLine: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  addressSub: { fontSize: 12, color: COLORS.mutedText, marginTop: 2 },
  addressName: { fontSize: 12, fontWeight: '600', color: COLORS.primary, marginTop: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#fde6cf' },
  itemQty: { fontSize: 14, fontWeight: '800', color: COLORS.primary, minWidth: 28 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sumLabel: { fontSize: 14, color: COLORS.mutedText },
  sumValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  sumBold: { borderTopWidth: 1, borderTopColor: '#fde6cf', paddingTop: 8 },
  sumLabelBold: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  sumValueBold: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  payBadge: { alignSelf: 'flex-start', backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  payText: { fontSize: 11, fontWeight: '700', color: COLORS.accent },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.card, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#fde6cf' },
});

export default OrderDetailScreen;
