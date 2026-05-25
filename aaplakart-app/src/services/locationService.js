// GUI category: App services. Manages location permission requests and current location retrieval.
import { Platform } from 'react-native';
import * as Location from 'expo-location';

export const requestLocationPermission = async () => {
  try {
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

    if (existingStatus === 'granted') {
      return { granted: true, status: 'granted' };
    }

    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      return {
        granted: false,
        status,
        message: 'Location permission is needed to find nearby stores and estimate delivery times.',
      };
    }

    return { granted: true, status };
  } catch (error) {
    return {
      granted: false,
      status: 'error',
      message: error?.message || 'Could not request location permission.',
    };
  }
};

// ── Nominatim (OpenStreetMap) Geocoding — free, no API key ─────────
const _nominatimGeocode = async (address) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'AaplaKart/1.0', 'Accept-Language': 'en' } }
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
    }
  } catch {
    // fall through
  }
  return null;
};

export const geocodeAddress = async (addressString) => {
  try {
    if (!addressString || addressString.trim().length < 5) {
      return { success: false, error: 'Address too short to geocode.' };
    }

    const trimmed = addressString.trim();

    // 1. Try expo-location geocodeAsync (native, works offline on some devices)
    try {
      const results = await Location.geocodeAsync(trimmed);
      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];
        return { success: true, latitude, longitude };
      }
    } catch {
      // fall through to Nominatim
    }

    // 2. Fallback: OpenStreetMap Nominatim (free, works everywhere)
    const osmCoords = await _nominatimGeocode(trimmed);
    if (osmCoords) {
      return { success: true, ...osmCoords };
    }

    return { success: false, error: 'Could not find coordinates for this address.' };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Geocoding failed.',
    };
  }
};

export const getCurrentLocation = async () => {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();

    if (status !== 'granted') {
      return { success: false, error: 'Location permission not granted.' };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      success: true,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Could not fetch current location.',
    };
  }
};

export const getLocationDisplayName = async (latitude, longitude) => {
  try {
    const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });

    if (addresses && addresses.length > 0) {
      const addr = addresses[0];
      const parts = [addr.city, addr.region, addr.country].filter(Boolean);
      return parts.join(', ') || 'Unknown location';
    }

    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch (error) {
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
};

// ── Full location details including pincode ─────────────────────
// Returns: { displayName, street, city, region, pincode, country }
export const getLocationDetails = async (latitude, longitude) => {
  try {
    const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });

    if (!addresses || addresses.length === 0) {
      return {
        displayName: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        street: '',
        city: '',
        region: '',
        pincode: '',
        country: '',
      };
    }

    const addr = addresses[0];
    const parts = [addr.street, addr.district, addr.city, addr.region, addr.country].filter(Boolean);

    return {
      displayName: parts.join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      street: addr.street || addr.name || '',
      city: addr.city || '',
      region: addr.region || '',
      pincode: addr.postalCode || '',
      country: addr.country || '',
    };
  } catch (error) {
    return {
      displayName: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      street: '',
      city: '',
      region: '',
      pincode: '',
      country: '',
    };
  }
};
