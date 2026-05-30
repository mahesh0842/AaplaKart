// ═══════════════════════════════════════════════════════════════
// AddToCartModal — Compact Variant Selector (Blinkit/Instamart style)
// ═══════════════════════════════════════════════════════════════
// Shows product image + name → variant rows with inline qty stepper.
// Tapping +/- auto-adds variant to cart. No separate ADD button needed.
// Admin controls showVariants per product via Catalog Manager.
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { isInStock } from '../../utils/helpers';

// ═══ Helpers ═══
const getSavePercent = (price, mrp) => {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
};

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400';

const resolveImage = (img) => {
  if (!img) return FALLBACK_IMG;
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  return `http://localhost:8000/static/images/${img.replace(/^\/+/, '')}`;
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const AddToCartModal = ({ visible, onClose, product, onAddToCart, preselectedIndex = 0 }) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [imgError, setImgError] = useState(false);
  const [qtyMap, setQtyMap] = useState({}); // per-variant qty tracking

  useEffect(() => {
    if (visible) {
      setImgError(false);
      setQtyMap({});
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      fadeAnim.setValue(0);
    }
  }, [visible, scaleAnim, fadeAnim]);

  if (!product) return null;

  // ── Derived state ──
  const hasOpts = product.options && product.options.length > 0;
  const inStock = isInStock(product);
  const imageUri = resolveImage(product.image || product.firebaseImagePath || '');
  const MAX_QTY = product.maxQuantity || product.maxQuantity_ || 10;

  // ── Handlers ──
  const handleClose = () => {
    Animated.timing(fadeAnim, {
      toValue: 0, duration: 150, useNativeDriver: true,
    }).start(() => onClose());
  };

  const getQty = (idx) => qtyMap[idx] || 0;

  const doAdd = (optIndex, qty) => {
    if (!inStock) return;
    const opt = hasOpts ? product.options?.[optIndex] : null;
    const mergedProduct = {
      ...product,
      price: opt ? opt.price : (product.price || 0),
      weight: opt?.weight || product.weight || '',
      selectedOption: opt,
    };
    onAddToCart(mergedProduct, opt, qty);
  };

  const handleInc = (idx) => {
    const current = getQty(idx);
    const newQty = Math.min(MAX_QTY, (current || 0) + 1);
    setQtyMap((prev) => ({ ...prev, [idx]: newQty }));
    doAdd(idx, newQty);
  };

  const handleDec = (idx) => {
    const current = getQty(idx);
    if (current <= 0) return;
    const newQty = current - 1;
    setQtyMap((prev) => ({ ...prev, [idx]: newQty }));
    doAdd(idx, newQty);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* ═══ Backdrop ═══ */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* ═══ Centered Card ═══ */}
      <View style={styles.centerWrap} pointerEvents="box-none">
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }], opacity: fadeAnim }]}>
          {/* ── Close button ── */}
          <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={20} color="#94a3b8" />
          </Pressable>

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollInner}
            keyboardShouldPersistTaps="handled"
          >
            {/* ══════ PRODUCT IMAGE ══════ */}
            <View style={styles.imageOuter}>
              {imgError ? (
                <View style={styles.imgPlaceholder}>
                  <Ionicons name="image-outline" size={32} color="#cbd5e1" />
                </View>
              ) : (
                <Image
                  source={{ uri: imageUri }}
                  style={styles.productImage}
                  resizeMode="cover"
                  onError={() => setImgError(true)}
                />
              )}
            </View>

            {/* ══════ PRODUCT NAME + PRICE ══════ */}
            <Text style={styles.prodName} numberOfLines={2}>{product.name}</Text>
            {product.weight ? <Text style={styles.prodWeight}>{product.weight}</Text> : null}

            <View style={styles.priceRow}>
              <Text style={styles.priceText}>From ₹{product.price || 0}</Text>
            </View>

            {/* ══════ VARIANT CARDS — COMPACT ══════ */}
            {hasOpts && (
              <View style={styles.variantSection}>
                <Text style={styles.sectionLabel}>Select Size</Text>
                {product.options.map((opt, idx) => {
                  const optHasMRP = opt.mrp && opt.mrp > opt.price;
                  const savePercent = optHasMRP ? getSavePercent(opt.price, opt.mrp) : 0;
                  const qty = getQty(idx);
                  return (
                    <View key={opt.weight || opt.label || idx} style={styles.vCard}>
                      <View style={styles.vCardRow}>
                        <View style={styles.vBadge}>
                          <Text style={styles.vBadgeText}>{opt.weight || opt.label || '—'}</Text>
                        </View>
                        <View style={styles.vPriceInfo}>
                          <Text style={styles.vPrice}>₹{opt.price}</Text>
                          {optHasMRP && <Text style={styles.vMRP}>₹{opt.mrp}</Text>}
                          {savePercent > 0 && (
                            <Text style={styles.vSaveText}>{savePercent}% off</Text>
                          )}
                        </View>
                        {/* Qty stepper (if added) or ADD button */}
                        {qty > 0 ? (
                          <View style={styles.vQtyStepper}>
                            <Pressable
                              onPress={() => handleDec(idx)}
                              style={styles.vQtyBtn}
                            >
                              <Ionicons name="remove" size={13} color={COLORS.primaryDark} />
                            </Pressable>
                            <Text style={styles.vQtyNum}>{qty}</Text>
                            <Pressable
                              onPress={() => handleInc(idx)}
                              disabled={qty >= MAX_QTY}
                              style={[styles.vQtyBtn, qty >= MAX_QTY && styles.vQtyBtnOff]}
                            >
                              <Ionicons name="add" size={13} color={qty >= MAX_QTY ? '#d1d5db' : COLORS.primaryDark} />
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => handleInc(idx)}
                            disabled={!inStock}
                            style={({ pressed }) => [
                              styles.vAddBtn,
                              !inStock && styles.vAddBtnOff,
                              pressed && inStock && styles.vAddBtnPress,
                            ]}
                          >
                            <Ionicons name="add" size={12} color={inStock ? COLORS.primary : '#d1d5db'} />
                            <Text style={[styles.vAddBtnText, !inStock && { color: '#d1d5db' }]}>ADD</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {!hasOpts && (
              <Pressable
                onPress={() => handleInc(0)}
                disabled={!inStock}
                style={({ pressed }) => [
                  styles.addBtnFull,
                  !inStock && styles.addBtnFullOff,
                  pressed && inStock && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="add" size={14} color={inStock ? COLORS.primary : '#d1d5db'} />
                <Text style={[styles.addBtnFullText, !inStock && { color: '#d1d5db' }]}>
                  {inStock ? 'ADD' : 'Out of Stock'}
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES — Compact Centered Modal
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  // ── Backdrop ──
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Center wrapper ──
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    pointerEvents: 'box-none',
  },

  // ── Card ──
  card: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 16 },
    }),
  },

  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollInner: {
    padding: 16,
    paddingTop: 8,
  },

  // ═══ PRODUCT IMAGE ═══
  imageOuter: {
    width: '100%',
    height: 170,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    marginBottom: 12,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imgPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },

  // ═══ NAME + WEIGHT ═══
  prodName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  prodWeight: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.mutedText,
  },

  // ═══ PRICE ROW ═══
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 2,
  },
  priceText: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },

  // ═══ VARIANT SECTION — compact single-row cards ═══
  variantSection: {
    marginTop: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  // ── Variant Card ──
  vCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#fafbfc',
    marginBottom: 6,
  },
  vCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 8,
  },

  // ── Badge ──
  vBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 44,
    alignItems: 'center',
  },
  vBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#374151',
  },

  // ── Price info (inline) ──
  vPriceInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  vPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  vMRP: {
    fontSize: 10,
    color: '#b0b0b0',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  vSaveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },

  // ── ADD Button (ProductCard style) ──
  vAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#fff',
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  vAddBtnOff: {
    borderColor: '#e2e8f0',
    backgroundColor: '#f9fafb',
  },
  vAddBtnPress: {
    backgroundColor: '#fff7ed',
  },
  vAddBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },

  // ── Qty Stepper (shows after ADD) ──
  vQtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    overflow: 'hidden',
    height: 30,
  },
  vQtyBtn: {
    width: 28,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
  },
  vQtyBtnOff: {
    backgroundColor: '#f9fafb',
  },
  vQtyNum: {
    minWidth: 20,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    paddingHorizontal: 3,
  },

  // ── Full-width ADD (no variants) — same style as ProductCard ──
  addBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  addBtnFullOff: {
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  addBtnFullText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});

export default AddToCartModal;
