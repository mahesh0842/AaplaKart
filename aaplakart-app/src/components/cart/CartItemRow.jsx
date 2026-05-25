// GUI category: Cart UI. Renders a single cart line item with quantity controls and delete action.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ProductImage from '../products/ProductImage';
import { COLORS } from '../../utils/constants';
import { formatCurrency, scaleW, isTablet } from '../../utils/helpers';

const CartItemRow = ({ item, onDecrease, onIncrease, onDelete }) => (
  <View style={styles.row}>
    <ProductImage image={item.image || item.firebaseImagePath} style={styles.imageWrap} />
    <View style={styles.info}>
      <Text style={styles.name}>{item.name}</Text>
      {item.weight ? <Text style={styles.weight}>{item.weight}</Text> : null}
      <Text style={styles.price}>{formatCurrency(item.price)}</Text>
      <View style={styles.actionsRow}>
        <View style={styles.quantityWrap}>
          <Pressable
            accessibilityLabel={`Decrease ${item.name} quantity`}
            onPress={onDecrease}
            style={styles.quantityButton}
          >
            <Ionicons name="remove" size={16} color={COLORS.primaryDark} />
          </Pressable>
          <Text style={styles.quantity}>{item.quantity}</Text>
          <Pressable
            accessibilityLabel={`Increase ${item.name} quantity`}
            onPress={onIncrease}
            style={styles.quantityButton}
          >
            <Ionicons name="add" size={16} color={COLORS.primaryDark} />
          </Pressable>
        </View>
        <Pressable
          accessibilityLabel={`Delete ${item.name} from cart`}
          onPress={onDelete}
          style={styles.deleteButton}
        >
          <Ionicons name="trash-outline" size={18} color={COLORS.dangerText} />
        </Pressable>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: scaleW(14),
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fde6cf',
  },
  imageWrap: {
    width: isTablet() ? scaleW(100) : 88,
    height: isTablet() ? scaleW(100) : 88,
    borderRadius: 16,
    overflow: 'hidden',
  },
  info: {
    flex: 1,
    marginLeft: 14,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  weight: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.mutedText,
  },
  price: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  actionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    minWidth: 24,
    textAlign: 'center',
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
  },
});

export default CartItemRow;

