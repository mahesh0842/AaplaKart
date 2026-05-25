// GUI category: Products. Responsive grid — auto 2/3 cols, or force via `numColumns` prop. Memoized.
import React, { memo, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import ProductCard from './ProductCard';
import { COLORS, SPACING } from '../../utils/constants';
import { isTablet, getCardWidth } from '../../utils/helpers';

const DEFAULT_GAP = SPACING.gridGap;

const ProductGrid = memo(({
  products,
  quantities,
  onAddProduct,
  showHeading = true,
  heading = 'All Products',
  numColumns: forcedColumns,
  gap = DEFAULT_GAP,
  cardProps,
}) => {
  const isTab = isTablet();
  const numColumns = forcedColumns || (isTab ? 3 : 2);

  const cardWidth = useMemo(() => getCardWidth(numColumns, gap), [numColumns, gap]);

  return (
    <View style={styles.container}>
      {showHeading && <Text style={styles.heading}>{heading}</Text>}
      <FlatList
        data={products}
        numColumns={numColumns}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={[styles.content, { gap }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nothing in this filter yet</Text>
            <Text style={styles.emptyText}>
              Try a different category chip or clear the search.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ width: cardWidth }}>
            <ProductCard
              product={item}
              quantity={quantities[item.id] || 0}
              onAdd={onAddProduct}
 v              {...cardProps}
            />
          </View>
        )}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.sectionGap,
    paddingHorizontal: SPACING.screenH,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 16,
  },
  content: {
    paddingBottom: 24,
  },
  columnWrapper: {
    gap: SPACING.gridGap,
    alignItems: 'stretch',
  },
  emptyState: {
    backgroundColor: COLORS.card,
    borderRadius: SPACING.radiusLg,
    padding: 20,
    borderWidth: 1,
    borderColor: '#fde6cf',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.mutedText,
    lineHeight: 19,
  },
});

export default ProductGrid;

