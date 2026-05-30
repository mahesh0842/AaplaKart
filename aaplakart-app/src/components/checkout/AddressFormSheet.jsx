// GUI category: Checkout UI. Bottom sheet with address form — saved address picker + add/edit form.
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '../common/BottomSheet';
import LocationMap from '../common/LocationMap';
import AutoLocationPicker from '../location/AutoLocationPicker';
import { COLORS } from '../../utils/constants';
import { MOCK_AUTH_STORAGE_KEY } from '../../utils/constants';
import { useAddressStore } from '../../store/addressStore';
import { useUserNameStore } from '../../store/userNameStore';
import { geocodeAddress } from '../../services/locationService';
import { updateMyProfile } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LABEL_OPTIONS = ['Home', 'Office', 'Other'];

// ── Helper: Save user's real name ONLY first time (when still default) ──
// Once user has a real name, address saves will NOT overwrite it.
// User must manually update name from Profile to change it.
async function _saveUserNameToProfile(fullName) {
  const name = (fullName || '').trim();
  if (!name || name === 'AaplaKart User' || name.length < 2) return;

  // ── Only update if current name is still the default ──
  const currentStoreName = useUserNameStore.getState().displayName;
  if (currentStoreName && currentStoreName !== 'AaplaKart User') {
    return; // User already has a real name — don't overwrite
  }

  // Also check persisted session (covers case where store not yet synced)
  try {
    const raw = await AsyncStorage.getItem(MOCK_AUTH_STORAGE_KEY);
    if (raw) {
      const session = JSON.parse(raw);
      const sessionName = session?.displayName?.trim();
      if (sessionName && sessionName !== 'AaplaKart User') {
        // Sync store just in case, then abort
        useUserNameStore.getState().setDisplayName(sessionName);
        return;
      }
    }
  } catch {}

  try {
    // 1. Update backend (non-blocking)
    updateMyProfile({ display_name: name }).catch(() => {});
  } catch {}

  try {
    // 2. Update persisted session so name survives logout/login
    const raw = await AsyncStorage.getItem(MOCK_AUTH_STORAGE_KEY);
    if (raw) {
      const session = JSON.parse(raw);
      if (session) {
        session.displayName = name;
        await AsyncStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(session));
      }
    }
  } catch {}

  // 3. Update global Zustand store → Profile tab reflects IMMEDIATELY
  useUserNameStore.getState().setDisplayName(name);
}

const AddressFormSheet = ({ visible, onClose, onAddressSelected, phoneNumber = '', editingAddress = null }) => {
  const addresses = useAddressStore((state) => state.addresses);
  const addAddress = useAddressStore((state) => state.addAddress);
  const updateAddress = useAddressStore((state) => state.updateAddress);
  const [mode, setMode] = useState(editingAddress ? 'form' : 'select');

  // ── Form state ──
  const [label, setLabel] = useState(editingAddress?.label || 'Home');
  const [fullName, setFullName] = useState(editingAddress?.fullName || '');
  const [phone, setPhone] = useState(editingAddress?.phone || phoneNumber);
  const [line1, setLine1] = useState(editingAddress?.line1 || '');
  const [landmark, setLandmark] = useState(editingAddress?.landmark || '');
  const [city, setCity] = useState(editingAddress?.city || '');
  const [pincode, setPincode] = useState(editingAddress?.pincode || '');
  const [latitude, setLatitude] = useState(editingAddress?.latitude ?? null);
  const [longitude, setLongitude] = useState(editingAddress?.longitude ?? null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [showAutoPicker, setShowAutoPicker] = useState(false);

  const isEditing = Boolean(editingAddress);
  const initialKey = editingAddress
    ? `${editingAddress.line1}|${editingAddress.city}|${editingAddress.pincode}`
    : null;

  // ── Reset form ──
  const resetForm = () => {
    setLabel('Home');
    setFullName('');
    setPhone(phoneNumber);
    setLine1('');
    setLandmark('');
    setCity('');
    setPincode('');
    setLatitude(null);
    setLongitude(null);
    setIsGeocoding(false);
    setGeoError(null);
  };

  const handleOpenForm = () => {
    resetForm();
    setMode('form');
  };

  const handleClose = () => {
    setMode('select');
    onClose();
  };

  // ── Select a saved address ──
  const handleSelectAddress = (addr) => {
    onAddressSelected(addr);
    handleClose();
  };

  // ── Auto-location picker callback ──
  const handleAutoLocation = useCallback((data) => {
    setShowAutoPicker(false);
    setLine1(data.area || data.displayName);
    setCity(data.city);
    setPincode(data.pincode); // Auto-fill pincode from detected pin — no need to ask again
    setLatitude(data.latitude);
    setLongitude(data.longitude);
  }, []);

  // ── Save / Update address ──
  const handleSave = async () => {
    if (!fullName.trim() || !line1.trim() || !city.trim() || pincode.length !== 6) {
      Alert.alert('Incomplete', 'Fill all required fields with a valid 6-digit pincode.');
      return;
    }

    const addressText = `${line1}, ${city}`.trim();
    let lat = latitude;
    let lng = longitude;

    // On edit: preserve existing coordinates if address text hasn't changed
    if (isEditing && latitude != null && initialKey === `${line1}|${city}|${pincode}`) {
      lat = editingAddress.latitude;
      lng = editingAddress.longitude;
    } else if (addressText.length >= 10) {
      setIsGeocoding(true);
      setGeoError(null);
      const result = await geocodeAddress(addressText);
      if (result.success) {
        lat = result.latitude;
        lng = result.longitude;
        setLatitude(lat);
        setLongitude(lng);
        setGeoError(null);
      } else {
        setGeoError(result.error);
        // Geocode fail — warn user before saving without coordinates
        const proceed = await new Promise((resolve) => {
          Alert.alert(
            'Location Not Found',
            'We could not pinpoint your address on the map. Delivery partner may not find your exact location. Use "Auto-detect Location" for accurate delivery.\n\nSave address anyway?',
            [
              { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Save Anyway', onPress: () => resolve(true) },
            ]
          );
        });
        if (!proceed) { setIsGeocoding(false); return; }
        lat = null;
        lng = null;
      }
      setIsGeocoding(false);
    }

    const addressData = {
      label, fullName, phone, line1, landmark, city, pincode,
      latitude: lat ?? null,
      longitude: lng ?? null,
    };

    if (isEditing) {
      updateAddress(editingAddress.id, addressData);
      onAddressSelected({ ...editingAddress, ...addressData });
    } else {
      addAddress(addressData);
      // Grab the newly added address (last in array)
      const allAddresses = useAddressStore.getState().addresses;
      onAddressSelected(allAddresses[allAddresses.length - 1]);
    }

    // ── Save user's real name immediately (from address fullName) ──
    _saveUserNameToProfile(fullName);

    setMode('select');
    onClose();
  };

  // ── Mode: Select from saved addresses ──
  const labelIcons = { Home: 'home-outline', Office: 'briefcase-outline', Other: 'location-outline' };
  const showSelectMode = mode === 'select' && addresses.length > 0;

  return (
    <>
      <BottomSheet visible={visible} onClose={handleClose}>
        {showSelectMode ? (
          <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>Select Address</Text>
            <FlatList
              data={addresses}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelectAddress(item)}
                  style={({ pressed }) => [styles.addressOption, pressed && styles.addressOptionPressed]}
                >
                  <View style={styles.optionHeader}>
                    <View style={styles.optionBadge}>
                      <Ionicons name={labelIcons[item.label] || 'location-outline'} size={14} color={COLORS.primary} />
                      <Text style={styles.optionBadgeText}>{item.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.optionName}>{item.fullName}</Text>
                  <Text style={styles.optionLine}>{item.line1}, {item.city} - {item.pincode}</Text>
                  {item.landmark ? <Text style={styles.optionLandmark}>{item.landmark}</Text> : null}
                  {item.phone ? <Text style={styles.optionPhone}>{item.phone}</Text> : null}
                </Pressable>
              )}
              ListFooterComponent={() => (
                <Pressable onPress={handleOpenForm} style={styles.addNewBtn}>
                  <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.addNewText}>Add New Address</Text>
                </Pressable>
              )}
            />
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.sheetContent}
              contentContainerStyle={styles.formScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.sheetTitle}>
                {isEditing ? 'Edit Address' : addresses.length === 0 ? 'New Address' : 'Add New Address'}
              </Text>

              <View style={styles.labelRow}>
                {LABEL_OPTIONS.map((l) => (
                  <Pressable key={l} onPress={() => setLabel(l)} style={[styles.labelChip, label === l && styles.labelChipActive]}>
                    <Text style={[styles.labelChipText, label === l && styles.labelChipTextActive]}>{l}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable onPress={() => setShowAutoPicker(true)} style={({ pressed }) => [styles.autoDetectBtn, pressed && styles.autoDetectBtnPressed]}>
                <View style={styles.autoDetectIcon}>
                  <Image source={require('../../../assets/mapsicon.png')} style={{ width: 22, height: 22 }} resizeMode="contain" />
                </View>
                <View style={styles.autoDetectTextWrap}>
                  <Text style={styles.autoDetectLabel}>Auto-detect Location</Text>
                  <Text style={styles.autoDetectSub}>Use GPS to find your address instantly</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.mutedText} />
              </Pressable>

              <TextInput style={styles.input} placeholder="Full Name *" value={fullName} onChangeText={setFullName} />
              <TextInput style={styles.input} placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} />
              <TextInput style={styles.input} placeholder="Address *" value={line1} onChangeText={setLine1} />
              <TextInput style={styles.input} placeholder="Landmark (e.g. near school, mall)" value={landmark} onChangeText={setLandmark} />
              <View style={styles.row}>
                <TextInput style={[styles.input, styles.half]} placeholder="City *" value={city} onChangeText={setCity} />
                <TextInput style={[styles.input, styles.half]} placeholder="Pincode *" value={pincode} onChangeText={setPincode} keyboardType="number-pad" maxLength={6} />
              </View>

              {isGeocoding && (
                <View style={styles.geoIndicator}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.geoIndicatorText}>  Locating…</Text>
                </View>
              )}
              {geoError && !isGeocoding && <Text style={styles.geoErrorText}>  {geoError}</Text>}

              {latitude != null && longitude != null && (
                <LocationMap latitude={latitude} longitude={longitude} address={`${line1}, ${landmark ? landmark + ', ' : ''}${city}, ${pincode}`} />
              )}

              {/* Extra bottom space so last field isn't hidden behind footer */}
              <View style={{ height: 16 }} />
            </ScrollView>

            {/* Sticky footer — always visible, no scroll needed */}
            <View style={styles.formFooter}>
              <Pressable onPress={handleClose} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSave} style={styles.saveBtn}>
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
            </View>
          </>
        )}
      </BottomSheet>

      {/* Auto-location picker — OUTSIDE BottomSheet (full-screen Modal, no overflow) */}
      <AutoLocationPicker
        visible={showAutoPicker}
        onClose={() => setShowAutoPicker(false)}
        onConfirm={handleAutoLocation}
      />
    </>
  );
};

const styles = StyleSheet.create({
  sheetContent: {
    flex: 1,
  },
  formScrollContent: {
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 14,
  },
  // ── Select mode ──
  listContent: {
    paddingBottom: 20,
  },
  addressOption: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addressOptionPressed: {
    opacity: 0.75,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  optionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  optionName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  optionLine: {
    marginTop: 3,
    fontSize: 13,
    color: COLORS.mutedText,
    lineHeight: 18,
  },
  optionLandmark: {
    marginTop: 3,
    fontSize: 12,
    color: COLORS.primaryDark,
    fontWeight: '600',
  },
  optionPhone: {
    marginTop: 3,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },
  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  addNewText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  // ── Form mode ──
  labelRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  labelChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: COLORS.mutedBg,
  },
  labelChipActive: {
    backgroundColor: COLORS.primary,
  },
  labelChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.mutedText,
  },
  labelChipTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fde6cf',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  half: {
    flex: 1,
  },
  // ── Auto-detect button ──
  autoDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  autoDetectBtnPressed: {
    opacity: 0.8,
  },
  autoDetectIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoDetectTextWrap: {
    flex: 1,
  },
  autoDetectLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  autoDetectSub: {
    fontSize: 11,
    color: COLORS.mutedText,
    marginTop: 2,
  },
  geoIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  geoIndicatorText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  geoErrorText: {
    fontSize: 12,
    color: COLORS.dangerText,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  formFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: COLORS.mutedBg,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.mutedText,
  },
  saveBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
  },
  saveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});

export default AddressFormSheet;
