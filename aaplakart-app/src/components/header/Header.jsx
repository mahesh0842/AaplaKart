// GUI category: Header. Compact header — real location, blinking thunder badge, small search.
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LocationSelector from './LocationSelector';
import SearchBar from './SearchBar';
import DeliveryBadge from './DeliveryBadge';
import { COLORS, SPACING } from '../../utils/constants';
import { getCurrentLocation, getLocationDisplayName } from '../../services/locationService';

const Header = ({ searchValue, onSearchChange }) => {
  const [displayLocation, setDisplayLocation] = useState('Detecting...');

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
      {/* Top row: location left, delivery badge right */}
      <View style={styles.topRow}>
        <View style={styles.locationWrap}>
          <Ionicons name="location-outline" size={14} color={COLORS.primary} />
          <LocationSelector location={displayLocation} />
        </View>
        <DeliveryBadge />
      </View>

      {/* Brand row: small circular logo + app name */}
      <View style={styles.brandRow}>
        <View style={styles.logoCircle}>
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.brandName}>AaplaKart</Text>
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
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  locationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  switchRow: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  switchRow: {
    marginBottom: 10,
  },
});

export default Header;
