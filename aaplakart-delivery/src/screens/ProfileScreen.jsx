import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../utils/constants';
import { useDeliveryStore } from '../store/deliveryStore';
import { useAuthStore } from '../store/authStore';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const orders = useDeliveryStore((s) => s.orders);
  const acceptedIds = useDeliveryStore((s) => s.acceptedIds);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const stats = useMemo(() => {
    const delivered = orders.filter(o => o.status === 'delivered');
    const today = delivered.filter(o => {
      const d = new Date(o.placed_at || o.placedAt || 0);
      return d.toDateString() === new Date().toDateString();
    });
    return {
      totalDelivered: delivered.length,
      todayDelivered: today.length,
      totalEarnings: delivered.reduce((s, o) => s + Number(o.total || 0), 0),
      todayEarnings: today.reduce((s, o) => s + Number(o.total || 0), 0),
      activeCount: orders.filter(o => acceptedIds.has(o.id) && o.status !== 'delivered' && o.status !== 'cancelled').length,
    };
  }, [orders, acceptedIds]);

  const menuItems = [
    { icon: 'person-circle', label: 'Name', value: user?.displayName || 'Delivery Partner' },
    { icon: 'call', label: 'Phone', value: user?.phoneNumber || 'Not set' },
    { icon: 'star', label: 'Rating', value: '4.8 ⭐' },
    { icon: 'bicycle', label: 'Total Deliveries', value: `${stats.totalDelivered}` },
    { icon: 'cash', label: "Today's Earnings", value: `₹${stats.todayEarnings}` },
    { icon: 'calendar', label: 'Total Earnings', value: `₹${stats.totalEarnings}` },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar Card */}
        <View style={styles.avatarCard}>
          <Image source={require('../../assets/icon.png')} style={styles.avatar} />
          <Text style={styles.name}>{user?.displayName || 'Delivery Partner'}</Text>
          <Text style={styles.phone}>{user?.phoneNumber || 'Not set'}</Text>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={14} color="#f59e0b" />
            <Text style={styles.ratingText}>4.8</Text>
          </View>
        </View>

        {/* Today's Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={22} color={COLORS.accent} />
            <Text style={styles.statValue}>{stats.todayDelivered}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="bicycle" size={22} color={COLORS.primary} />
            <Text style={styles.statValue}>{stats.activeCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cash" size={22} color="#2563eb" />
            <Text style={styles.statValue}>₹{stats.todayEarnings}</Text>
            <Text style={styles.statLabel}>Earnings</Text>
          </View>
        </View>

        {/* Info List */}
        <View style={styles.infoCard}>
          {menuItems.map((item, idx) => (
            <View key={item.label} style={[styles.infoRow, idx < menuItems.length - 1 && styles.infoBorder]}>
              <Ionicons name={item.icon} size={18} color={COLORS.primary} />
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.text },
  content: { paddingHorizontal: 20, paddingBottom: 30 },

  avatarCard: { alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 20, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: '#fde6cf' },
  avatar: { width: 72, height: 72, borderRadius: 36, marginBottom: 12 },
  name: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  phone: { fontSize: 14, color: COLORS.mutedText, marginTop: 2 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fffbeb', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  ratingText: { fontSize: 14, fontWeight: '800', color: '#f59e0b' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#fde6cf' },
  statValue: { fontSize: 20, fontWeight: '900', color: COLORS.text, marginTop: 4 },
  statLabel: { fontSize: 11, color: COLORS.mutedText, fontWeight: '600', marginTop: 2 },

  infoCard: { backgroundColor: COLORS.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#fde6cf', marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: '#fde6cf' },
  infoLabel: { fontSize: 14, color: COLORS.text, fontWeight: '600', flex: 1, marginLeft: 10 },
  infoValue: { fontSize: 14, color: COLORS.mutedText, fontWeight: '500' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.dangerText, borderRadius: 14, paddingVertical: 14 },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
