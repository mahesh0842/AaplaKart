export const COLORS = {
  primary: '#f97316',
  primaryDark: '#ea580c',
  accent: '#16a34a',
  background: '#F7F1E8',
  card: '#ffffff',
  border: '#fed7aa',
  text: '#1f2937',
  mutedText: '#6b7280',
  successText: '#15803d',
  dangerText: '#b91c1c',
  warningText: '#b45309',
};

export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  PICKED_UP: 'picked_up',
  OUT_FOR_DELIVERY: 'out-for-delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

export const STATUS_LABELS = {
  pending: 'New Order',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  picked_up: 'Picked Up',
  'out-for-delivery': 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const STATUS_COLORS = {
  pending: '#f97316',
  confirmed: '#2563eb',
  preparing: '#16a34a',
  picked_up: '#7c3aed',
  'out-for-delivery': '#7c3aed',
  delivered: '#15803d',
  cancelled: '#b91c1c',
};

export const STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'picked_up', 'out-for-delivery', 'delivered'];

import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const getApiBase = () => {
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl) return `${envUrl}/api`;
  if (Platform.OS === 'web') return 'http://localhost:8000/api';
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri || '';
  const devIp = hostUri ? hostUri.split(':')[0] : '';
  if (devIp) return `http://${devIp}:8000/api`;
  return 'http://localhost:8000/api';
};

export const API_BASE = getApiBase();

// ── Shop / Delivery Hub Location ──────────────────────────────
export const SHOP_LOCATION = {
  latitude: 19.0760,  // Navi Mumbai / Vashi area
  longitude: 72.8777,
  name: 'AaplaKart Hub',
  address: 'Sector 15, CBD Belapur, Navi Mumbai',
};

export const DELIVERY_RADIUS_KM = 9999; // Unlimited radius (demo mode — show all orders)

/**
 * Calculate distance between two coordinates in km using Haversine formula.
 */
export function getDistanceInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if a delivery location is within the shop's delivery radius.
 */
export function isWithinDeliveryRadius(orderLat, orderLon) {
  if (!orderLat || !orderLon) return false;
  const dist = getDistanceInKm(
    SHOP_LOCATION.latitude, SHOP_LOCATION.longitude,
    orderLat, orderLon
  );
  return dist <= DELIVERY_RADIUS_KM;
}

// ── MapMyIndia (In-App Map + Directions) ──────────────────────
export const MAPMYINDIA_KEY = process.env.EXPO_PUBLIC_MAPMYINDIA_KEY || '14618ac29b15178af1abc49f975bb25e';

// Map tile URL template (for react-native-maps <UrlTile>)
export const MAPMYINDIA_TILE_URL = (key) =>
  `https://apis.mapmyindia.com/advancedmaps/v1/${key || MAPMYINDIA_KEY}/map_tiles?x={x}&y={y}&z={z}`;

// Directions API — returns polyline route between two points
export const MAPMYINDIA_DIRECTIONS_URL =
  'https://apis.mapmyindia.com/advancedmaps/v1';

// Check if MapMyIndia is configured
export const hasMapMyIndia = () => MAPMYINDIA_KEY.length > 20;
