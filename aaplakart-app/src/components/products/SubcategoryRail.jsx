// Vertical subcategory rail — Blinkit-style left sidebar.
// Shows subcategories with circular icon/indicator. Active one highlighted.
import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

const RAIL_WIDTH = 82;

/**
 * @param {object} props
 * @param {Array<{id: string, name: string, categoryId?: string}>} props.subcategories
 * @param {string|null} props.selected — currently selected subcategory id
 * @param {(id: string|null) => void} props.onSelect — called with subcategory id (null = all)
 */
const SubcategoryRail = memo(({ subcategories, selected, onSelect }) => {
  const scrollRef = useRef(null);
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  const selectedIndex = subcategories.findIndex((s) => s.id === selected);

  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: selectedIndex >= 0 ? selectedIndex * 64 : 0,
      useNativeDriver: true,
      tension: 200,
      friction: 20,
    }).start();
  }, [selectedIndex, indicatorAnim]);

  if (!subcategories || subcategories.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyRail}>
          <Ionicons name="list-outline" size={20} color={COLORS.mutedText} />
          <Text style={styles.emptyText}>No filters</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Green indicator bar */}
      <Animated.View
        style={[
          styles.indicator,
          { transform: [{ translateY: indicatorAnim }] },
        ]}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* "All" option */}
        <Pressable
          key="all"
          onPress={() => onSelect(null)}
          style={[styles.item, selected === null && styles.itemActive]}
        >
          <View style={[styles.circle, selected === null && styles.circleActive]}>
            <Ionicons
              name="grid-outline"
              size={18}
              color={selected === null ? '#fff' : COLORS.mutedText}
            />
          </View>
          <Text
            style={[styles.label, selected === null && styles.labelActive]}
            numberOfLines={1}
          >
            All
          </Text>
        </Pressable>

        {subcategories.map((sub) => {
          const active = selected === sub.id;
          return (
            <Pressable
              key={sub.id}
              onPress={() => onSelect(active ? null : sub.id)}
              style={[styles.item, active && styles.itemActive]}
            >
              <View style={[styles.circle, active && styles.circleActive]}>
                <Ionicons
                  name="ellipse-outline"
                  size={18}
                  color={active ? '#fff' : COLORS.mutedText}
                />
              </View>
              <Text
                style={[styles.label, active && styles.labelActive]}
                numberOfLines={2}
              >
                {sub.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: RAIL_WIDTH,
    backgroundColor: COLORS.card,
    borderRightWidth: 1,
    borderRightColor: '#fde6cf',
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: 8,
    width: 3,
    height: 48,
    backgroundColor: COLORS.accent,
    borderRadius: 2,
    zIndex: 2,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  item: {
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  itemActive: {
    backgroundColor: '#f0fdf4',
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  circleActive: {
    backgroundColor: COLORS.accent,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.mutedText,
    textAlign: 'center',
    lineHeight: 12,
  },
  labelActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  emptyRail: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 10,
    color: COLORS.mutedText,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SubcategoryRail;
