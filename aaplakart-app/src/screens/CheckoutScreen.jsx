// GUI category: Screen. Full checkout flow — address, delivery time, payment, and confirmation.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import Container from '../components/common/Container';
import AddressFormSheet from '../components/checkout/AddressFormSheet';
import DeliveryTimePicker from '../components/checkout/DeliveryTimePicker';
import PaymentMethodSelector from '../components/checkout/PaymentMethodSelector';
import OrderConfirmation from '../components/checkout/OrderConfirmation';
import RazorpayCheckout from '../components/checkout/RazorpayCheckout';
import { COLORS, DELIVERY_TIME_SLOTS } from '../utils/constants';
import {
  formatCurrency,
  getCartSubtotal,
  getCartTotal,
  getDeliveryFee,
  getShadowStyle,
} from '../utils/helpers';
import { isTablet } from '../utils/helpers';
import { useAddressStore } from '../store/addressStore';
import { useCartStore } from '../store/cartStore';
import { useOrdersStore } from '../store/ordersStore';
import { createOrder, getAuthToken, mockLogin, simpleLogin, setAuthToken, fetchDeliverySlots, fetchPaymentMethods } from '../services/api';
import { createOrder as createRzOrder, verifyPayment, toPaise } from '../services/razorpay';

const INITIAL_ADDRESS = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  pincode: '',
};

const CheckoutScreen = ({ onClose, onBack, onShowLogin, phoneNumber = '', isAuthenticated = false }) => {
  const insets = useSafeAreaInsets();
  const [flowStep, setFlowStep] = useState('address');
  const [address, setAddress] = useState(INITIAL_ADDRESS);
  const [deliverySlot, setDeliverySlot] = useState('asap');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [placing, setPlacing] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [coordinates, setCoordinates] = useState({ latitude: null, longitude: null });
  const [showSheet, setShowSheet] = useState(false);
  const [editingSheetAddress, setEditingSheetAddress] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showAllItems, setShowAllItems] = useState(false);

  const [rzpVisible, setRzpVisible] = useState(false);
  const [rzpOptions, setRzpOptions] = useState({});
  const [rzpProcessing, setRzpProcessing] = useState(false);

  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const placeOrder = useOrdersStore((state) => state.placeOrder);
  const addresses = useAddressStore((state) => state.addresses);

  // Auto-select first saved address on mount
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const first = addresses[0];
      setSelectedAddressId(first.id);
      setAddress({
        fullName: first.fullName || '',
        phone: first.phone || '',
        line1: first.line1 || '',
        line2: '',
        landmark: first.landmark || '',
        city: first.city || '',
        pincode: first.pincode || '',
      });
      setCoordinates({
        latitude: first.latitude ?? null,
        longitude: first.longitude ?? null,
      });
    }
  }, [addresses]);

  const selectedAddress = selectedAddressId
    ? addresses.find((a) => a.id === selectedAddressId) || null
    : null;

  const subtotal = useMemo(() => getCartSubtotal(items), [items]);
  const deliveryFee = useMemo(() => getDeliveryFee(subtotal), [subtotal]);
  const total = useMemo(() => getCartTotal(subtotal), [subtotal]);

  const selectedSlot = DELIVERY_TIME_SLOTS.find((s) => s.id === deliverySlot);

  const isAddressValid = () => {
    const { fullName, phone, line1, city, pincode } = address;
    return fullName.trim() && phone.trim() && line1.trim() && city.trim() && pincode.trim().length === 6;
  };

  // ── Bottom sheet handlers ──
  const handleOpenAddSheet = () => {
    setEditingSheetAddress(null);
    setShowSheet(true);
  };

  const handleOpenEditSheet = () => {
    setEditingSheetAddress(selectedAddress);
    setShowSheet(true);
  };

  const handleCloseSheet = () => {
    setShowSheet(false);
    setEditingSheetAddress(null);
  };

  const handleAddressSelected = (addr) => {
    setSelectedAddressId(addr.id);
    setAddress({
      fullName: addr.fullName || '',
      phone: addr.phone || '',
      line1: addr.line1 || '',
      line2: '',
      landmark: addr.landmark || '',
      city: addr.city || '',
      pincode: addr.pincode || '',
    });
    setCoordinates({
      latitude: addr.latitude ?? null,
      longitude: addr.longitude ?? null,
    });
  };

  const handleAddressNext = () => {
    if (!isAddressValid()) {
      Alert.alert('Incomplete Address', 'Please fill in all address fields including a valid 6-digit pincode.');
      return;
    }
    setFlowStep('time');
  };

  const handleTimeNext = () => {
    setFlowStep('payment');
  };

  const handlePlaceOrder = async () => {
    // ── Require login to save order to server ──
    if (!isAuthenticated) {
      Alert.alert(
        'Login Required',
        'Please login to place your order. Your order will be saved to your account.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Login', onPress: () => { onClose(); onShowLogin?.(); } },
        ],
      );
      return;
    }

    // ── Online Payment (Razorpay WebView — Expo Go compatible) ──
    if (paymentMethod === 'online') {
      setRzpProcessing(true);
      try {
        const rzpOrder = await createRzOrder(toPaise(total), `receipt_${Date.now()}`);

        setRzpOptions({
          order_id: rzpOrder.razorpay_order_id,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency,
          name: 'AaplaKart',
          description: `Order — ${items.length} item${items.length > 1 ? 's' : ''}`,
          prefillName: address.fullName || '',
          prefillContact: address.phone || '',
          prefillEmail: '',
          themeColor: '#f97316',
        });

        setRzpProcessing(false);
        setRzpVisible(true);
        return; // Wait for WebView callback
      } catch (err) {
        setRzpProcessing(false);
        const msg = (err?.message || '').toLowerCase();
        if (msg.includes('timeout') || msg.includes('network') || msg.includes('abort')) {
          Alert.alert('Connection Issue', 'Unable to connect to payment gateway. Please check your internet and try again.',
            [{ text: 'Try Again', onPress: () => handlePlaceOrder() }, { text: 'Cancel' }]);
        } else {
          Alert.alert('Payment Error', err?.message || 'Could not initiate payment.');
        }
        return;
      }
    }

    // ── COD / UPI — direct order placement ──
    await _finalizeOrder();
  };

  const handleContinueShopping = () => {
    setLastOrder(null);
    setFlowStep('address');
    setAddress(INITIAL_ADDRESS);
    setDeliverySlot('asap');
    setPaymentMethod('cod');
    setCoordinates({ latitude: null, longitude: null });
    setSelectedAddressId(null);
    onClose();
  };

  // ── Razorpay WebView callbacks ───────────────────────────────
  const handleRazorpaySuccess = async (paymentData) => {
    setRzpVisible(false);
    setRzpProcessing(true);
    try {
      const verification = await verifyPayment({
        razorpay_order_id: paymentData.razorpay_order_id,
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_signature: paymentData.razorpay_signature,
      });
      if (!verification.verified) {
        Alert.alert('Payment Failed', 'Verification failed.');
        setRzpProcessing(false);
        return;
      }
      await _finalizeOrder(paymentData);
    } catch (err) {
      setRzpProcessing(false);
      Alert.alert('Verification Error', err?.message || 'Could not verify payment.');
    }
  };

  const handleRazorpayFailure = (error) => {
    setRzpVisible(false);
    Alert.alert('Payment Failed', error?.description || error?.reason || 'Payment not completed.');
  };

  const handleRazorpayClose = () => {
    if (rzpProcessing) return;
    setRzpVisible(false);
    Alert.alert('Payment Cancelled', 'You cancelled the payment. Your order has not been placed.');
  };

  // ── Finalize order (common for all payment methods) ───────────
  const _finalizeOrder = async (razorpayData = null) => {
    setPlacing(true);

    try {
      // Build payment info
      const paymentInfo = { method: paymentMethod };
      if (razorpayData) {
        paymentInfo.razorpay_payment_id = razorpayData.razorpay_payment_id;
        paymentInfo.razorpay_order_id = razorpayData.razorpay_order_id;
        paymentInfo.razorpay_signature = razorpayData.razorpay_signature;
      }

      // 1. Save locally first (always works)
      const order = placeOrder({
        items,
        subtotal,
        deliveryFee,
        total,
        paymentMethod,
        address,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        deliverySlot: deliverySlot,
        deliverySlotLabel: selectedSlot?.label || 'ASAP',
        paymentInfo,
      });

      // 2. Try to persist to backend + Firestore
      try {
        // Auto-login if no auth token (ensures backend + Firestore save)
        if (!getAuthToken()) {
          try {
            // Use simpleLogin instead of mockLogin — works without Firebase
            const loginResult = await simpleLogin(address.phone || phoneNumber || '');
            if (loginResult?.id_token) {
              setAuthToken(loginResult.id_token);
              console.log('[api] Auto-login success for order save');
            }
          } catch (loginErr) {
            console.log('[api] Auto-login failed, order saved locally only:', loginErr?.message);
          }
        }

        if (getAuthToken()) {
          const backendOrder = await createOrder({
            id: order.id,  // Send local order ID so backend uses same ID
            items: items.map((i) => ({
              product_id: i.id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              weight: i.weight || '',
              image_path: i.image || i.firebaseImagePath || '',
            })),
            subtotal,
            delivery_fee: deliveryFee,
            total,
            payment_method: paymentMethod,
            delivery_slot: deliverySlot,
            delivery_slot_label: selectedSlot?.label || 'ASAP',
            address_full_name: address.fullName,
            address_phone: address.phone,
            address_line1: address.line1,
            address_line2: address.line2 || '',
            address_landmark: address.landmark || '',
            address_city: address.city,
            address_pincode: address.pincode,
            address_latitude: coordinates.latitude,
            address_longitude: coordinates.longitude,
            save_address: true,
            address_label: 'Home',
            razorpay_payment_id: razorpayData?.razorpay_payment_id || '',
            razorpay_order_id: razorpayData?.razorpay_order_id || '',
          });
          // Order saved with same ID — no mapping needed!
          if (backendOrder?.id) {
            useOrdersStore.getState().updateOrderStatus?.(order.id, 'pending');
          }
          console.log('[api] Order saved to backend:', backendOrder?.id);
        }
      } catch (apiErr) {
        console.log('[api] Backend order save skipped:', apiErr?.message);
      }

      clearCart();
      setLastOrder(order);
      setFlowStep('confirmation');
    } catch (error) {
      Alert.alert('Order Failed', error?.message || 'Something went wrong while placing your order.');
    } finally {
      setPlacing(false);
      setRzpProcessing(false);
    }
  };

  // ── Confirmation screen ──
  if (flowStep === 'confirmation' && lastOrder) {
    return (
      <Container edges={['top', 'left', 'right', 'bottom']}>
        <OrderConfirmation order={lastOrder} onContinueShopping={handleContinueShopping} />
      </Container>
    );
  }

  // ── Progress indicator ──
  const steps = [
    { id: 'address', label: 'Address', icon: 'location-outline' },
    { id: 'time', label: 'Time', icon: 'time-outline' },
    { id: 'payment', label: 'Payment', icon: 'card-outline' },
  ];
  const currentStepIndex = steps.findIndex((s) => s.id === flowStep);

  return (
    <Container edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          onPress={() => {
            if (flowStep === 'time') { setFlowStep('address'); }
            else if (flowStep === 'payment') { setFlowStep('time'); }
            else { onBack ? onBack() : onClose(); }
          }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Checkout</Text>
        <View style={styles.backButton} />
      </View>

      {/* Step progress */}
      <View style={styles.progressRow}>
        {steps.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isDone = index < currentStepIndex;
          return (
            <React.Fragment key={step.id}>
              <View style={[styles.progressDot, isActive && styles.progressDotActive, isDone && styles.progressDotDone]}>
                <Ionicons
                  name={isDone ? 'checkmark' : step.icon}
                  size={14}
                  color={isDone || isActive ? '#fff' : COLORS.mutedText}
                />
              </View>
              {index < steps.length - 1 && (
                <View style={[styles.progressLine, isDone && styles.progressLineDone]} />
              )}
            </React.Fragment>
          );
        })}
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 24 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {flowStep === 'address' && (
          <>
            {selectedAddress ? (
              /* ── Compact address card ── */
              <View style={styles.addressCard}>
                <View style={styles.addressCardHeader}>
                  <View style={styles.labelBadge}>
                    <Ionicons
                      name={{
                        Home: 'home-outline',
                        Office: 'briefcase-outline',
                        Other: 'location-outline',
                      }[selectedAddress.label] || 'location-outline'}
                      size={12}
                      color={COLORS.primary}
                    />
                    <Text style={styles.labelBadgeText}>{selectedAddress.label}</Text>
                  </View>
                  <View style={styles.addressActions}>
                    <Pressable onPress={handleOpenEditSheet} style={styles.editBtn}>
                      <Ionicons name="create-outline" size={16} color={COLORS.mutedText} />
                    </Pressable>
                    <Pressable onPress={handleOpenAddSheet} style={styles.changeBtn}>
                      <Text style={styles.changeBtnText}>Change</Text>
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.addrName}>{selectedAddress.fullName}</Text>
                <Text style={styles.addrLine} numberOfLines={1}>
                  {selectedAddress.line1}, {selectedAddress.city} - {selectedAddress.pincode}
                </Text>
                {selectedAddress.landmark ? (
                  <Text style={styles.addrLandmark} numberOfLines={1}>{selectedAddress.landmark}</Text>
                ) : null}
              </View>
            ) : (
              /* ── No saved address — prompt ── */
              <Pressable onPress={handleOpenAddSheet} style={styles.addCard}>
                <View style={styles.addCardIcon}>
                  <Ionicons name="add-outline" size={28} color={COLORS.primary} />
                </View>
                <Text style={styles.addCardTitle}>Add Delivery Address</Text>
                <Text style={styles.addCardSub}>
                  Enter your address to get started
                </Text>
              </Pressable>
            )}

            <AddressFormSheet
              visible={showSheet}
              onClose={handleCloseSheet}
              onAddressSelected={handleAddressSelected}
              phoneNumber={isAuthenticated ? phoneNumber : ''}
              editingAddress={editingSheetAddress}
            />

            {/* Mini order summary — collapsed to 3 items */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryHeading}>Order Summary</Text>
              {(showAllItems ? items : items.slice(0, 3)).map((item) => (
                <View key={item.id} style={styles.summaryRow}>
                  <View style={styles.summaryItemInfo}>
                    <Text style={styles.summaryItemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.summaryItemQty}>x{item.quantity}</Text>
                  </View>
                  <Text style={styles.summaryItemPrice}>
                    {formatCurrency(item.price * item.quantity)}
                  </Text>
                </View>
              ))}
              {items.length > 3 && (
                <Pressable
                  onPress={() => setShowAllItems(!showAllItems)}
                  style={styles.viewAllBtn}
                >
                  <Text style={styles.viewAllText}>
                    {showAllItems ? 'Show less ▲' : `+${items.length - 3} more items ▼`}
                  </Text>
                </Pressable>
              )}
              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Delivery</Text>
                <Text style={[styles.totalValue, deliveryFee === 0 && styles.freeValue]}>
                  {deliveryFee === 0 ? 'FREE' : formatCurrency(deliveryFee)}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>Total</Text>
                <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
              </View>
            </View>
          </>
        )}

        {flowStep === 'time' && (
          <DeliveryTimePicker selected={deliverySlot} onSelect={setDeliverySlot} />
        )}

        {flowStep === 'payment' && (
          <PaymentMethodSelector selected={paymentMethod} onSelect={setPaymentMethod} />
        )}
      </ScrollView>

      {/* Footer CTA */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          accessibilityLabel={
            flowStep === 'address' ? 'Continue to delivery time' :
            flowStep === 'time' ? 'Continue to payment' :
            'Place order'
          }
          onPress={
            flowStep === 'address' ? handleAddressNext :
            flowStep === 'time' ? handleTimeNext :
            handlePlaceOrder
          }
          disabled={placing || rzpProcessing}
          style={({ pressed }) => [
            styles.placeOrderButton,
            pressed && styles.buttonPressed,
            (placing || rzpProcessing) && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.placeOrderText}>
            {placing || rzpProcessing
              ? 'Processing...'
              : flowStep === 'address'
              ? `Continue • ${formatCurrency(total)}`
              : flowStep === 'time'
              ? `Deliver ${selectedSlot?.label || 'ASAP'} • ${formatCurrency(total)}`
              : paymentMethod === 'online'
              ? `Pay ₹${formatCurrency(total)}`
              : `Place Order • ${formatCurrency(total)}`}
          </Text>
        </Pressable>
      </View>

      {/* Razorpay Checkout Modal (WebView) */}
      <RazorpayCheckout
        visible={rzpVisible}
        onClose={handleRazorpayClose}
        onSuccess={handleRazorpaySuccess}
        onFailure={handleRazorpayFailure}
        checkoutOptions={rzpOptions}
      />
    </Container>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  scrollArea: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#fde6cf',
    marginBottom: 20,
    ...getShadowStyle(COLORS.shadow),
  },
  summaryHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  summaryItemName: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    maxWidth: '70%',
  },
  summaryItemQty: {
    fontSize: 13,
    color: COLORS.mutedText,
  },
  summaryItemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  viewAllBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  divider: {
    height: 1,
    backgroundColor: '#fed7aa',
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: COLORS.mutedText,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  freeValue: {
    color: COLORS.successText,
  },
  grandTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: '#fde6cf',
  },
  placeOrderButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  placeOrderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 16,
    gap: 0,
  },
  progressDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.mutedBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    backgroundColor: COLORS.primary,
  },
  progressDotDone: {
    backgroundColor: COLORS.accent,
  },
  progressLine: {
    width: 40,
    height: 3,
    backgroundColor: COLORS.mutedBg,
    borderRadius: 2,
  },
  progressLineDone: {
    backgroundColor: COLORS.accent,
  },
  // ── Address card (saved address) ──
  addressCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  addressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  labelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.card,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  labelBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  addressActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  changeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: COLORS.primary + '14',
  },
  changeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  addrName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  addrLine: {
    fontSize: 12,
    color: COLORS.mutedText,
  },
  addrLandmark: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.primaryDark,
    fontWeight: '500',
  },
  // ── Add address prompt ──
  addCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: 16,
  },
  addCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.mutedBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  addCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 3,
  },
  addCardSub: {
    fontSize: 13,
    color: COLORS.mutedText,
    textAlign: 'center',
  },
});

export default CheckoutScreen;
