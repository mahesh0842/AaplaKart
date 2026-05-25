// GUI category: Screen. Displays cart items, quantity controls, totals, and checkout CTA.
import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import Container from '../components/common/Container';
import CartItemRow from '../components/cart/CartItemRow';
import CartSummary from '../components/cart/CartSummary';
import EmptyCart from '../components/cart/EmptyCart';
import { COLORS, FREE_DELIVERY_THRESHOLD } from '../utils/constants';
import {
  formatCurrency,
  getCartSubtotal,
  getCartTotal,
  getDeliveryFee,
} from '../utils/helpers';
import { useCartStore } from '../store/cartStore';

const CartScreen = ({ onCheckout, isAuthenticated = false, onShowLogin }) => {
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);

  const subtotal = useMemo(() => getCartSubtotal(items), [items]);
  const deliveryFee = useMemo(() => getDeliveryFee(subtotal), [subtotal]);
  const total = useMemo(() => getCartTotal(subtotal), [subtotal]);

  const handleCheckout = () => {
    if (!isAuthenticated) {
      Toast.show({
        type: 'info',
        text1: 'Login required',
        text2: 'Please sign in to continue with your order.',
      });
      onShowLogin?.();
      return;
    }
    onCheckout();
  };

  return (
    <Container contentStyle={styles.containerContent}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Cart</Text>
        <Text style={styles.subtitle}>
          Free delivery unlocks above {formatCurrency(FREE_DELIVERY_THRESHOLD)}.
        </Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyCart />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          style={styles.listArea}
          renderItem={({ item }) => (
            <CartItemRow
              item={item}
              onDecrease={() => updateQuantity(item.id, item.quantity - 1)}
              onIncrease={() => updateQuantity(item.id, item.quantity + 1)}
              onDelete={() => removeItem(item.id)}
            />
          )}
          ListFooterComponent={
            <CartSummary
              subtotal={subtotal}
              deliveryFee={deliveryFee}
              total={total}
              onCheckout={handleCheckout}
            />
          }
        />
      )}
    </Container>
  );
};

const styles = StyleSheet.create({
  containerContent: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 8,
    color: COLORS.mutedText,
    fontSize: 14,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  listArea: { flex: 1 },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    flexGrow: 1,
  },
});

export default CartScreen;

