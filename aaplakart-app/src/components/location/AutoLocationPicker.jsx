// ── Blinkit/Zomato-style Auto Location Picker ─────────────────────
// Full-screen map modal with auto-detect, draggable pin, and reverse geocode.
// Separate component — can be reused anywhere an address needs to be picked.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../utils/constants';
import { getShadowStyle } from '../../utils/helpers';
import {
  requestLocationPermission,
  getCurrentLocation,
} from '../../services/locationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Props ───────────────────────────────────────────────────────
/**
 * @param {boolean} visible
 * @param {() => void} onClose
 * @param {(data: LocationResult) => void} onConfirm
 *
 * LocationResult = {
 *   latitude: number,
 *   longitude: number,
 *   displayName: string,
 *   city: string,
 *   area: string,
 *   pincode: string,
 * }
 */

const AutoLocationPicker = ({ visible, onClose, onConfirm }) => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const [step, setStep] = useState('detecting'); // 'detecting' | 'map' | 'error'
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [displayName, setDisplayName] = useState('Detecting location...');
  const [detectedPincode, setDetectedPincode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  // ── Reverse geocode with pincode extraction ────────────────
  const resolveLocation = useCallback(async (latitude, longitude) => {
    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addresses && addresses.length > 0) {
        const addr = addresses[0];
        const parts = [addr.city, addr.region, addr.country].filter(Boolean);
        const name = parts.join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        const pincode = addr.postalCode || '';
        return { name, pincode };
      }
      return { name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, pincode: '' };
    } catch {
      return { name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, pincode: '' };
    }
  }, []);

  // ── Step 1: Auto-detect location on mount ──────────────────
  useEffect(() => {
    if (!visible) return;

    let active = true;
    const detect = async () => {
      setStep('detecting');
      setErrorMsg('');

      try {
        // Request permission
        const perm = await requestLocationPermission();
        if (!perm.granted) {
          if (active) {
            setStep('error');
            setErrorMsg(
              perm.message ||
                'Location permission is needed. Please enable it in Settings to auto-detect your address.'
            );
          }
          return;
        }

        // Get GPS position
        const loc = await getCurrentLocation();
        if (!loc.success) {
          if (active) {
            setStep('error');
            setErrorMsg('Could not fetch your location. Make sure GPS is enabled.');
          }
          return;
        }

        const coords = { latitude: loc.latitude, longitude: loc.longitude };

        // Resolve to human-readable name + pincode
        const { name, pincode } = await resolveLocation(loc.latitude, loc.longitude);

        if (!active) return;

        setCurrentLocation(coords);
        setSelectedLocation(coords);
        setDisplayName(name);
        setDetectedPincode(pincode);
        setStep('map');

        // Animate map to location
        setTimeout(() => {
          mapRef.current?.animateToRegion(
            {
              latitude: coords.latitude,
              longitude: coords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            500
          );
        }, 300);
      } catch (err) {
        if (active) {
          setStep('error');
          setErrorMsg(err?.message || 'Something went wrong.');
        }
      }
    };

    detect();
    return () => {
      active = false;
    };
  }, [visible]);

  // ── Step 2: Handle marker drag ────────────────────────────
  const handleMarkerDragEnd = useCallback(async (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
    setIsResolving(true);

    const { name, pincode } = await resolveLocation(latitude, longitude);
    setDisplayName(name);
    setDetectedPincode(pincode);

    setIsResolving(false);
  }, [resolveLocation]);

  // ── Re-center to current location ──────────────────────────
  const handleReCenter = useCallback(async () => {
    if (!currentLocation) {
      // Try re-detecting
      try {
        const loc = await getCurrentLocation();
        if (loc.success) {
          const coords = { latitude: loc.latitude, longitude: loc.longitude };
          setCurrentLocation(coords);
          setSelectedLocation(coords);
          const { name, pincode } = await resolveLocation(loc.latitude, loc.longitude);
          setDisplayName(name);
          setDetectedPincode(pincode);
          mapRef.current?.animateToRegion(
            {
              latitude: coords.latitude,
              longitude: coords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            500
          );
        }
      } catch {}
      return;
    }

    mapRef.current?.animateToRegion(
      {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      500
    );
  }, [currentLocation]);

  // ── Confirm selected location ──────────────────────────────
  const handleConfirm = useCallback(() => {
    if (!selectedLocation) return;

    // Parse display name into city/area parts
    const parts = displayName.split(', ');
    const city = parts.length >= 2 ? parts[1] : parts[0] || '';
    const area = parts[0] || '';

    onConfirm({
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      displayName,
      city,
      area,
      pincode: detectedPincode,
    });
  }, [selectedLocation, displayName, detectedPincode, onConfirm]);

  // ── Reset on close ─────────────────────────────────────────
  const handleClose = useCallback(() => {
    setStep('detecting');
    setCurrentLocation(null);
    setSelectedLocation(null);
    setDisplayName('Detecting location...');
    setDetectedPincode('');
    setErrorMsg('');
    setIsResolving(false);
    onClose();
  }, [onClose]);

  // ══════════════════════════════════════════════════════════════
  // Render: Detecting state
  // ══════════════════════════════════════════════════════════════
  const renderDetecting = () => (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.detectingTitle}>Finding your location</Text>
      <Text style={styles.detectingSub}>Please wait while we detect your address...</Text>
    </View>
  );

  // ══════════════════════════════════════════════════════════════
  // Render: Error state
  // ══════════════════════════════════════════════════════════════
  const renderError = () => (
    <View style={styles.centerState}>
      <View style={styles.errorIcon}>
        <Ionicons name="location-outline" size={40} color={COLORS.dangerText} />
      </View>
      <Text style={styles.errorTitle}>Location unavailable</Text>
      <Text style={styles.errorText}>{errorMsg}</Text>
      <Pressable
        onPress={() => {
          setStep('detecting');
          // Re-trigger detection by toggling visibility
          handleClose();
        }}
        style={styles.retryBtn}
      >
        <Ionicons name="refresh" size={18} color="#fff" />
        <Text style={styles.retryText}>Try Again</Text>
      </Pressable>
      <Pressable onPress={handleClose} style={styles.manualBtn}>
        <Text style={styles.manualText}>Enter Address Manually</Text>
      </Pressable>
    </View>
  );

  // ══════════════════════════════════════════════════════════════
  // Render: Map with draggable pin
  // ══════════════════════════════════════════════════════════════
  const renderMap = () => {
    const region = selectedLocation || currentLocation || { latitude: 19.076, longitude: 72.8777 };

    return (
      <View style={styles.mapContainer}>
        {/* Map */}
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: region.latitude,
            longitude: region.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation
          showsMyLocationButton={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {selectedLocation && (
            <Marker
              coordinate={selectedLocation}
              draggable
              onDragEnd={handleMarkerDragEnd}
              title="Your Location"
              description="Drag to adjust"
              pinColor={COLORS.primary}
            />
          )}
        </MapView>

        {/* Top bar with close + title */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={handleClose} style={styles.topBarBtn}>
            <Ionicons name="close" size={22} color={COLORS.text} />
          </Pressable>
          <Text style={styles.topBarTitle}>Select Location</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Bottom address card */}
        <View style={[styles.bottomCard, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          {/* Address preview */}
          <View style={styles.addressPreview}>
            <View style={styles.addressIconWrap}>
              <Image
                source={require('../../../assets/mapsicon.png')}
                style={{ width: 22, height: 22 }}
                resizeMode="contain"
              />
            </View>
            <View style={styles.addressTextWrap}>
              {isResolving ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Text style={styles.addressLabel}>Delivery Location</Text>
                  <Text style={styles.addressText} numberOfLines={2}>
                    {displayName}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Pressable onPress={handleReCenter} style={styles.reCenterBtn}>
              <Ionicons name="locate" size={18} color={COLORS.primary} />
              <Text style={styles.reCenterText}>Re-center</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={isResolving || !selectedLocation}
              style={[styles.confirmBtn, (isResolving || !selectedLocation) && styles.confirmBtnDisabled]}
            >
              <Text style={styles.confirmText}>
                {isResolving ? 'Resolving...' : 'Confirm Location'}
              </Text>
            </Pressable>
          </View>

          {/* Drag hint */}
          <Text style={styles.dragHint}>Drag the pin to adjust your location</Text>
        </View>
      </View>
    );
  };

  // ══════════════════════════════════════════════════════════════
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modal}>
        {step === 'detecting' && renderDetecting()}
        {step === 'error' && renderError()}
        {step === 'map' && renderMap()}
      </View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Center states (detecting / error) ──
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  detectingTitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  detectingSub: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.mutedText,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.mutedText,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  manualBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  manualText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // ── Map container ──
  mapContainer: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // ── Top bar ──
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#fde6cf',
  },
  topBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },

  // ── Bottom address card ──
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    ...getShadowStyle(COLORS.shadow),
  },
  addressPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  addressIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressTextWrap: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  addressText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  reCenterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  reCenterText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  dragHint: {
    marginTop: 10,
    fontSize: 11,
    color: COLORS.mutedText,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default AutoLocationPicker;
