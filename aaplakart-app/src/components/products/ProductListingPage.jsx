// Product Listing Page (PLP) — Blinkit/Zomato-style.
// Sticky header + subcategory rail (left) + 2-column product grid (right).
// Instant subcategory switching, smooth animations, skeleton loaders.
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import SubcategoryRail from './SubcategoryRail';
import ProductCard from './ProductCard';
import { COLORS, SPACING } from '../../utils/constants';
import { formatCurrency, getCardWidth, getShadowStyle } from '../../utils/helpers';
import { useCartStore } from '../../store/cartStore';

// Rail layout: offset by rail width so cards match ProductGrid size
const RAIL_WIDTH = 82;
const CARD_WIDTH = getCardWidth(2, SPACING.gridGap, RAIL_WIDTH);

// Skeleton loader component
const SkeletonCard = () => (
  <View style={[styles.skeleton, { width: CARD_WIDTH }]}>
    <View style={styles.skelImage} />
    <View style={styles.skelTextWrap}>
      <View style={[styles.skelLine, { width: '80%' }]} />
      <View style={[styles.skelLine, { width: '50%', marginTop: 4 }]} />
      <View style={[styles.skelLine, { width: '60%', marginTop: 4 }]} />
    </View>
  </View>
);

const SKELETON_DATA = [{ id: 'sk1' }, { id: 'sk2' }, { id: 'sk3' }, { id: 'sk4' }];

/**
 * @param {object} props
 * @param {object} props.category — { id, name, image, type, subcategories: [], ... }
 * @param {Array} props.products — full product list (pre-filtered by category)
 * @param {boolean} props.loading
 * @param {() => void} props.onBack
 * @param {(product) => void} props.onAddProduct
 * @param {boolean} props.isAuthenticated
 * @param {() => void} props.onShowLogin
 */
const ProductListingPage = memo(({
  category,
  products,
  loading,
  onBack,
  onAddProduct,
  isAuthenticated,
  onShowLogin,
}) => {
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [searchText, setSearchText] = useState('');
  const searchRef = useRef(null);
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── Revolving border glow — 4 sides ───────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweepAnim, {
        toValue: 1,
        duration: 2400,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [sweepAnim]);

  // Phase 0.00–0.25: top bar left→right
  // Phase 0.25–0.50: right bar top→bottom
  // Phase 0.50–0.75: bottom bar right→left
  // Phase 0.75–1.00: left bar bottom→top
  const topOpacity = sweepAnim.interpolate({ inputRange: [0, 0.22, 0.25, 1], outputRange: [1, 1, 0, 0] });
  const rightOpacity = sweepAnim.interpolate({ inputRange: [0, 0.24, 0.25, 0.47, 0.5, 1], outputRange: [0, 0, 1, 1, 0, 0] });
  const bottomOpacity = sweepAnim.interpolate({ inputRange: [0, 0.49, 0.5, 0.72, 0.75, 1], outputRange: [0, 0, 1, 1, 0, 0] });
  const leftOpacity = sweepAnim.interpolate({ inputRange: [0, 0.74, 0.75, 0.97, 1], outputRange: [0, 0, 1, 1, 0] });

  const topX = sweepAnim.interpolate({ inputRange: [0, 0.25], outputRange: [-40, 40], extrapolate: 'clamp' });
  const rightY = sweepAnim.interpolate({ inputRange: [0.25, 0.5], outputRange: [-40, 40], extrapolate: 'clamp' });
  const bottomX = sweepAnim.interpolate({ inputRange: [0.5, 0.75], outputRange: [40, -40], extrapolate: 'clamp' });
  const leftY = sweepAnim.interpolate({ inputRange: [0.75, 1], outputRange: [40, -40], extrapolate: 'clamp' });
  const cartItems = useCartStore((state) => state.items);

  // Extract subcategories from the category + products
  const subcategories = useMemo(() => {
    if (!category) return [];
    // Prefer subcategories from category data
    if (category.subcategories?.length > 0) {
      return category.subcategories;
    }
    // Fallback: derive from products
    const subs = [...new Set(
      products
        .filter((p) => p.subcategoryId && p.category === category.name)
        .map((p) => ({ id: p.subcategoryId, name: p.subcategory }))
    )];
    // Remove duplicates by id
    const seen = new Set();
    return subs.filter((s) => {
      if (!s.id || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [category, products]);

  // Filter products by subcategory + search text
  const filteredProducts = useMemo(() => {
    let result = products;
    if (selectedSubcategory) {
      result = result.filter(
        (p) => p.subcategoryId === selectedSubcategory
          || p.subcategory === subcategories.find((s) => s.id === selectedSubcategory)?.name
      );
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(
        (p) => p.name?.toLowerCase().includes(q)
          || p.subcategory?.toLowerCase().includes(q)
          || p.category?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, selectedSubcategory, subcategories, searchText]);

  // Reset subcategory on category change
  useEffect(() => {
    setSelectedSubcategory(null);
  }, [category?.id]);

  // Animate product area on subcategory switch
  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.6, duration: 80, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [selectedSubcategory, fadeAnim]);

  const quantities = useMemo(
    () => cartItems.reduce((a, i) => { a[i.id] = i.quantity; return a; }, {}),
    [cartItems]
  );

  const handleAdd = useCallback((product) => {
    if (!isAuthenticated) {
      Toast.show({ type: 'info', text1: 'Login required', text2: 'Please sign in to add items.' });
      onShowLogin?.();
      return;
    }
    onAddProduct(product);
  }, [isAuthenticated, onAddProduct, onShowLogin]);

  const renderProduct = useCallback(({ item }) => (
    <View style={{ width: CARD_WIDTH }}>
      <ProductCard
        product={item}
        quantity={quantities[item.id] || 0}
        onAdd={handleAdd}
      />
    </View>
  ), [quantities, handleAdd]);

  const headerHeight = 52;

  return (
    <View style={styles.container}>
      {/* ═══ Sticky Header ═══ */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {category?.name || 'Products'}
          </Text>
          <Text style={styles.headerMeta}>
            {filteredProducts.length} items • {category?.type === 'app' ? '🧇 The Waffle Guy' : '🛒 AaplaKart'}
          </Text>
        </View>
      </View>

      {/* ═══ Body: Rail + Products ═══ */}
      <View style={styles.body}>
        {/* Left: Subcategory Rail */}
        <SubcategoryRail
          subcategories={subcategories}
          selected={selectedSubcategory}
          onSelect={setSelectedSubcategory}
        />

        {/* Right: Product Grid */}
        <Animated.View style={[styles.productArea, { opacity: fadeAnim }]}>
          {/* Always-visible search bar with revolving border glow */}
          <View style={styles.searchRow}>
            <View style={styles.sweepWrap}>
              <Animated.View style={[styles.sweepLight, styles.sweepTop, { opacity: topOpacity, transform: [{ translateX: topX }] }]} />
              <Animated.View style={[styles.sweepLight, styles.sweepRight, { opacity: rightOpacity, transform: [{ translateY: rightY }] }]} />
              <Animated.View style={[styles.sweepLight, styles.sweepBottom, { opacity: bottomOpacity, transform: [{ translateX: bottomX }] }]} />
              <Animated.View style={[styles.sweepLight, styles.sweepLeft, { opacity: leftOpacity, transform: [{ translateY: leftY }] }]} />
              <View style={styles.searchInputWrap}>
                <Ionicons name="search-outline" size={16} color={COLORS.mutedText} />
                <TextInput
                  ref={searchRef}
                  placeholder={`Search in ${category?.name || 'products'}...`}
                  placeholderTextColor={COLORS.mutedText}
                  value={searchText}
                  onChangeText={setSearchText}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {searchText.length > 0 && (
                  <Pressable onPress={() => { setSearchText(''); searchRef.current?.focus(); }} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={COLORS.mutedText} />
                  </Pressable>
                )}
              </View>
            </View>
          </View>
          {loading ? (
            <View style={styles.skeletonGrid}>
              {SKELETON_DATA.map((sk) => (
                <SkeletonCard key={sk.id} />
              ))}
            </View>
          ) : (
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.productRow}
              contentContainerStyle={styles.productContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="basket-outline" size={48} color={COLORS.mutedText} />
                  <Text style={styles.emptyTitle}>No products found</Text>
                  <Text style={styles.emptyText}>
                    Try a different subcategory or check back later.
                  </Text>
                </View>
              }
              renderItem={renderProduct}
            />
          )}
        </Animated.View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fde6cf',
    height: 52,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerMeta: {
    fontSize: 11,
    color: COLORS.mutedText,
    marginTop: 1,
  },
  searchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Always-visible search bar with revolving border glow
  searchRow: {
    paddingHorizontal: SPACING.gridGap,
    paddingTop: 8,
    paddingBottom: 6,
  },
  sweepWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  sweepLight: {
    position: 'absolute',
    width: 40,
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 1.5,
    zIndex: 2,
  },
  sweepTop:    { top: -1.5, left: '50%', marginLeft: -20 },
  sweepRight:  { right: -1.5, top: '50%', width: 3, height: 40, marginTop: -20 },
  sweepBottom: { bottom: -1.5, left: '50%', marginLeft: -20 },
  sweepLeft:   { left: -1.5, top: '50%', width: 3, height: 40, marginTop: -20 },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    paddingVertical: 0,
  },
  // Body
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  productArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  productContent: {
    paddingHorizontal: SPACING.screenH,
    paddingTop: 8,
    paddingBottom: 120,
  },
  productRow: {
    gap: SPACING.gridGap,
    marginBottom: SPACING.gridGap,
    alignItems: 'stretch',
  },
  // Skeleton
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.screenH,
    gap: SPACING.gridGap,
    paddingTop: 8,
  },
  skeleton: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fde6cf',
    marginBottom: 10,
  },
  skelImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f3f4f6',
  },
  skelTextWrap: {
    padding: 10,
  },
  skelLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f3f4f6',
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.mutedText,
    textAlign: 'center',
    lineHeight: 19,
  },
});

export default ProductListingPage;
