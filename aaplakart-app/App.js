// GUI category: App shell. Boots Firebase, auth persistence, navigation, modals, and safe layout affordances.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LogBox, Modal, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DefaultTheme, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { initializeRecaptchaConfig, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { toastConfig } from './src/components/common/ErrorToast';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import BrandCategoryScreen from './src/screens/BrandCategoryScreen';
import CartScreen from './src/screens/CartScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { auth, firebaseReady } from './src/services/firebase';
import { clearImageCache } from './src/services/imageService';
import { BrandProvider } from './src/brand-mode/BrandContext';
import BrandTabToggle from './src/components/common/BrandTabToggle';
import FloatingCartBar from './src/components/cart/FloatingCartBar';
import { COLORS, MOCK_AUTH_STORAGE_KEY } from './src/utils/constants';
import { getCartCount } from './src/utils/helpers';
import { useCartStore } from './src/store/cartStore';
import { testLogin, mockLogin, verifyFirebaseToken, setAuthToken, clearAuthToken, simpleLogin } from './src/services/api';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Disable dev warnings and layout measurement overlay in UI
LogBox.ignoreAllLogs(true);

const Tab = createBottomTabNavigator();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    background: COLORS.background,
    card: '#ffffff',
    text: COLORS.text,
    border: '#fde6cf',
  },
};

const tabIcons = {
  Home: ['home-outline', 'home'],
  Categories: ['grid-outline', 'grid'],
  Waffle: ['restaurant-outline', 'restaurant'],
  Cart: ['cart-outline', 'cart'],
  Profile: ['person-outline', 'person'],
};

// ── Stable tab icon renderer (avoids new component on every parent render) ──
const TabBarIcon = ({ routeName, color, size, focused }) => {
  const [defaultIcon, activeIcon] = tabIcons[routeName] || ['help-outline', 'help'];
  return <Ionicons name={focused ? activeIcon : defaultIcon} size={size} color={color} />;
};

// ── Stable tab label (avoids new function on every render) ──
const NullTabLabel = () => null;

// ── Stable Waffle tab button (prevents BrandTabToggle unmount/remount cycle) ──
const WaffleTabButton = (props) => <BrandTabToggle {...props} />;

const MainTabs = ({
  cartCount,
  isAuthenticated,
  onCheckout,
  onLogout,
  onShowLogin,
  phoneNumber,
  provider,
  tabBarHeight,
  userName,
}) => {
  const tabBarBottomPadding = Math.max(tabBarHeight - 58, 10);

  // Stable screenOptions — returns same shape/refs unless tabBarHeight changes
  const screenOptions = useCallback(
    ({ route }) => ({
      headerShown: false,
      sceneContainerStyle: styles.scene,
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.mutedText,
      tabBarHideOnKeyboard: true,
      tabBarLabelStyle: styles.tabLabel,
      tabBarStyle: [styles.tabBar, { height: tabBarHeight, paddingBottom: tabBarBottomPadding }],
      tabBarIcon: (iconProps) => (
        <TabBarIcon routeName={route.name} {...iconProps} />
      ),
    }),
    [tabBarHeight, tabBarBottomPadding]
  );

  // Stable screen renderers — avoid new function references on every parent render
  const renderHome = useCallback(
    () => <HomeScreen isAuthenticated={isAuthenticated} onShowLogin={onShowLogin} />,
    [isAuthenticated, onShowLogin]
  );
  const renderCategories = useCallback(
    () => <BrandCategoryScreen brand="kart" isAuthenticated={isAuthenticated} onShowLogin={onShowLogin} />,
    [isAuthenticated, onShowLogin]
  );
  const renderWaffle = useCallback(
    () => <BrandCategoryScreen brand="app" isAuthenticated={isAuthenticated} onShowLogin={onShowLogin} />,
    [isAuthenticated, onShowLogin]
  );
  const renderCart = useCallback(
    () => <CartScreen onCheckout={onCheckout} isAuthenticated={isAuthenticated} onShowLogin={onShowLogin} />,
    [onCheckout, isAuthenticated, onShowLogin]
  );
  const renderProfile = useCallback(
    () => (
      <ProfileScreen
        phoneNumber={phoneNumber}
        provider={provider}
        onLogout={onLogout}
        onShowLogin={onShowLogin}
        userName={userName}
        isAuthenticated={isAuthenticated}
      />
    ),
    [phoneNumber, provider, onLogout, onShowLogin, userName, isAuthenticated]
  );

  return (
    <Tab.Navigator backBehavior="history" screenOptions={screenOptions}>
      <Tab.Screen name="Home">{renderHome}</Tab.Screen>
      <Tab.Screen name="Categories">
        {renderCategories}
      </Tab.Screen>
      <Tab.Screen
        name="Waffle"
        options={{
          tabBarLabel: NullTabLabel,
          tabBarButton: WaffleTabButton,
        }}
      >
        {renderWaffle}
      </Tab.Screen>
      <Tab.Screen
        name="Cart"
        options={{
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          tabBarBadgeStyle: styles.tabBadge,
        }}
      >
        {renderCart}
      </Tab.Screen>
      <Tab.Screen name="Profile">
        {renderProfile}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

function AppContent() {
  const insets = useSafeAreaInsets();
  const navigationRef = useNavigationContainerRef();
  const cartCount = useCartStore((state) => getCartCount(state.items));

  const [firebaseUser, setFirebaseUser] = useState(null);
  const [mockSession, setMockSession] = useState(null);
  const [authReady, setAuthReady] = useState(!firebaseReady);
  const [storageReady, setStorageReady] = useState(false);
  const [currentRoute, setCurrentRoute] = useState('Home');
  const [checkoutActive, setCheckoutActive] = useState(false);
  const [loginModalVisible, setLoginModalVisible] = useState(false);

  const tabBarHeight = 64 + Math.max(insets.bottom, 12);
  const floatingCartOffset = tabBarHeight + 18;

  const isAuthenticated = Boolean(firebaseUser || mockSession);
  const phoneNumber = firebaseUser?.phoneNumber || mockSession?.phoneNumber || '';
  const provider = firebaseUser ? 'firebase' : mockSession?.provider || 'mock';
  const resolvedUserName = useMemo(
    () =>
      firebaseUser?.displayName?.trim() ||
      mockSession?.displayName?.trim() ||
      (phoneNumber ? 'AaplaKart User' : ''),
    [firebaseUser?.displayName, mockSession?.displayName, phoneNumber]
  );

  useEffect(() => {
    let mounted = true;
    let unsubscribe = () => {};

    const bootstrap = async () => {
      try {
        clearImageCache();

        const savedMockSession = await AsyncStorage.getItem(MOCK_AUTH_STORAGE_KEY);

        if (mounted && savedMockSession) {
          setMockSession(JSON.parse(savedMockSession));
        }
      } catch (error) {
        console.log('Unable to restore mock session:', error?.message);
      } finally {
        if (mounted) {
          setStorageReady(true);
        }
      }

      if (firebaseReady && auth) {
        initializeRecaptchaConfig(auth).catch(() => {});

        unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (!mounted) {
            return;
          }

          setFirebaseUser(user);
          setAuthReady(true);

          if (user) {
            setMockSession(null);
            await AsyncStorage.removeItem(MOCK_AUTH_STORAGE_KEY);
          }
        });
      }
    };

    bootstrap();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const handleAuthenticated = async (session) => {
    const normalizedSession = {
      ...session,
      displayName: session?.displayName?.trim() || 'AaplaKart User',
    };

    // ── Register with the backend (non-blocking) ──────────────────
    const isMockProvider = session.provider === 'mock' || session.provider === 'mock-google' || session.provider === 'google-fallback';
    const shouldPersist = isMockProvider || session.provider === 'google';

    try {
      if (session.idToken && !isMockProvider) {
        // Real Firebase / Google auth – verify token with backend
        await verifyFirebaseToken(session.idToken, session.phoneNumber);
        console.log('[api] Backend: token verified for', session.phoneNumber);
      } else if (isMockProvider) {
        // Mock/Simple auth — register ANY phone number with backend
        try {
          const result = await simpleLogin(
            session.phoneNumber || '',
            session.displayName || '',
            session.email || ''
          );
          if (result.id_token) {
            setAuthToken(result.id_token);
            normalizedSession.uid = result.uid;
          }
          console.log('[api] Backend: simple-login success for', session.phoneNumber);
        } catch {
          console.log('[api] Backend: simple-login skipped (backend unavailable)');
        }
      }
    } catch (err) {
      console.log('[api] Backend registration skipped:', err?.message);
    }

    // ── Persist session ───────────────────────────────────────────
    if (shouldPersist) {
      setMockSession(normalizedSession);
      await AsyncStorage.setItem(
        MOCK_AUTH_STORAGE_KEY,
        JSON.stringify(normalizedSession)
      );
    } else {
      setMockSession(null);
      await AsyncStorage.removeItem(MOCK_AUTH_STORAGE_KEY);
    }

    setLoginModalVisible(false);
  };

  const handleLogout = async () => {
    if (firebaseReady && auth && firebaseUser) {
      await firebaseSignOut(auth);
    }

    setFirebaseUser(null);
    setMockSession(null);
    setCheckoutActive(false);
    setLoginModalVisible(false);
    clearAuthToken();
    await AsyncStorage.removeItem(MOCK_AUTH_STORAGE_KEY);

    Toast.show({
      type: 'success',
      text1: 'Logged out',
      text2: 'Your session has been cleared from this device.',
    });
  };

  const handleNavigationState = () => {
    const routeName = navigationRef.getCurrentRoute()?.name;

    if (routeName) {
      setCurrentRoute(routeName);
    }
  };

  const showBootLoader = !authReady || !storageReady;
  const toastBottomOffset =
    checkoutActive || loginModalVisible
      ? Math.max(insets.bottom + 24, 40)
      : floatingCartOffset + 54;

  useEffect(() => {
    if (!showBootLoader) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [showBootLoader]);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <StatusBar hidden={showBootLoader} style="dark" />
      <View style={styles.flex}>
        {showBootLoader ? null : (
          <>
            <NavigationContainer
              ref={navigationRef}
              theme={navigationTheme}
              onReady={handleNavigationState}
              onStateChange={handleNavigationState}
            >
              <MainTabs
                cartCount={cartCount}
                isAuthenticated={isAuthenticated}
                onCheckout={() => setCheckoutActive(true)}
                onLogout={handleLogout}
                onShowLogin={() => setLoginModalVisible(true)}
                phoneNumber={phoneNumber}
                provider={provider}
                tabBarHeight={tabBarHeight}
                userName={resolvedUserName}
              />
            </NavigationContainer>

            <Modal
              animationType="slide"
              presentationStyle="fullScreen"
              visible={checkoutActive}
              onRequestClose={() => setCheckoutActive(false)}
            >
              <CheckoutScreen
                phoneNumber={phoneNumber}
                isAuthenticated={isAuthenticated}
                onClose={() => setCheckoutActive(false)}
                onShowLogin={() => {
                  setCheckoutActive(false);
                  setLoginModalVisible(true);
                }}
                onBack={() => {
                  setCheckoutActive(false);
                  navigationRef.navigate('Cart');
                }}
              />
            </Modal>

            <Modal
              animationType="slide"
              presentationStyle="fullScreen"
              visible={loginModalVisible}
              onRequestClose={() => setLoginModalVisible(false)}
            >
              <LoginScreen
                onAuthenticated={handleAuthenticated}
                onClose={() => setLoginModalVisible(false)}
              />
            </Modal>
          </>
        )}

        {/* Floating checkout bubble — appears above tab bar when cart has items */}
        {!checkoutActive && !loginModalVisible && (
          <FloatingCartBar
            onCheckout={() => setCheckoutActive(true)}
          />
        )}

        <Toast
          config={toastConfig}
          position="bottom"
          bottomOffset={toastBottomOffset}
        />
      </View>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <BrandProvider>
        <AppContent />
      </BrandProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    width: '100%',
    height: '100%',
    margin: 0,
    padding: 0,
  },
  scene: {
    backgroundColor: COLORS.background,
  },
  tabBar: {
    borderTopWidth: 1,
    borderTopColor: '#fde6cf',
    backgroundColor: '#ffffff',
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: COLORS.primary,
    color: '#fff',
  },
});
