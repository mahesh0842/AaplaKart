// GUI category: Promo slider. Dynamic banner carousel fetched from backend API.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getShadowStyle } from '../../utils/helpers';
import { fetchPromos } from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_HEIGHT = Math.max(120, SCREEN_WIDTH * 0.32);

const resolveImage = (img) => {
  if (!img) return null;
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  return 'http://localhost:8000/static/images/' + img.replace(/^\/+/, '');
};

const PromoCard = ({ item, onPress }) => {
  const imageUrl = resolveImage(item.image);
  const bgColor = item.bgColor || '#f97316';
  const textColor = item.textColor || '#ffffff';
  return (
    <Pressable
      onPress={() => onPress?.(item)}
      style={({ pressed }) => [styles.card, { backgroundColor: bgColor, opacity: pressed ? 0.94 : 1 }]}
    >
      <View style={styles.cardInner}>
        <View style={styles.textArea}>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>{item.title}</Text>
          {item.subtitle ? <Text style={[styles.subtitle, { color: textColor + 'cc' }]} numberOfLines={2}>{item.subtitle}</Text> : null}
          {item.code ? (
            <View style={styles.codeWrap}>
              <Text style={[styles.codeLabel, { color: textColor }]}>{item.code}</Text>
            </View>
          ) : null}
        </View>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imageAlt}>
            <Ionicons name="pricetag" size={28} color={textColor + '99'} />
          </View>
        )}
      </View>
    </Pressable>
  );
};

const PaginationDots = ({ total, activeIndex, color }) => (
  <View style={styles.dotsRow}>
    {Array.from({ length: total }, (_, i) => (
      <View key={i} style={[styles.dot, { backgroundColor: i === activeIndex ? (color || '#f97316') : (color || '#f97316') + '33', width: i === activeIndex ? 22 : 7 }]} />
    ))}
  </View>
);

const PromoSlider = ({ brand = 'kart', position = 'home_banner', onPromoPress, autoScrollInterval = 3500, style }) => {
  const flatListRef = useRef(null);
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let active = true;
    fetchPromos({ brand, position })
      .then((res) => { if (active && res?.promos) setPromos(res.promos); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [brand, position]);

  useEffect(() => {
    if (promos.length <= 1) return;
    const t = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % promos.length;
        flatListRef.current?.scrollToIndex?.({ index: next, animated: true });
        return next;
      });
    }, autoScrollInterval);
    return () => clearInterval(t);
  }, [promos.length, autoScrollInterval]);

  const onScroll = useCallback((e) => {
    setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH));
  }, []);

  const handlePromoPress = useCallback((promo) => { onPromoPress?.(promo); }, [onPromoPress]);

  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <View style={[styles.card, styles.skeletonCard]}>
          <View style={styles.skeletonContent}>
            <View style={styles.skeletonText}>
              <View style={styles.skelLine} />
              <View style={[styles.skelLine, { width: '60%', marginTop: 6 }]} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (promos.length === 0) return null;

  return (
    <View style={[styles.container, style]}>
      <FlatList
        ref={flatListRef} data={promos} keyExtractor={(item) => item.id}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + 8} decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        onScroll={onScroll} scrollEventThrottle={16}
        renderItem={({ item }) => <PromoCard item={item} onPress={handlePromoPress} />}
      />
      {promos.length > 1 && <PaginationDots total={promos.length} activeIndex={activeIndex} color={promos[activeIndex]?.bgColor || '#f97316'} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: 6 },
  listContent: { paddingHorizontal: 4 },
  card: { width: CARD_WIDTH, height: CARD_HEIGHT, marginHorizontal: 4, borderRadius: 18, overflow: 'hidden', ...getShadowStyle('#00000022') },
  cardInner: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 18 },
  textArea: { flex: 1, marginRight: 12, justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 12, fontWeight: '500', marginBottom: 8, lineHeight: 16 },
  codeWrap: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.18)' },
  codeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  image: { width: 72, height: 72, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)' },
  imageAlt: { width: 72, height: 72, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, gap: 6 },
  dot: { height: 6, borderRadius: 3 },
  skeletonCard: { width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: '#e5e7eb', borderRadius: 18, marginHorizontal: 4 },
  skeletonContent: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 18 },
  skeletonText: { flex: 1, marginRight: 12 },
  skelLine: { height: 14, backgroundColor: '#d1d5db', borderRadius: 6, width: '80%' },
});

export default PromoSlider;
