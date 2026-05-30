// Screen: Profile — user info, menu, logout. Reuses MenuItem component.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Container from '../components/common/Container';
import MenuItem from '../components/common/MenuItem';
import { COLORS } from '../utils/constants';
import { getShadowStyle, maskPhoneNumber } from '../utils/helpers';
import AddressBookScreen from './AddressBookScreen';
import InfoScreen from './InfoScreen';
import OrdersScreen from './OrdersScreen';

const ProfileScreen = ({
  phoneNumber,
  provider,
  onLogout,
  onShowLogin,
  userName = '',
  isAuthenticated = false,
}) => {
  const [subScreen, setSubScreen] = useState(null);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const resolvedUserName = userName.trim() || 'AaplaKart User';
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  // Auto-show login EVERY time Profile tab gains focus (not memoized)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setSubScreen(null);
      if (!isAuthenticatedRef.current) {
        onShowLogin?.();
      }
    });
    return unsubscribe;
  }, [navigation, onShowLogin]);

  // Reset sub-screen on tab press
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      setSubScreen(null);
    });

    return unsubscribe;
  }, [navigation]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Check out AaplaKart — fresh groceries delivered fast! Download now.',
        title: 'AaplaKart',
      });
    } catch (error) {
      // ignore
    }
  };

  if (subScreen === 'orders') return <OrdersScreen onBack={() => setSubScreen(null)} />;
  if (subScreen === 'address') return <AddressBookScreen onBack={() => setSubScreen(null)} />;
  if (subScreen === 'about') return <InfoScreen type="about" onBack={() => setSubScreen(null)} />;
  if (subScreen === 'privacy') return <InfoScreen type="privacy" onBack={() => setSubScreen(null)} />;

  return (
    <Container>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={styles.title}>Profile</Text>

        {isAuthenticated ? (
          /* ── Logged In: Compact User Card ────────────────── */
          <>
            <View style={styles.userCard}>
              <View style={styles.avatar}>
                <Ionicons name="person-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{resolvedUserName}</Text>
                <Text style={styles.userPhone}>{maskPhoneNumber(phoneNumber) || 'N/A'}</Text>
              </View>
              <View style={styles.providerBadge}>
                <Text style={styles.providerText}>
                  {provider === 'mock' ? 'Demo' : 'Auth'}
                </Text>
              </View>
            </View>

            {/* Menu Options */}
            <View style={styles.menuCard}>
              <MenuItem
                icon="receipt-outline"
                label="Orders"
                subtitle="View your order history & status"
                onPress={() => setSubScreen('orders')}
                color={COLORS.primary}
              />
              <View style={styles.menuDivider} />
              <MenuItem
                icon="book-outline"
                label="Address Book"
                subtitle="Save Home, Office & other addresses"
                onPress={() => setSubScreen('address')}
              />
              <View style={styles.menuDivider} />
              <MenuItem
                icon="share-outline"
                label="Share App"
                subtitle="Tell friends about AaplaKart"
                onPress={handleShare}
                color="#2563eb"
              />
              <View style={styles.menuDivider} />
              <MenuItem
                icon="information-circle-outline"
                label="About Us"
                subtitle="Learn more about AaplaKart"
                onPress={() => setSubScreen('about')}
                color={COLORS.accent}
              />
              <View style={styles.menuDivider} />
              <MenuItem
                icon="shield-checkmark-outline"
                label="Privacy Policy"
                subtitle="How we handle your data"
                onPress={() => setSubScreen('privacy')}
                color="#7c3aed"
              />
              <View style={styles.menuDivider} />
              <MenuItem
                icon="log-out-outline"
                label="Logout"
                subtitle="Sign out from this account"
                onPress={onLogout}
                color={COLORS.dangerText}
              />
            </View>
          </>
        ) : null}

        <Text style={styles.footer}>AaplaKart v1.0.0</Text>
      </ScrollView>
    </Container>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, marginBottom: 18 },
  userCard: {
    backgroundColor: COLORS.card, borderRadius: 22, padding: 14,
    borderWidth: 1, borderColor: '#fde6cf', flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 16,
    ...getShadowStyle(COLORS.shadow),
  },
  avatar: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff7ed',
    alignItems: 'center', justifyContent: 'center',
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  userPhone: { fontSize: 13, color: COLORS.mutedText },
  providerBadge: { backgroundColor: '#fff7ed', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  providerText: { fontSize: 10, fontWeight: '700', color: COLORS.primaryDark },
  menuCard: {
    backgroundColor: COLORS.card, borderRadius: 24, padding: 6,
    borderWidth: 1, borderColor: '#fde6cf', marginBottom: 20,
    ...getShadowStyle(COLORS.shadow),
  },
  menuDivider: { height: 1, backgroundColor: '#fde6cf', marginHorizontal: 14 },
  footer: { textAlign: 'center', fontSize: 12, color: COLORS.mutedText, marginTop: 4 },
});

export default ProfileScreen;
