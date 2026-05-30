// GUI category: Screen. Category Browser → PLP flow for both brands.
// `brand="kart"` → AaplaKart (Categories tab), `brand="app"` → The Waffle Guy (Waffle tab).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import Container from '../components/common/Container';
import CategoryBrowser from '../components/categories/CategoryBrowser';
import ProductListingPage from '../components/products/ProductListingPage';
import PromoSlider from '../components/promo/PromoSlider';
import { COLORS } from '../utils/constants';
import { scaleW, scaleH } from '../utils/helpers';
import { fetchProducts } from '../services/api';
import { useCartStore } from '../store/cartStore';

const BRAND_CONFIG = {
  kart: {
    type: 'kart',
    headerTitle: 'Categories',
    headerSubtitle: 'Shop by Category',
    layout: 'grid',
    showBrandHeader: false,
  },
  app: {
    type: 'app',
    headerTitle: 'Our Menu',
    layout: 'grid',
    showBrandHeader: true,
    brandName: 'The Waffle Guy',
    brandTag: 'Delicious waffles, delivered fresh!',
    brandLogo: require('../../assets/TheWaffelsGuy.png'),
    brandColor: '#d97706',
    promoPosition: 'waffle_offer',
  },
};

const BrandCategoryScreen = ({ brand = 'kart', isAuthenticated, onShowLogin }) => {
  const config = BRAND_CONFIG[brand] || BRAND_CONFIG.kart;
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);

  const addItem = useCartStore((state) => state.addItem);

  // Load products from backend
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetchProducts({ type: config.type });
        if (active && res?.products) setProducts(res.products);
      } catch (e) {
        console.log(`[BrandCategory:${brand}] Products fetch failed:`, e?.message);
      }
    };
    load();
    return () => { active = false; };
  }, [brand, config.type]);

  const handleAddProduct = useCallback((product, qty = 1) => {
    if (!isAuthenticated) {
      Toast.show({ type: 'info', text1: 'Login required', text2: 'Please sign in to add items.' });
      onShowLogin?.();
      return;
    }
    addItem(product, qty);
    if (qty > 1) {
      Toast.show({ type: 'success', text1: `${qty}x Added!`, text2: product.name, visibilityTime: 1200 });
    } else {
      Toast.show({ type: 'success', text1: 'Added!', text2: `${product.name} added to cart.` });
    }
  }, [isAuthenticated, addItem, onShowLogin]);

  const handleCategorySelect = useCallback((category) => {
    setSelectedCategory(category);
    setSelectedSubcategory(null);
  }, []);

  const handleSubcategorySelect = useCallback((sub) => {
    setSelectedSubcategory(sub);
  }, []);

  // ── Filter products by category/subcategory ────────────────────
  const categoryProducts = useMemo(() => {
    let filtered = products;
    if (selectedCategory) {
      filtered = filtered.filter((p) => {
        if (selectedCategory.subcategories?.length) {
          return p.categoryId === selectedCategory.id
            || selectedCategory.subcategories.some((s) => s.id === p.subcategoryId);
        }
        return p.category === selectedCategory.name || p.categoryId === selectedCategory.id;
      });
    }
    if (selectedSubcategory) {
      filtered = filtered.filter((p) => p.subcategory === selectedSubcategory);
    }
    return filtered;
  }, [products, selectedCategory, selectedSubcategory]);

  // ── PLP view (category selected) ──
  if (selectedCategory) {
    return (
      <Container>
        <ProductListingPage
          category={selectedCategory}
          products={categoryProducts}
          loading={false}
          onBack={() => handleCategorySelect(null)}
          onAddProduct={handleAddProduct}
          isAuthenticated={isAuthenticated}
          onShowLogin={onShowLogin}
        />
      </Container>
    );
  }

  // ── Brand Header (only for "app" brand) ──
  const ListHeaderComponent = config.showBrandHeader ? (
    <View style={styles.listHeaderWrap}>
      <View style={[styles.premiumHeader, { backgroundColor: config.brandColor }]}>
        <View style={styles.headerContent}>
          <Image
            source={config.brandLogo}
            style={{ width: scaleW(100), height: scaleW(100), marginBottom: scaleH(6) }}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>{config.brandName}</Text>
          <Text style={styles.brandTag}>{config.brandTag}</Text>
        </View>
      </View>
      <PromoSlider brand="waffle" position={config.promoPosition} style={styles.offerSection} />
    </View>
  ) : undefined;

  // ── Category Browser view (default) ──
  return (
    <Container contentStyle={styles.containerContent}>
      {!config.showBrandHeader && (
        <View style={styles.header}>
          <Text style={styles.title}>{config.headerTitle}</Text>
        </View>
      )}
      <CategoryBrowser
        type={config.type}
        layout={config.layout}
        headerTitle={config.headerSubtitle || config.headerTitle}
        onSelectCategory={handleCategorySelect}
        onSelectSubcategory={handleSubcategorySelect}
        ListHeaderComponent={ListHeaderComponent}
      />
    </Container>
  );
};

const styles = StyleSheet.create({
  containerContent: { flex: 1, paddingHorizontal: 0 },
  header: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6,
    backgroundColor: COLORS.background,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },

  // List header wrapper — edge-to-edge (counter ScrollView padding)
  listHeaderWrap: {
    marginHorizontal: -20,
  },

  // Premium header (Waffle brand)
  premiumHeader: {
    paddingVertical: scaleH(16),
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  brandName: {
    fontSize: scaleW(22), fontWeight: '900', color: '#fff',
    letterSpacing: -0.3, textAlign: 'center',
  },
  brandTag: {
    fontSize: scaleW(13), color: 'rgba(255,255,255,0.85)',
    marginTop: scaleH(3), fontWeight: '500', textAlign: 'center',
  },

  // Promo slider
  offerSection: { marginTop: 8 },
});

export default BrandCategoryScreen;
