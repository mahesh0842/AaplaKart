// ── Delivery Map — Google Maps In-App Map + Route ──
// Features: Google Maps tiles, shop↔customer route polyline,
// distance, ETA, markers. No external app needed.
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS, getDistanceInKm, GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_TILE_URL,
  GOOGLE_DIRECTIONS_URL, hasGoogleMaps, decodePolyline,
} from '../utils/constants';
import { useDeliveryStore } from '../store/deliveryStore';

// ── Safe native module imports ──────────────────────────────────
let MapView = null, Marker = null, Polyline = null, UrlTile = null;
try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Polyline = maps.Polyline;
  UrlTile = maps.UrlTile;
} catch {}

// ── Fetch route from Google Maps Directions API ────────────────
async function fetchRoute(originLat, originLon, destLat, destLon) {
  if (!hasGoogleMaps()) return null;
  try {
    const url = `${GOOGLE_DIRECTIONS_URL}?origin=${originLat},${originLon}&destination=${destLat},${destLon}&key=${GOOGLE_MAPS_API_KEY}&mode=driving`;
    const resp = await fetch(url);
    const json = await resp.json();
    if (json.status === 'OK' && json.routes?.length) {
      const route = json.routes[0];
      const encoded = route.overview_polyline?.points;
      if (!encoded) return null;
      const coords = decodePolyline(encoded);
      return { coords, distance: route.legs?.[0]?.distance?.value / 1000, duration: Math.round(route.legs?.[0]?.duration?.value / 60) };
    }
  } catch {}
  return null;
}

const DeliveryMap = ({ latitude, longitude, address, customerName, customerPhone, status, distanceFromShop }) => {
  const getShopLoc = useDeliveryStore((s) => s.getShopLocation);
  const shop = getShopLoc();
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // ── Fetch Google Maps route on mount ─────────────────────────
  useEffect(() => {
    if (!hasGoogleMaps() || !latitude || !longitude) return;
    setRouteLoading(true);
    fetchRoute(shop.latitude, shop.longitude, latitude, longitude)
      .then(setRouteData)
      .finally(() => setRouteLoading(false));
  }, [latitude, longitude, shop.latitude, shop.longitude]);

  const dist = routeData?.distance || distanceFromShop || (latitude && longitude
    ? getDistanceInKm(shop.latitude, shop.longitude, latitude, longitude) : null);
  const eta = routeData?.duration || null;
  const hasMap = MapView && latitude != null && longitude != null;
  const gmReady = hasGoogleMaps();


  const midLat = (shop.latitude + latitude) / 2;
  const midLon = (shop.longitude + longitude) / 2;
  const delta = 0.04;

  return (
    <View style={s.container}>
      {/* ══════════ MAP — FULLY IN-APP ══════════ */}
      {hasMap ? (
        <View>
          <MapView
            style={s.map}
            initialRegion={{ latitude: midLat, longitude: midLon, latitudeDelta: delta, longitudeDelta: delta }}
            scrollEnabled={true} zoomEnabled={true} rotateEnabled={false}
          >
            {gmReady && <UrlTile urlTemplate={GOOGLE_MAPS_TILE_URL(GOOGLE_MAPS_API_KEY)} maximumZ={19} flipY={false} />}
            <Marker coordinate={{ latitude: shop.latitude, longitude: shop.longitude }} title={shop.name} pinColor="#16a34a" />
            <Marker coordinate={{ latitude, longitude }} title="Delivery" description={address} pinColor={COLORS.primary} />
            {routeData?.coords?.length > 0 && (
              <Polyline coordinates={routeData.coords} strokeColor="#2563eb" strokeWidth={4} />
            )}
            {!routeData?.coords && (
              <Polyline coordinates={[{ latitude: shop.latitude, longitude: shop.longitude }, { latitude, longitude }]} strokeColor={COLORS.primary} strokeWidth={2} lineDashPattern={[6, 4]} />
            )}
          </MapView>

          {/* Distance + ETA */}
          <View style={s.infoBar}>
            <View style={s.distBadge}>
              <Ionicons name="location" size={14} color={COLORS.primary} />
              <Text style={s.distText}>{dist?.toFixed(1) || '0.0'} km</Text>
            </View>
            {eta != null && (
              <View style={s.etaBadge}>
                <Ionicons name="time-outline" size={13} color="#2563eb" />
                <Text style={s.etaText}>{eta} min</Text>
              </View>
            )}
            <Text style={s.pinchHint}>🔄 Pinch</Text>
          </View>
        </View>
      ) : (
        /* ══════════ Address Card — NO external button ══════════ */
        <View style={s.noMapCard}>
          <Ionicons name="location-outline" size={32} color={COLORS.mutedText} />
          <Text style={s.noMapTitle}>Address Details</Text>
          <View style={s.addrBox}>
            <Text style={s.addrText}>{address || 'No address provided'}</Text>
          </View>
        </View>
      )}

      {/* ══════════ Customer Info ══════════ */}
      <View style={s.custBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.custName}>{customerName || 'Customer'}</Text>
          {customerPhone ? <Text style={s.custPhone}>📞 {customerPhone}</Text> : null}
          {dist != null && <Text style={s.custDist}>🚚 {dist.toFixed(1)} km • {eta ? `${eta} min` : '—'}</Text>}
        </View>
        {customerPhone ? (
          <Pressable onPress={() => Linking.openURL(`tel:${customerPhone}`)} style={s.callBtn}>
            <Ionicons name="call" size={20} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      {gmReady && (
        <View style={s.branding}>
          <Text style={s.brandText}>Google Maps</Text>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { borderRadius: 16, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  map: { width: '100%', height: 220 },
  infoBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff7ed', paddingHorizontal: 12, paddingVertical: 8 },
  distBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  distText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  etaBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  etaText: { fontSize: 11, fontWeight: '700', color: '#2563eb' },
  pinchHint: { fontSize: 10, color: '#94a3b8', marginLeft: 'auto', fontStyle: 'italic' },
  noMapCard: { padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#fde6cf' },
  noMapTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text, marginTop: 8, marginBottom: 8 },
  addrBox: { backgroundColor: '#fff7ed', borderRadius: 10, padding: 12, width: '100%' },
  addrText: { fontSize: 13, color: COLORS.text, fontWeight: '600', lineHeight: 18 },
  custBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  custName: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  custPhone: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginTop: 3 },
  custDist: { fontSize: 11, color: COLORS.mutedText, fontWeight: '600', marginTop: 3 },
  callBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  branding: { backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 3, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  brandText: { fontSize: 9, color: '#94a3b8', textAlign: 'right' },
});

export default DeliveryMap;
