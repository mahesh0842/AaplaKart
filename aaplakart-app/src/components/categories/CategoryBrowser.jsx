// ── Universal CategoryBrowser ───────────────────────────────────────
// Single source of truth for all category/subcategory UI across the app.
// Fetches data from backend (or accepts pre-loaded data via props).
// Supports: grid layout, split layout, horizontal chips, section grouping.
// Used by: HomeScreen, BrandCategoryScreen.
// Replaces: CategoryChip, CategoryChips, CategoryItem, CategoryGrid,
//           CategoryPanel, SubcategoryChips, CategoryBrowseLayout.
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { getShadowStyle } from '../../utils/helpers';
import { fetchSections } from '../../services/api';

// ── Constants ───────────────────────────────────────────────────────

const FALLBACK_COLORS = [
  '#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3',
  '#ede9fe', '#fce4ec', '#e0f2fe', '#fef9c3',
  '#ffedd5', '#e0f2fe', '#f0fdf4', '#fef2f2',
];

const BACKEND_STATIC = 'http://localhost:8000/static/images';

const resolveImage = (img) => {
  if (!img) return null;
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  return `${BACKEND_STATIC}/${img.replace(/^\/+/, '')}`;
};

// ── Subcategory Chips (inline, no separate file) ─────────────────

const SubcatChips = memo(({ subcategories, selected, onSelect }) => {
  if (!subcategories?.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.subChipsContent}
    >
      {subcategories.map((sub) => {
        const label = typeof sub === 'string' ? sub : sub.name;
        const active = selected === label;
        return (
          <Pressable
            key={label}
            onPress={() => onSelect(active ? null : label)}
            style={[styles.subChip, active ? styles.subChipActive : styles.subChipInactive]}
          >
            <Text style={[styles.subChipText, active ? styles.subChipTextActive : styles.subChipTextInactive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

// ── Category Card ───────────────────────────────────────────────

const CategoryCard = memo(({ item, onPress, colorIndex, variant = 'grid' }) => {
  const bgColor = FALLBACK_COLORS[colorIndex % FALLBACK_COLORS.length];
  const imageUrl = resolveImage(item.image);

  return (
    <Pressable
      accessibilityLabel={`Category ${item.name}`}
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        variant === 'grid' ? styles.gridCard : styles.chipCard,
        pressed && styles.cardPressed,
      ]}
    >
      {variant === 'grid' ? (
        <>
          <View style={[styles.gridImageWrap, { backgroundColor: bgColor }]}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.gridImage} resizeMode="cover" />
            ) : (
              <View style={styles.gridImagePlaceholder}>
                <Ionicons name="apps-outline" size={28} color={COLORS.primary} />
              </View>
            )}
          </View>
          <Text style={styles.gridLabel} numberOfLines={2}>{item.name}</Text>
        </>
      ) : (
        <View style={styles.chipInner}>
          <View style={[styles.chipIconWrap, { backgroundColor: bgColor }]}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.chipImage} resizeMode="cover" />
            ) : (
              <Ionicons name="apps-outline" size={18} color={COLORS.primary} />
            )}
          </View>
          <Text style={styles.chipLabel} numberOfLines={1}>{item.name}</Text>
        </View>
      )}
    </Pressable>
  );
});

// ── Section Header ──────────────────────────────────────────────

const SectionHeader = memo(({ section }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionIcon}>{section.type === 'app' ? '🧇' : '🛒'}</Text>
    <Text style={styles.sectionTitle}>{section.name}</Text>
  </View>
));

// ── Main CategoryBrowser Component ──────────────────────────────

const CategoryBrowser = memo(({
  // Data (optional — if not provided, fetches from backend)
  sections: propSections,
  // Callbacks
  onSelectCategory,
  onSelectSubcategory,
  // Layout
  layout = 'grid',         // 'grid' | 'split' | 'chips'
  columns,
  showHeader = true,
  headerTitle,
  // Filter
  type = 'all',            // 'kart' | 'app' | 'all'
  // Refresh
  refreshing: externalRefreshing,
  onRefresh: externalOnRefresh,
  // Navigation
  selectedCategoryId,
  selectedSubcategory,
  // Section overrides
  sectionIcons,
  // Style
  contentContainerStyle,
  ListHeaderComponent,
  ListFooterComponent,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const [internalSections, setInternalSections] = useState([]);
  const [loading, setLoading] = useState(!propSections);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Resolved sections
  const sections = propSections || internalSections;

  // ── Responsive columns ──────────────────────────────────────────
  const numColumns = columns || (screenWidth < 400 ? 2 : 3);
  const gap = 10;
  const hPadding = 20;
  const cardWidth = (screenWidth - hPadding * 2 - gap * (numColumns - 1)) / numColumns;
  const imageSize = cardWidth;

  // ── Fetch from backend ──────────────────────────────────────────
  useEffect(() => {
    if (propSections) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetchSections({ type });
        if (active && res?.sections) setInternalSections(res.sections);
      } catch (e) {
        console.log('[CategoryBrowser] Fetch failed:', e?.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [propSections, type]);

  // ── Category selection (instant, no animation) ──────────────────
  const handleCategoryPress = useCallback((category) => {
    // "All" category → deselect and show everything
    if (category?.id === 'cat-all') {
      setActiveCategory(null);
      onSelectCategory?.(null);
      return;
    }
    // Toggle: tap same category again → deselect
    if (category && activeCategory?.id === category.id) {
      setActiveCategory(null);
      onSelectCategory?.(null);
    } else {
      setActiveCategory(category);
      onSelectCategory?.(category);
    }
  }, [activeCategory, onSelectCategory]);

  const handleSubcategorySelect = useCallback((sub) => {
    onSelectSubcategory?.(sub);
  }, [onSelectSubcategory]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetchSections({ type });
      if (res?.sections) setInternalSections(res.sections);

    } catch (e) {
      console.log('[CategoryBrowser] Refresh failed:', e?.message);
    } finally {
      setRefreshing(false);
    }
  }, [type]);

  const isRefreshing = externalRefreshing ?? refreshing;
  const onRefreshAction = externalOnRefresh ?? handleRefresh;

  // ── Build flat category list for chips mode ────────────────────
  const allCategories = useMemo(() => {
    const cats = [];
    // Prepend "All" chip — deselects category, shows all products
    cats.push({ id: 'cat-all', name: 'All', sectionName: '', sectionType: '', image: '' });
    sections.forEach((sec) => {
      (sec.categories || []).forEach((cat) => {
        cats.push({ ...cat, sectionName: sec.name, sectionType: sec.type });
      });
    });
    return cats;
  }, [sections]);

  // ── Active category's subcategories ─────────────────────────────
  const activeSubcategories = useMemo(() => {
    if (!activeCategory) return [];
    return activeCategory.subcategories || [];
  }, [activeCategory]);

  // ── Loading state ────────────────────────────────────────────────
  if (loading && !propSections) {
    return (
      <View style={styles.loader}>
        <Ionicons name="hourglass-outline" size={32} color={COLORS.mutedText} />
        <Text style={styles.loaderText}>Loading categories...</Text>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER: CHIPS layout — horizontal scrollable category chips
  // Used by HomeScreen for category filtering
  // ═══════════════════════════════════════════════════════════════════
  if (layout === 'chips') {
    return (
      <View style={styles.chipsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScrollContent}
        >
          {allCategories.map((cat, idx) => {
            const isAll = cat.id === 'cat-all';
            const active = isAll ? !activeCategory : activeCategory?.id === cat.id;
            return (
              <Pressable
                key={cat.id + '-' + (cat.sectionId || cat.sectionName || idx)}
                onPress={() => handleCategoryPress(cat)}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipActive,
                  pressed && !active && styles.chipPressed,
                ]}
              >
                {isAll ? (
                  <Ionicons
                    name="apps-outline"
                    size={18}
                    color={active ? '#fff' : '#9ca3af'}
                  />
                ) : cat.image ? (
                  <Image
                    source={{ uri: resolveImage(cat.image) }}
                    style={styles.chipIconImg}
                  />
                ) : (
                  <Ionicons
                    name="grid-outline"
                    size={18}
                    color={active ? '#fff' : '#9ca3af'}
                  />
                )}
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Subcategory chips for active category */}
        {activeSubcategories.length > 0 && (
          <SubcatChips
            subcategories={activeSubcategories}
            selected={selectedSubcategory}
            onSelect={handleSubcategorySelect}
          />
        )}
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER: GRID layout — multi-column category grid (default)
  // Used by BrandCategoryScreen
  // ═══════════════════════════════════════════════════════════════════
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.gridContent, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefreshAction} />
      }
    >
      {ListHeaderComponent}

      {showHeader && (
        <Text style={styles.gridHeader}>{headerTitle || 'Shop by Category'}</Text>
      )}

      {sections.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Ionicons name="basket-outline" size={48} color={COLORS.mutedText} />
          <Text style={styles.emptyTitle}>No categories yet</Text>
          <Text style={styles.emptyText}>Check back later for new categories.</Text>
        </View>
      )}

      {sections.map((section, secIdx) => (
        <View key={section.id || secIdx}>
          {/* Section Header */}
          {(section.categories?.length || 0) > 0 && sections.length > 1 && (
            <SectionHeader section={section} />
          )}

          {/* Active category — show subcategory chips */}
          {activeCategory && section.categories?.some((c) => c.id === activeCategory.id) ? (
            <View style={styles.subSection}>
              <SubcatChips
                subcategories={activeSubcategories}
                selected={selectedSubcategory}
                onSelect={handleSubcategorySelect}
              />
            </View>
          ) : null}

          {/* Category Grid Row */}
          {section.categories?.length > 0 && (
            <Animated.View style={{ opacity: fadeAnim }}>
              <View style={[styles.gridRow, { gap }]}>
                {section.categories.map((cat, idx) => (
                  <View key={cat.id} style={{ width: cardWidth, marginBottom: 14 }}>
                    <CategoryCard
                      item={cat}
                      colorIndex={idx}
                      variant="grid"
                      onPress={handleCategoryPress}
                    />
                  </View>
                ))}
              </View>
            </Animated.View>
          )}
        </View>
      ))}

      {/* Subcategory chips below grid when category selected */}
      {activeCategory && !sections.some((s) => s.categories?.some((c) => c.id === activeCategory.id)) && (
        <View style={styles.subSectionBottom}>
          <SubcatChips
            subcategories={activeSubcategories}
            selected={selectedSubcategory}
            onSelect={handleSubcategorySelect}
          />
        </View>
      )}

      <View style={{ height: 24 }} />
      {ListFooterComponent}
    </ScrollView>
  );
});

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Loader ──
  loader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loaderText: {
    marginTop: 10,
    color: COLORS.mutedText,
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.mutedText,
    marginTop: 6,
  },

  // ── Section Header ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionIcon: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },

  // ── Grid Layout ──
  gridContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  gridHeader: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 16,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  // ── Grid Card ──
  gridCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fde6cf',
    ...getShadowStyle(COLORS.shadow),
  },
  cardPressed: {
    opacity: 0.85,
  },
  gridImageWrap: {
    width: '100%',
    aspectRatio: 1,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: {
    padding: 10,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 16,
  },

  // ── Subcategory Section ──
  subSection: {
    marginBottom: 4,
  },
  subSectionBottom: {
    marginTop: 8,
  },
  subChipsContent: {
    paddingVertical: 8,
    gap: 8,
  },
  subChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  subChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  subChipInactive: {
    backgroundColor: COLORS.card,
    borderColor: '#fde6cf',
  },
  subChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  subChipTextActive: {
    color: '#fff',
  },
  subChipTextInactive: {
    color: COLORS.mutedText,
  },

  // ── Chips Layout (HomeScreen) ──
  chipsWrapper: {
    marginTop: 4,
    marginBottom: 4,
  },
  chipsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 1 },
    }),
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOpacity: 0.30,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 6 },
    }),
  },
  chipPressed: {
    backgroundColor: '#f9fafb',
    borderColor: '#d1d5db',
    transform: [{ scale: 0.96 }],
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  chipLabelActive: {
    color: '#fff',
  },
  chipIconImg: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },

  // ── Chip Card (for grid variant = chip) ──
  chipCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fde6cf',
    padding: 10,
    ...getShadowStyle(COLORS.shadow),
  },
  chipInner: {
    alignItems: 'center',
    gap: 6,
  },
  chipIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chipImage: {
    width: '100%',
    height: '100%',
  },
});

export { SubcatChips, CategoryCard, SectionHeader };
export default CategoryBrowser;
