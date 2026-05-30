// GUI category: Screen. Displays order history with delivery slot info, status, and a circular empty state.
// Auto-syncs with backend every 30s for real-time status updates.
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Container from '../components/common/Container';
import { COLORS, ORDER_STATUS_LABELS } from '../utils/constants';
import { formatCurrency, getShadowStyle } from '../utils/helpers';
import { useOrdersStore } from '../store/ordersStore';
import { getAuthToken } from '../services/api';

const statusColor = {
  pending: COLORS.primary,
  confirmed: '#2563eb',
  preparing: COLORS.accent,
  'out-for-delivery': '#7c3aed',
  delivered: COLORS.successText,
  cancelled: COLORS.dangerText,
};

const paymentIcon = {
  cod: 'cash-outline',
  upi: 'phone-portrait-outline',
};

const paymentLabel = {
  cod: 'COD',
  upi: 'UPI',
};

const OrderCard = ({ order, onPress }) => {
  const itemCount = (order.items || []).reduce((sum, item) => sum + item.quantity, 0);
  const statusCol = statusColor[order.status] || COLORS.mutedText;
  const placedDate = new Date(order.placedAt);

  return (
    <Pressable onPress={() => onPress?.(order)} style={styles.card}> 
      <View style={styles.cardHeader}>
        <View style={styles.orderIdSection}>
          <Text style={styles.orderId}>{order.id}</Text>
          <Text style={styles.orderDate}>
            {placedDate.toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusCol + '18' }]}>
          <Text style={[styles.statusText, { color: statusCol }]}>
            {ORDER_STATUS_LABELS[order.status]}
          </Text>
        </View>
      </View>

      {/* Delivery slot badge */}
      {order.deliverySlotLabel && (
        <View style={styles.slotRow}>
          <Ionicons name="time-outline" size={14} color={COLORS.primary} />
          <Text style={styles.slotText}>Delivery: {order.deliverySlotLabel}</Text>
        </View>
      )}

      <View style={styles.itemsPreview}>
        {order.items.slice(0, 3).map((item) => (
          <Text key={item.id} style={styles.itemText} numberOfLines={1}>
            {item.quantity}x {item.name}
          </Text>
        ))}
        {order.items.length > 3 && (
          <Text style={styles.moreText}>+{order.items.length - 3} more</Text>
        )}
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.paymentInfo}>
          <Ionicons
            name={paymentIcon[order.paymentMethod] || 'card-outline'}
            size={14}
            color={COLORS.mutedText}
          />
          <Text style={styles.paymentMethodText}>
            {paymentLabel[order.paymentMethod] || 'Other'}
          </Text>
          <Text style={styles.bullet}>{'  •  '}</Text>
          <Text style={styles.itemCount}>{itemCount} item(s)</Text>
        </View>
        <Text style={styles.totalAmount}>{formatCurrency(order.total)}</Text>
      </View>

      {order.estimatedDelivery && order.status !== 'delivered' && order.status !== 'cancelled' && (
        <View style={styles.etaRow}>
          <Ionicons name="time-outline" size={14} color={COLORS.mutedText} />
          <Text style={styles.etaText}>
            Est. delivery by{' '}
            {new Date(order.estimatedDelivery).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      )}

      {order.status === 'delivered' && (
        <View style={styles.deliveredRow}>
          <Ionicons name="checkmark-circle" size={14} color={COLORS.accent} />
          <Text style={styles.deliveredText}>Delivered on {placedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        </View>
      )}
    </Pressable>
  );
};

const OrdersScreen = ({ onBack }) => {
  const orders = useOrdersStore((state) => state.orders);
  const insets = useSafeAreaInsets();
  const [syncing, setSyncing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // ── Poll backend every 30s for status updates ────────────────
  const syncOrders = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    setSyncing(true);
    try {
      const { listMyOrders } = await import('../services/api');
      const res = await listMyOrders();
      // Backend returns flat array or { orders: [...] }
      const backendOrders = Array.isArray(res) ? res : (res?.orders || []);
      if (backendOrders.length > 0) {
        // Get fresh orders from store (not stale closure)
        const { updateOrderStatus: updateStatus } = useOrdersStore.getState();
        const currentOrders = useOrdersStore.getState().orders;
        backendOrders.forEach((backendOrder) => {
          // Match by backend order ID or stored backendId
          const localOrder = currentOrders.find(
            (o) => o.id === backendOrder.id || o.backendId === backendOrder.id
          );
          if (localOrder && localOrder.status !== backendOrder.status) {
            updateStatus(localOrder.id, backendOrder.status);
          }
        });
      }
    } catch (e) {
      // Silently fail — orders still work locally
    } finally {
      setSyncing(false);
    }
  }, []); // No deps needed - we use getState() for fresh data

  // Start polling when screen is focused, stop when unfocused
  useFocusEffect(
    useCallback(() => {
      // Initial sync
      syncOrders();
      // Poll every 30 seconds
      const interval = setInterval(syncOrders, 30000);
      return () => clearInterval(interval);
    }, [syncOrders])
  );

  return (
    <Container>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          {onBack ? (
            <Pressable onPress={onBack} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={COLORS.text} />
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}
          <Text style={styles.title}>My Orders</Text>
          <View style={styles.backBtn} />
        </View>
        <Text style={styles.subtitle}>
          {orders.length > 0
            ? `${orders.length} order${orders.length > 1 ? 's' : ''} placed`
            : 'Your order history will appear here'}
        </Text>
      </View>

      {orders.length === 0 ? (
        <View style={[styles.emptyWrap, { paddingBottom: 48 + insets.bottom }]}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconOuter}>
              <View style={styles.emptyIconInner}>
                <Ionicons name="receipt-outline" size={36} color={COLORS.primary} />
              </View>
            </View>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubtitle}>
              Your orders will appear here once you place your first purchase.
              Start exploring our fresh groceries!
            </Text>
            <View style={styles.emptyDots}>
              <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />
              <View style={[styles.dot, { backgroundColor: COLORS.accent }]} />
              <View style={[styles.dot, { backgroundColor: COLORS.border }]} />
            </View>
          </View>
        </View>
      ) : (
        <FlatList
          data={orders.slice(0, 5)}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: 24 + insets.bottom }]}
          renderItem={({ item }) => <OrderCard order={item} onPress={setSelectedOrder} />}
          ListFooterComponent={
            orders.length > 5 ? (
              <View style={styles.limitNotice}>
                <Text style={styles.limitText}>Showing last 5 orders</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* ═══ Order Detail Modal ═══ */}
      <Modal
        visible={!!selectedOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <Pressable onPress={() => setSelectedOrder(null)} style={styles.modalClose}>
                <Ionicons name="close" size={22} color="#475569" />
              </Pressable>
            </View>

            {selectedOrder && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={styles.modalOrderId}>{selectedOrder.id}</Text>
                <View style={[styles.modalStatusBadge, { backgroundColor: (statusColor[selectedOrder.status] || '#6b7280') + '18' }]}>
                  <Text style={[styles.modalStatusText, { color: statusColor[selectedOrder.status] || '#6b7280' }]}>
                    {ORDER_STATUS_LABELS[selectedOrder.status]}
                  </Text>
                </View>

                {/* Items */}
                <Text style={styles.modalSectionTitle}>🛒 Items ({(selectedOrder.items || []).length})</Text>
                {(selectedOrder.items || []).map((item, idx) => (
                  <View key={idx} style={styles.modalItemRow}>
                    <View style={styles.modalItemLeft}>
                      <Text style={styles.modalItemQty}>×{item.quantity}</Text>
                      <View>
                        <Text style={styles.modalItemName}>{item.name}</Text>
                        {item.weight ? (
                          <Text style={styles.modalItemWeight}>{item.weight}</Text>
                        ) : null}
                      </View>
                    </View>
                    <Text style={styles.modalItemPrice}>₹{(item.price * item.quantity).toFixed(0)}</Text>
                  </View>
                ))}

                {/* Payment */}
                <Text style={styles.modalSectionTitle}>💰 Payment</Text>
                <View style={styles.modalPaymentRow}>
                  <Text style={styles.modalPayLabel}>Method</Text>
                  <Text style={styles.modalPayValue}>
                    {selectedOrder.paymentMethod === 'cod' ? '💵 Cash on Delivery' : '📱 UPI'}
                  </Text>
                </View>
                <View style={styles.modalPaymentRow}>
                  <Text style={styles.modalPayLabel}>Subtotal</Text>
                  <Text style={styles.modalPayValue}>₹{Number(selectedOrder.subtotal || 0).toFixed(0)}</Text>
                </View>
                <View style={styles.modalPaymentRow}>
                  <Text style={styles.modalPayLabel}>Delivery</Text>
                  <Text style={styles.modalPayValue}>{selectedOrder.deliveryFee === 0 ? 'FREE' : `₹${Number(selectedOrder.deliveryFee || 0).toFixed(0)}`}</Text>
                </View>
                <View style={[styles.modalPaymentRow, styles.modalPaymentTotal]}>
                  <Text style={styles.modalPayLabelBold}>Total</Text>
                  <Text style={styles.modalPayValueBold}>₹{Number(selectedOrder.total || 0).toFixed(0)}</Text>
                </View>

                {selectedOrder.deliverySlotLabel && (
                  <View style={styles.modalSlotRow}>
                    <Ionicons name="time-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.modalSlotText}>Delivery: {selectedOrder.deliverySlotLabel}</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Container>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
  },
  limitNotice: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  limitText: {
    fontSize: 13,
    color: COLORS.mutedText,
  },

  // ── Order Detail Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 16 },
  modalOrderId: { fontSize: 13, fontWeight: '600', color: COLORS.mutedText, marginBottom: 8 },
  modalStatusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 16 },
  modalStatusText: { fontSize: 13, fontWeight: '700' },
  modalSectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text, marginTop: 16, marginBottom: 10 },
  modalItemRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: '#f8fafc', marginBottom: 6,
  },
  modalItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  modalItemQty: { fontSize: 14, fontWeight: '800', color: COLORS.primary, minWidth: 28 },
  modalItemName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  modalItemWeight: { fontSize: 10, fontWeight: '600', color: COLORS.mutedText, marginTop: 1 },
  modalItemPrice: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  modalPaymentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalPaymentTotal: { borderBottomWidth: 0, marginTop: 4 },
  modalPayLabel: { fontSize: 13, color: COLORS.mutedText },
  modalPayValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  modalPayLabelBold: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  modalPayValueBold: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  modalSlotRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 4 },
  modalSlotText: { fontSize: 12, color: COLORS.mutedText, fontWeight: '500' },
  subtitle: {
    marginTop: 6,
    color: COLORS.mutedText,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: '#fde6cf',
    alignItems: 'center',
    ...getShadowStyle(COLORS.shadow),
  },
  emptyIconOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: COLORS.border,
    ...getShadowStyle(COLORS.shadow),
  },
  emptyIconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fde6cf',
  },
  emptyDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  slotText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  deliveredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#fde6cf',
  },
  deliveredText: {
    fontSize: 12,
    color: COLORS.successText,
    fontWeight: '600',
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: COLORS.mutedText,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fde6cf',
    ...getShadowStyle(COLORS.shadow),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderIdSection: {
    flex: 1,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.4,
  },
  orderDate: {
    marginTop: 3,
    fontSize: 12,
    color: COLORS.mutedText,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemsPreview: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  itemText: {
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 4,
  },
  moreText: {
    fontSize: 12,
    color: COLORS.mutedText,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentMethodText: {
    fontSize: 12,
    color: COLORS.mutedText,
    marginLeft: 5,
  },
  bullet: {
    fontSize: 12,
    color: COLORS.mutedText,
  },
  itemCount: {
    fontSize: 12,
    color: COLORS.mutedText,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#fde6cf',
    gap: 6,
  },
  etaText: {
    fontSize: 12,
    color: COLORS.mutedText,
  },
});

export default OrdersScreen;
