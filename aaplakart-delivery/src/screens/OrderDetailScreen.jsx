import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import StatusBadge from '../components/StatusBadge';
import ActionButton from '../components/ActionButton';
import DeliveryMap from '../components/DeliveryMap';
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

  const openMaps = () => {
    const lat = order?.address_latitude;
    const lng = order?.address_longitude;
    if (!lat || !lng) {
      Toast.show({ type: 'error', text1: 'No GPS location', text2: 'Customer did not provide GPS. Call them.' });
      return;
    }
    const dest = `${lat},${lng}`;
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(order?.address_line1 || 'Delivery')}@${dest}`,
      android: `geo:0,0?q=${dest}(${encodeURIComponent(order?.address_line1 || 'Delivery')})`,
    });
    const fallback = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    Linking.canOpenURL(url).then((ok) => Linking.openURL(ok ? url : fallback)).catch(() => Linking.openURL(fallback));
  };

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
      Toast.show({ type: 'success', text1: `✅ ${STATUS_LABELS[nextStatus]}`, text2: `Order #${order.id}` });
      setOrder({ ...order, status: nextStatus });
      if (nextStatus === 'delivered') setTimeout(() => navigation.goBack(), 1200);
    } else {
      Toast.show({ type: 'error', text1: 'Failed', text2: result.error });
    }
  };

  const items = order.items || [];
  const itemCount = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const fullAddress = [order.address_line1, order.address_landmark, order.address_city, order.address_pincode].filter(Boolean).join(', ');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="chevron-back" size={24} color={COLORS.text} onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Order #{order.id}</Text>
        <StatusBadge status={order.status} size="sm" />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Customer Card */}
        <View style={styles.customerCard}>
          <View style={styles.customerRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.customerName}>{order.address_full_name || 'Customer'}</Text>
              <Text style={styles.customerPhone}>{order.address_phone || 'No phone'}</Text>
            </View>
            {order.address_phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${order.address_phone}`)} style={styles.callBtn}>
                <Ionicons name="call" size={18} color="#fff" />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Address + Map */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Delivery Address</Text>
          <View style={styles.addressCard}>
            <Ionicons name="location" size={16} color={COLORS.primary} />
            <Text style={styles.addressLine}>{fullAddress}</Text>
          </View>
          {order.address_latitude && order.address_longitude ? (
            <DeliveryMap
              latitude={order.address_latitude}
              longitude={order.address_longitude}
              address={fullAddress}
              customerName={order.address_full_name || ''}
              customerPhone={order.address_phone || ''}
              status={order.status}
              distanceFromShop={order.distanceFromShop}
            />
          ) : (
            <View style={styles.noMapCard}>
              <Ionicons name="location-outline" size={24} color={COLORS.mutedText} />
              <Text style={styles.noMapTitle}>No GPS Location</Text>
              <Text style={styles.noMapText}>{fullAddress}</Text>
              <Text style={styles.noMapHint}>Call customer for directions.</Text>
            </View>
          )}
        </View>

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛒 Items ({itemCount})</Text>
          {items.map((item) => (
            <View key={item.product_id || item.name} style={styles.itemRow}>
              <View style={styles.itemQtyBadge}>
                <Text style={styles.itemQty}>{item.quantity}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                {item.weight ? (
                  <Text style={styles.itemWeight}>{item.weight}</Text>
                ) : null}
              </View>
              <Text style={styles.itemPrice}>₹{Number(item.price * item.quantity).toFixed(0)}</Text>
            </View>
          ))}
        </View>

        {/* Payment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Payment</Text>
          <View style={styles.summaryCard}>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Subtotal</Text>
              <Text style={styles.sumValue}>₹{Number(order.subtotal || 0).toFixed(0)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Delivery</Text>
              <Text style={styles.sumValue}>{order.delivery_fee === 0 ? 'FREE' : `₹${Number(order.delivery_fee || 0).toFixed(0)}`}</Text>
            </View>
            <View style={[styles.sumRow, styles.sumBold]}>
              <Text style={styles.sumLabelBold}>Total</Text>
              <Text style={styles.sumValueBold}>₹{Number(order.total || 0).toFixed(0)}</Text>
            </View>
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>Method</Text>
              <Text style={[styles.payValue, order.payment_method === 'cod' ? styles.codText : styles.onlineText]}>
                {order.payment_method === 'cod' ? '💵 Cash on Delivery' : '💳 Online'}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {order.notes || order.special_instructions ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{order.notes || order.special_instructions}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Bottom Action Bar */}
      {nextStatus && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          {order.status === 'out-for-delivery' ? (
            <View style={styles.bottomActions}>
              <ActionButton label="🗺️ Navigate" variant="secondary" style={{ flex: 1 }} onPress={openMaps} />
              <View style={{ width: 10 }} />
              <ActionButton label="✅ Delivered" onPress={handleNext} loading={loading} style={{ flex: 1 }} />
            </View>
          ) : (
            <ActionButton
              label={`🚀 ${STATUS_LABELS[nextStatus]}`}
              onPress={handleNext}
              loading={loading}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: '#fde6cf',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, flex: 1, textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 140, paddingTop: 12 },

  customerCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#fde6cf' },
  customerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  customerName: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  customerPhone: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },

  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 8 },

  addressCard: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#fde6cf' },
  addressLine: { fontSize: 13, fontWeight: '600', color: COLORS.text, flex: 1 },
  noMapCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: '#fde6cf', alignItems: 'center', gap: 6 },
  noMapTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  noMapText: { fontSize: 12, color: COLORS.mutedText, textAlign: 'center' },
  noMapHint: { fontSize: 11, color: COLORS.warningText, textAlign: 'center', marginTop: 4 },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#fde6cf' },
  itemQtyBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  itemQty: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  itemName: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },
  itemInfo: { flex: 1 },
  itemWeight: { fontSize: 10, fontWeight: '600', color: COLORS.mutedText, marginTop: 1 },
  itemPrice: { fontSize: 13, fontWeight: '700', color: COLORS.text },

  summaryCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#fde6cf' },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sumLabel: { fontSize: 13, color: COLORS.mutedText },
  sumValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  sumBold: { borderTopWidth: 1, borderTopColor: '#fde6cf', paddingTop: 8, marginTop: 2 },
  sumLabelBold: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  sumValueBold: { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#fde6cf' },
  payLabel: { fontSize: 12, color: COLORS.mutedText },
  payValue: { fontSize: 12, fontWeight: '700' },
  codText: { color: '#92400e' },
  onlineText: { color: '#1e40af' },

  notesCard: { backgroundColor: '#fffbeb', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#fde68a' },
  notesText: { fontSize: 13, color: COLORS.text, lineHeight: 18 },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.card, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#fde6cf' },
  bottomActions: { flexDirection: 'row' },
});

export default OrderDetailScreen;
