// Reusable bottom-sheet modal for adding a product to cart when it has options/variants.
// Shows product image, name, price, weight/quantity selector, and Add to Cart button.
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ProductImage from '../products/ProductImage';
import { COLORS } from '../../utils/constants';
import { formatCurrency, getShadowStyle, isInStock } from '../../utils/helpers';

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {object} props.product - The product object with optional `options` array
 * @param {(product: object, selectedOption?: object, quantity?: number) => void} props.onAddToCart
 *
 * Product shape:
 * {
 *   id, name, price, weight, image, stock, subcategory,
 *   options?: [{ label: string, price: number, weight?: string }]  // e.g. "500g", "1kg"
 * }
 */
const AddToCartModal = ({ visible, onClose, product, onAddToCart }) => {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  if (!product) return null;

  const hasOptions = product.options && product.options.length > 0;
  const selectedOption = hasOptions ? product.options[selectedOptionIndex] : null;
  const displayPrice = selectedOption ? selectedOption.price : product.price;
  const displayWeight = selectedOption?.weight || product.weight || '';
  const inStock = isInStock(product);

  const handleClose = () => {
    setSelectedOptionIndex(0);
    setQuantity(1);
    setAdding(false);
    onClose();
  };

  const handleAdd = async () => {
    setAdding(true);
    // Simulate brief feedback; parent handles actual cart logic
    await new Promise((r) => setTimeout(r, 300));
    onAddToCart(
      { ...product, price: displayPrice },
      selectedOption,
      quantity,
    );
    setAdding(false);
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <View />
      </Pressable>
      <View style={styles.sheet}>
        {/* Drag handle */}
        <View style={styles.handleBar} />

        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header: image + basic info */}
          <View style={styles.headerRow}>
            <ProductImage
              image={product.image || product.firebaseImagePath}
              style={styles.imageWrap}
              imageStyle={styles.image}
            />
            <View style={styles.headerInfo}>
              <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
              {displayWeight ? <Text style={styles.weight}>{displayWeight}</Text> : null}
              <Text style={styles.price}>{formatCurrency(displayPrice)}</Text>
              {!inStock && (
                <View style={styles.outBadge}>
                  <Text style={styles.outBadgeText}>Out of Stock</Text>
                </View>
              )}
            </View>
          </View>

          {/* Options selector (if product has variants) */}
          {hasOptions && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Variant</Text>
              <View style={styles.optionsRow}>
                {product.options.map((opt, idx) => {
                  const active = idx === selectedOptionIndex;
                  return (
                    <Pressable
                      key={opt.label}
                      onPress={() => {
                        setSelectedOptionIndex(idx);
                        setQuantity(1);
                      }}
                      style={[styles.optionChip, active && styles.optionChipActive]}
                    >
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.optionPrice, active && styles.optionPriceActive]}>
                        {formatCurrency(opt.price)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Quantity selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quantity</Text>
            <View style={styles.qtyRow}>
              <Pressable
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
              >
                <Ionicons name="remove" size={18} color={quantity <= 1 ? COLORS.mutedText : COLORS.primaryDark} />
              </Pressable>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <Pressable
                onPress={() => setQuantity((q) => Math.min(10, q + 1))}
                disabled={quantity >= 10}
                style={[styles.qtyBtn, quantity >= 10 && styles.qtyBtnDisabled]}
              >
                <Ionicons name="add" size={18} color={quantity >= 10 ? COLORS.mutedText : COLORS.primaryDark} />
              </Pressable>
            </View>
          </View>

          {/* Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Item Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(displayPrice * quantity)}</Text>
          </View>

          {/* Add to Cart button */}
          <Pressable
            onPress={handleAdd}
            disabled={!inStock || adding}
            style={({ pressed }) => [
              styles.addBtn,
              !inStock && styles.addBtnDisabled,
              pressed && inStock && styles.addBtnPressed,
            ]}
          >
            {adding ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.addBtnText}>
                {inStock ? `Add to Cart — ${formatCurrency(displayPrice * quantity)}` : 'Out of Stock'}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '80%',
    paddingBottom: 34,
    ...getShadowStyle('#000'),
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  imageWrap: {
    width: 100,
    height: 100,
    borderRadius: 18,
  },
  image: {
    borderRadius: 18,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  weight: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.mutedText,
  },
  price: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  outBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.dangerBg,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  outBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.dangerText,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.mutedText,
    marginBottom: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.mutedBg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  optionChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#fff7ed',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  optionTextActive: {
    color: COLORS.primary,
  },
  optionPrice: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.mutedText,
  },
  optionPriceActive: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  qtyBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  qtyBtnDisabled: {
    opacity: 0.4,
  },
  qtyValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    minWidth: 32,
    textAlign: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#fde6cf',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.mutedText,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    minHeight: 54,
  },
  addBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  addBtnPressed: {
    opacity: 0.9,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});

export default AddToCartModal;
