// GUI category: Screen. Manage saved addresses — Home, Office, Other.
// Uses same AddressFormSheet as Checkout for consistent UX.
import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Container from '../components/common/Container';
import AddressFormSheet from '../components/checkout/AddressFormSheet';
import { COLORS } from '../utils/constants';
import { getShadowStyle } from '../utils/helpers';
import { useAddressStore } from '../store/addressStore';


const AddressBookScreen = ({ onBack }) => {
  const addresses = useAddressStore((state) => state.addresses);
  const deleteAddress = useAddressStore((state) => state.deleteAddress);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  const handleAddressSelected = () => {
    setSheetVisible(false);
    setEditingAddress(null);
  };

  const handleAdd = () => {
    setEditingAddress(null);
    setSheetVisible(true);
  };

  const handleEdit = (addr) => {
    setEditingAddress(addr);
    setSheetVisible(true);
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Address', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAddress(id) },
    ]);
  };

  const labelIcons = { Home: 'home-outline', Office: 'briefcase-outline', Other: 'location-outline' };

  return (
    <Container>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Address Book</Text>
        <Pressable onPress={handleAdd} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={COLORS.primary} />
        </Pressable>
      </View>

      {addresses.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="location-outline" size={48} color={COLORS.border} />
          <Text style={styles.emptyTitle}>No saved addresses</Text>
          <Text style={styles.emptySub}>Tap + to add your Home, Office or other address.</Text>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.addressCard}>
              <View style={styles.addressHeader}>
                <View style={styles.labelBadge}>
                  <Ionicons name={labelIcons[item.label] || 'location-outline'} size={14} color={COLORS.primary} />
                  <Text style={styles.labelText}>{item.label}</Text>
                </View>
                <View style={styles.addressActions}>
                  <Pressable onPress={() => handleEdit(item)} style={styles.actionBtn}>
                    <Ionicons name="create-outline" size={18} color={COLORS.mutedText} />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.dangerText} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.addrName}>{item.fullName}</Text>
              <Text style={styles.addrLine}>{item.line1}, {item.city} - {item.pincode}</Text>
              {item.landmark ? <Text style={styles.addrLandmark}>{item.landmark}</Text> : null}
              {item.phone ? <Text style={styles.addrPhone}>{item.phone}</Text> : null}
            </View>
          )}
        />
      )}

      <AddressFormSheet
        visible={sheetVisible}
        onClose={handleAddressSelected}
        onAddressSelected={handleAddressSelected}
        editingAddress={editingAddress}
      />
    </Container>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  list: { paddingHorizontal: 20, paddingBottom: 30 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: '800', color: COLORS.text },
  emptySub: { marginTop: 6, fontSize: 14, color: COLORS.mutedText, textAlign: 'center' },
  addressCard: {
    backgroundColor: COLORS.card, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: '#fde6cf', marginBottom: 12,
    ...getShadowStyle(COLORS.shadow),
  },
  addressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  labelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff7ed', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  labelText: { fontSize: 12, fontWeight: '700', color: COLORS.primaryDark },
  addressActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addrName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  addrLine: { marginTop: 4, fontSize: 13, color: COLORS.mutedText, lineHeight: 19 },
  addrLandmark: { marginTop: 3, fontSize: 12, color: COLORS.primaryDark, fontWeight: '600' },
  addrPhone: { marginTop: 4, fontSize: 13, color: COLORS.text, fontWeight: '600' },
});

export default AddressBookScreen;
