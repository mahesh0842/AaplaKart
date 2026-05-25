// ── Universal ProductCard ──────────────────────────────────────────
// Single source of truth for product UI across the entire app.
// Image (60% height) → Unit + ADD row → Price → Name → Rating → Delivery → Stock.
// Memoized. Supports skeleton, options modal, quantity stepper, badges, wishlist.
import React, { memo, useState, useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../utils/constants';
import { formatCurrency, getShadowStyle, hasOptions, isInStock } from '../../utils/helpers';
import { useCartStore } from '../../store/cartStore';
import AddToCartModal from '../cart/AddToCartModal';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400';
const BACKEND_STATIC = 'http://localhost:8000/static/images';

const resolveImage = (img) => {
  if (!img) return FALLBACK_IMG;
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  return `${BACKEND_STATIC}/${img.replace(/^\/+/, '')}`;
};

// ── Skeleton ────────────────────────────────────────────────────

const ProductCardSkeleton = memo(() => (
  <View style={[styles.card, styles.skeletonCard]}>
    <View style={[styles.imageWrap, styles.skelImage]} />
    <View style={styles.infoWrap}>
      <View style={[styles.skelLine, { width: '40%' }]} />
      <View style={[styles.skelLine, { width: '70%', marginTop: 4 }]} />
      <View style={[styles.skelLine, { width: '50%', marginTop: 4 }]} />
    </View>
  </View>
));

// ── Stars (inline rating) ───────────────────────────────────────

const Stars = memo(({ rating, size = 10 }) => {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <View style={styles.starsRow}>
      {Array.from({ length: full }, (_, i) => (
        <Ionicons key={`f${i}`} name="star" size={size} color="#f59e0b" />
      ))}
      {half && <Ionicons name="star-half" size={size} color="#f59e0b" />}
      {Array.from({ length: empty }, (_, i) => (
        <Ionicons key={`e${i}`} name="star-outline" size={size} color="#d1d5db" />
      ))}
    </View>
  );
});

// ── Quantity stepper ────────────────────────────────────────────

const QuantityStepper = memo(({ quantity, onIncrement, onDecrement }) => (
  <View style={styles.stepper}>
    <Pressable onPress={onDecrement} style={styles.stepperBtn}>
      <Ionicons name="remove" size={13} color={COLORS.primary} />
    </Pressable>
    <Text style={styles.stepperQty}>{quantity}</Text>
    <Pressable onPress={onIncrement} style={styles.stepperBtn}>
      <Ionicons name="add" size={13} color={COLORS.primary} />
    </Pressable>
  </View>
));

// ── Main ProductCard ────────────────────────────────────────────

const ProductCard = memo(({
  product,
  quantity = 0,
  onAdd,
  onWishlistToggle,
  isWishlisted = false,
  isSkeleton = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const updateQuantity = useCartStore((state) => state.updateQuantity);

  if (isSkeleton) return <ProductCardSkeleton />;

  // Normalise props — support both new spec shape and legacy data
  const imgSrc = product.image?.uri || product.image || product.firebaseImagePath;
  const imageUrl = resolveImage(imgSrc);
  const carouselImages = product.image?.carousel || [];
  const inStock = product.isAvailable !== undefined ? product.isAvailable : isInStock(product);
  const hasOpts = hasOptions(product);
  const rating = product.rating || 0;
  const ratingCount = product.ratingCount || 0;
  const delivery = product.deliveryTime || '10–20 mins';
  const isAd = product.isAd || false;
  const badges = product.badges || [];
  const stockLeft = product.stockLeft ?? product.stock ?? null;
  const unit = product.unit || product.weight || '';

  // ── Handlers ──────────────────────────────────────────────────

  const handleAddPress = useCallback(() => {
    if (!inStock) return;
    if (hasOpts) { setModalVisible(true); return; }
    onAdd?.(product);
  }, [inStock, hasOpts, product, onAdd]);

  const handleIncrement = useCallback(() => {
    if (hasOpts) { setModalVisible(true); return; }
    if (quantity === 0) onAdd?.(product);
    else updateQuantity(product.id, quantity + 1);
  }, [hasOpts, quantity, product, onAdd, updateQuantity]);

  const handleDecrement = useCallback(() => {
    updateQuantity(product.id, quantity - 1);
  }, [product.id, quantity, updateQuantity]);

  const handleModalAdd = useCallback((cartProduct, selectedOption, qty) => {
    const merged = selectedOption
      ? { ...cartProduct, price: selectedOption.price, weight: selectedOption.weight }
      : cartProduct;
    onAdd?.(merged, qty || 1);
  }, [onAdd]);

  return (
    <>
      <View style={[styles.card, !inStock && styles.cardOutOfStock]}>
        {/* ══════ TOP: IMAGE AREA (~60% of card) ══════ */}
        <View style={styles.imageWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.placeholder]}>
              <Ionicons name="image-outline" size={28} color={COLORS.mutedText} />
            </View>
          )}

          {/* Badge — top-left */}
          {isAd && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Ad</Text>
            </View>
          )}
          {badges.map((b) => (
            <View key={b} style={[styles.badge, { backgroundColor: '#16a34a' }]}>
              <Text style={styles.badgeText}>{b}</Text>
            </View>
          ))}

          {/* Wishlist — top-right */}
          <Pressable onPress={() => onWishlistToggle?.(product)} style={styles.wishlistBtn} hitSlop={8}>
            <Ionicons
              name={isWishlisted ? 'heart' : 'heart-outline'}
              size={18}
              color={isWishlisted ? '#e11d48' : '#fff'}
            />
          </Pressable>

          {/* Carousel dots (when multiple images) */}
          {carouselImages.length > 1 && (
            <View style={styles.carouselDots}>
              {carouselImages.map((_, i) => (
                <View key={i} style={[styles.dot, i === 0 && styles.dotActive]} />
              ))}
            </View>
          )}

          {/* Out of stock overlay */}
          {!inStock && (
            <View style={styles.outOverlay}>
              <Text style={styles.outText}>Out of Stock</Text>
            </View>
          )}
        </View>

        {/* ══════ MIDDLE: UNIT + ADD BUTTON ══════ */}
        <View style={styles.middleRow}>
          <Text style={styles.unitText} numberOfLines={1}>{unit || ' '}</Text>
          {inStock ? (
            quantity > 0 ? (
              <QuantityStepper
                quantity={quantity}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
              />
            ) : (
              <Pressable
                onPress={handleAddPress}
                style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
              >
                <Text style={styles.addBtnText}>ADD</Text>
                <Ionicons name="add" size={12} color={COLORS.primary} />
              </Pressable>
            )
          ) : (
            <View style={[styles.addBtn, styles.addBtnDisabled]}>
              <Text style={styles.addBtnDisabledText}>OUT OF STOCK</Text>
            </View>
          )}
        </View>

        {/* ══════ BOTTOM: INFO ══════ */}
        <View style={styles.infoWrap}>
          {/* Price */}
          <Text style={styles.price}>{formatCurrency(product.price)}</Text>

          {/* Name (max 2-3 lines) */}
          <Text style={styles.name} numberOfLines={2}>{product.name}</Text>

          {/* Rating + count */}
          {rating > 0 && (
            <View style={styles.ratingRow}>
              <Stars rating={rating} size={9} />
              {ratingCount > 0 && (
                <Text style={styles.ratingCount}>({ratingCount})</Text>
              )}
            </View>
          )}

          {/* Delivery + Stock */}
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={10} color={COLORS.mutedText} />
            <Text style={styles.deliveryText}>{delivery}</Text>
            {stockLeft > 0 && stockLeft <= 5 && (
              <>
                <Text style={styles.metaSep}>•</Text>
                <Text style={styles.stockText}>Only {stockLeft} left</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Options Modal */}
      <AddToCartModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        product={product}
        onAddToCart={handleModalAdd}
      />
    </>
  );
});

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Card container ──
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: SPACING.radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fde6cf',
    ...getShadowStyle(COLORS.shadow),
  },
  cardOutOfStock: { opacity: 0.6 },

  // ── Image area (~60% of card) ──
  imageWrap: { position: 'relative', width: '100%', aspectRatio: 1 },
  image: { width: '100%', height: '100%' },
  placeholder: { backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },

  // ── Badge (top-left pill) ──
  badge: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: '#e11d48',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },

  // ── Wishlist heart (top-right) ──
  wishlistBtn: {
    position: 'absolute', top: 6, right: 6,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Carousel dots ──
  carouselDots: {
    position: 'absolute', bottom: 8,
    flexDirection: 'row', alignSelf: 'center', gap: 4,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#fff', width: 10 },

  // ── Out of stock overlay ──
  outOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  outText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  // ── Middle row: unit (left) + ADD/stepper (right) ──
  middleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.card,
    paddingVertical: SPACING.cardSm,
    borderBottomWidth: 1,
    borderBottomColor: '#fef3c7',
  },
  unitText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.mutedText,
  },

  // ── ADD button (right side in middle row) ──
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: SPACING.radiusSm,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: '#fff',
  },
  addBtnPressed: { opacity: 0.75, backgroundColor: '#fff7ed' },
  addBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  addBtnDisabled: {
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  addBtnDisabledText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#9ca3af',
  },

  // ── Quantity stepper ──
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: SPACING.radiusSm,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    overflow: 'hidden',
  },
  stepperBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff7ed',
    width: 28, height: 28,
  },
  stepperQty: {
    minWidth: 24, textAlign: 'center',
    fontSize: 12, fontWeight: '800',
    color: COLORS.text, paddingHorizontal: 4,
  },

  // ── Info wrap ──
  infoWrap: { padding: SPACING.card },

  // ── Price ──
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 2,
  },

  // ── Name ──
  name: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 16,
    marginBottom: 4,
  },

  // ── Rating row ──
  ratingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: 3,
  },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  ratingCount: { fontSize: 9, color: COLORS.mutedText, fontWeight: '600' },

  // ── Meta row (delivery + stock) ──
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  deliveryText: { fontSize: 10, fontWeight: '600', color: COLORS.mutedText },
  metaSep: { fontSize: 10, color: '#d1d5db' },
  stockText: { fontSize: 10, fontWeight: '700', color: '#e11d48' },

  // ── Skeleton ──
  skeletonCard: { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb' },
  skelImage: { backgroundColor: '#e5e7eb' },
  skelLine: { height: 10, borderRadius: 4, backgroundColor: '#e5e7eb' },
});

export { ProductCardSkeleton, Stars, QuantityStepper };
export default ProductCard;

