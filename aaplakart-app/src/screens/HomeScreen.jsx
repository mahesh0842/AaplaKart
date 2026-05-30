// GUI category: Screen. Fixed header → search → categories (backend) → products (backend).
// Uses universal CategoryBrowser for all category/subcategory UI.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import Header from '../components/header/Header';
import CategoryBrowser from '../components/categories/CategoryBrowser';
import ProductGrid from '../components/products/ProductGrid';
import Container from '../components/common/Container';
import PromoSlider from '../components/promo/PromoSlider';
// ActiveOrderTracker inlined to avoid import resolution issues
import ActiveOrderTracker from '../components/common/ActiveOrderTracker';
import { fetchProducts } from '../services/api';
import { useCartStore } from '../store/cartStore';

const HomeScreen = ({ isAuthenticated, onShowLogin }) => {
  const scrollRef = useRef(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const cartItems = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);

  // ── Fetch products from backend ──────────────────────────────────
  useEffect(() => {
    let active = true;

    const load = async () => {
      setProductsLoading(true);
      try {
        const params = { type: 'kart' };
        if (selectedCategory) params.category = selectedCategory.name;
        if (selectedSubcategory) params.subcategory = selectedSubcategory;
        if (searchValue.trim()) params.search = searchValue.trim();

        const res = await fetchProducts(params);
        if (active && res?.products) setProducts(res.products);
      } catch (e) {
        console.log('[Home] Products fetch failed:', e?.message);
      } finally {
        if (active) setProductsLoading(false);
      }
    };

    // Debounce search
    const timer = setTimeout(load, searchValue ? 300 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [selectedCategory, selectedSubcategory, searchValue]);

  const handleAddProduct = useCallback((product, qty = 1) => {
    if (!isAuthenticated) {
      Toast.show({
        type: 'info',
        text1: 'Login required',
        text2: 'Please log in or sign up to add items to your cart.',
      });
      onShowLogin();
      return;
    }
    addItem(product, qty);
    // Quick haptic-like feedback — Toast for confirmation
    if (qty > 1) {
      Toast.show({ type: 'success', text1: `${qty}x Added!`, text2: product.name, visibilityTime: 1200 });
    }
  }, [isAuthenticated, addItem, onShowLogin]);

  const quantities = useMemo(
    () =>
      cartItems.reduce((acc, item) => {
        acc[item.id] = item.quantity;
        return acc;
      }, {}),
    [cartItems]
  );

  const handleShopNow = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetchProducts({ type: 'kart' });
      if (res?.products) setProducts(res.products);
    } catch (error) {
      console.log('[Home] Refresh failed:', error?.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCategorySelect = useCallback((category) => {
    setSelectedCategory(category);
    setSelectedSubcategory(null);
  }, []);

  const handleSubcategorySelect = useCallback((sub) => {
    setSelectedSubcategory(sub);
  }, []);

  return (
    <Container contentStyle={styles.containerContent}>
      {/* Fixed top: header with logo + search */}
      <Header searchValue={searchValue} onSearchChange={setSearchValue} />
      {/* Active order tracker — shows only when there's a live order */}
      <View style={styles.trackerRow}>
        <ActiveOrderTracker />
      </View>
      {/* Category + subcategory chips (universal component, data from backend) */}
      <CategoryBrowser
        layout="chips"
        type="kart"
        selectedCategoryId={selectedCategory?.id}
        selectedSubcategory={selectedSubcategory}
        onSelectCategory={handleCategorySelect}
        onSelectSubcategory={handleSubcategorySelect}
      />

      {/* Scrollable content: promo + products */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PromoSlider brand="kart" position="home_banner" onPromoPress={handleShopNow} />
        <ProductGrid
          products={products}
          quantities={quantities}
          onAddProduct={handleAddProduct}
          showHeading={false}
          cardProps={{ isAuthenticated, onShowLogin }}
        />
      </ScrollView>
    </Container>
  );
};

const styles = StyleSheet.create({
  containerContent: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  trackerRow: {
    marginBottom: 2,
  },
});

export default HomeScreen;

