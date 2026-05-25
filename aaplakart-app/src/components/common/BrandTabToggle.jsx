// GUI category: Common primitives. Animated brand toggle for tab bar — switches between AaplaKart and The Waffle Guy.
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useBrandMode } from '../../brand-mode/BrandContext';
import { COLORS } from '../../utils/constants';

const TRACK_WIDTH = 76;
const TRACK_HEIGHT = 32;

// Slider is exactly 50% of track width = width of one tab
const SLIDER_WIDTH = TRACK_WIDTH / 2; // 38

const SLIDER_KART_BG = COLORS.primary; // #f97316
const SLIDER_WAFFLE_BG = '#d97706';

const BrandTabToggle = () => {
  const { isWaffleMode, toggleWaffleMode } = useBrandMode();
  const navigation = useNavigation();
  const slideAnim = useRef(new Animated.Value(0)).current; // 0 = left (Kart), 1 = right (Waffle)

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isWaffleMode ? 1 : 0,
      useNativeDriver: true,
      damping: 24,
      stiffness: 250,
      mass: 0.25,
    }).start();
  }, [isWaffleMode, slideAnim]);

  const handlePress = () => {
    const wasWaffle = isWaffleMode;
    toggleWaffleMode();

    if (wasWaffle) {
      navigation.navigate('Home');
    } else {
      navigation.navigate('Waffle');
    }
  };

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SLIDER_WIDTH],
  });

  return (
    <Pressable onPress={handlePress} style={styles.wrapper}>
      <View style={styles.track}>
        {/* Slider highlight — exactly 50% width, slides behind active tab (no icon/text inside) */}
        <Animated.View
          style={[
            styles.slider,
            {
              transform: [{ translateX }],
              backgroundColor: isWaffleMode ? SLIDER_WAFFLE_BG : SLIDER_KART_BG,
            },
          ]}
        />

        {/* Left tab — AaplaKart (icon only) */}
        <View style={styles.tab}>
          <Ionicons
            name={!isWaffleMode ? 'leaf' : 'leaf-outline'}
            size={16}
            color={!isWaffleMode ? '#fff' : COLORS.mutedText}
          />
        </View>

        {/* Right tab — Waffle (icon only) */}
        <View style={styles.tab}>
          <Ionicons
            name={isWaffleMode ? 'ice-cream' : 'ice-cream-outline'}
            size={16}
            color={isWaffleMode ? '#fff' : COLORS.mutedText}
          />
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  slider: {
    position: 'absolute',
    width: SLIDER_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    top: 0,
    left: 0,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: TRACK_HEIGHT,
    zIndex: 1,
  },
});

export default BrandTabToggle;
