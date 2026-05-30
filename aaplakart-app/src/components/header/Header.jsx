// GUI category: Header. Compact header — real location, blinking thunder badge, small search.
// Brand name animates: AaplaKart ↔ AaplaCart with slide+fade flip every 3s.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LocationSelector from './LocationSelector';
import SearchBar from './SearchBar';
import DeliveryBadge from './DeliveryBadge';
import { COLORS, SPACING } from '../../utils/constants';
import { getCurrentLocation, getLocationDisplayName } from '../../services/locationService';

const Header = ({ searchValue, onSearchChange }) => {
  const [displayLocation, setDisplayLocation] = useState('Detecting...');

  // ── K↔C slide+fade flip animation ─────────────────────────
  const flipAnim = useRef(new Animated.Value(0)).current; // 0=Kart, 1=Cart
  const [isKart, setIsKart] = useState(true);

  useEffect(() => {
    const runFlip = () => {
      const toValue = isKart ? 1 : 0;
      setIsKart((prev) => !prev);
      Animated.timing(flipAnim, {
        toValue,
        duration: 500,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: true,
      }).start();
    };

    // First flip after 2.5s, then every 3s
    const initialDelay = setTimeout(runFlip, 2500);
    const interval = setInterval(runFlip, 3000);
    return () => { clearTimeout(initialDelay); clearInterval(interval); };
  }, [isKart, flipAnim]);

  // ── Derived animated values ────────────────────────────────
  // K: slides up + fades out (center → up)
  const kTranslateY = flipAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -28] });
  const kOpacity = flipAnim.interpolate({ inputRange: [0, 0.25, 1], outputRange: [1, 0, 0] });
  // C: slides up from below + fades in (below → center)
  const cTranslateY = flipAnim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
  const cOpacity = flipAnim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0, 0, 1] });

  // ── Location fetch ──────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const fetchLocation = async () => {
      const loc = await getCurrentLocation();
      if (!mounted) return;
      if (loc.success) {
        const name = await getLocationDisplayName(loc.latitude, loc.longitude);
        if (mounted) setDisplayLocation(name);
      } else {
        setDisplayLocation('Navi Mumbai, MH');
      }
    };
    fetchLocation();
    return () => { mounted = false; };
  }, []);

  return (
    <View style={styles.container}>
      {/* Top row: location only */}
      <View style={styles.topRow}>
        <View style={styles.locationWrap}>
          <Ionicons name="location-outline" size={14} color={COLORS.primary} />
          <LocationSelector location={displayLocation} />
        </View>
      </View>

      {/* Brand row: logo + name + delivery badge (horizontally aligned) */}
      <View style={styles.brandRow}>
        <View style={styles.brandLeft}>
          <View style={styles.logoCircle}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.brandNameWrap}>
            <Text style={styles.brandName}>Aapla</Text>
            <View style={styles.letterSlot}>
              <Animated.Text
                style={[styles.brandName, styles.swapLetter, {
                  opacity: kOpacity,
                  transform: [{ translateY: kTranslateY }],
                }]}
              >
                K
              </Animated.Text>
              <Animated.Text
                style={[styles.brandName, styles.swapLetter, {
                  opacity: cOpacity,
                  transform: [{ translateY: cTranslateY }],
                }]}
              >
                C
              </Animated.Text>
            </View>
            <Text style={styles.brandName}>art</Text>
          </View>
        </View>
        <DeliveryBadge />
      </View>

      {/* Compact search bar */}
      <SearchBar value={searchValue} onChangeText={onSearchChange} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.screenH,
    paddingTop: SPACING.screenV,
    paddingBottom: 4,
    backgroundColor: COLORS.background,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    overflow: 'hidden',
  },
  locationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logo: {
    width: 28,
    height: 28,
  },
  brandNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  letterSlot: {
    width: 15,
    height: 28,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swapLetter: {
    position: 'absolute',
  },
});

export default Header;
