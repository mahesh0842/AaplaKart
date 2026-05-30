// GUI category: App shell. Boots Firebase, auth persistence, navigation, modals, and safe layout affordances.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LogBox, Modal, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
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
import RatingPrompt from './src/components/common/RatingPrompt';
import { COLORS } from './src/utils/constants';
import { getCartCount } from './src/utils/helpers';
import { useCartStore } from './src/store/cartStore';
import { useUserNameStore } from './src/store/userNameStore';
import {
  restoreSession,
  persistSession,
  clearSession,
  registerWithBackend,
} from './src/services/authService';
import { startRealtime, disconnectWebSocket } from './src/services/websocketService';

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
  const [loginDismissed, setLoginDismissed] = useState(false);

  // Prevent splash auto-hide — we control when to hide it
  useEffect(() => {
    SplashScreen.preventAutoHideAsync();
  }, []);

  // Hide splash when app finishes booting
  useEffect(() => {
    if (authReady && storageReady) {
      SplashScreen.hideAsync();
    }
  }, [authReady, storageReady]);

  const tabBarHeight = 64 + Math.max(insets.bottom, 12);
  const floatingCartOffset = tabBarHeight + 18;

  const isAuthenticated = Boolean(firebaseUser || mockSession);
  const phoneNumber = firebaseUser?.phoneNumber || mockSession?.phoneNumber || '';
  const provider = firebaseUser ? 'firebase' : mockSession?.provider || 'mock';

  // ── User name: store value > session value > default ──
  const storeDisplayName = useUserNameStore((state) => state.displayName);
  const resolvedUserName = useMemo(
    () =>
      storeDisplayName?.trim() ||
      firebaseUser?.displayName?.trim() ||
      mockSession?.displayName?.trim() ||
      (phoneNumber ? 'AaplaKart User' : ''),
    [storeDisplayName, firebaseUser?.displayName, mockSession?.displayName, phoneNumber]
  );

  // ── Sync store with session on login ──
  useEffect(() => {
    const sessionName = mockSession?.displayName?.trim();
    if (sessionName && sessionName !== 'AaplaKart User') {
      useUserNameStore.getState().setDisplayName(sessionName);
    }
  }, [mockSession?.displayName]);

  // ── Auto-show login for first-time (unauthenticated) users (only once) ──
  useEffect(() => {
    if (authReady && storageReady && !isAuthenticated && !loginDismissed) {
      setLoginModalVisible(true);
    }
  }, [authReady, storageReady, isAuthenticated, loginDismissed]);

  // ── WebSocket real-time order updates (same global WS as admin + delivery) ──
  useEffect(() => {
    if (authReady && storageReady && isAuthenticated) {
      const cleanup = startRealtime();
      return () => {
        cleanup();
        disconnectWebSocket();
      };
    }
  }, [authReady, storageReady, isAuthenticated]);

  // ── Firebase auth bootstrap ─────────────────────────────────
  useEffect(() => {
    let mounted = true;
    let unsubscribe = () => {};

    const bootstrap = async () => {
      try {
        clearImageCache();

        const savedSession = await restoreSession();

        if (mounted && savedSession) {
          setMockSession(savedSession);
        }
      } catch (error) {
        console.log('Unable to restore session:', error?.message);
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
            await clearSession();
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

    // Register with backend (non-blocking)
    const enrichedSession = await registerWithBackend(normalizedSession);

    // Persist session for non-Firebase providers (email, google, mock)
    const shouldPersist = !firebaseUser || enrichedSession.provider !== 'firebase';

    if (shouldPersist) {
      setMockSession(enrichedSession);
      await persistSession(enrichedSession);
    } else {
      setMockSession(null);
      await clearSession();
    }

    setLoginModalVisible(false);
    setLoginDismissed(false); // reset on successful login
  };

  const handleLogout = async () => {
    if (firebaseReady && auth && firebaseUser) {
      await firebaseSignOut(auth);
    }

    setFirebaseUser(null);
    setMockSession(null);
    setCheckoutActive(false);
    setLoginModalVisible(false);
    await clearSession();

    // Auto-show login after sign-out — reset dismissed flag
    setLoginDismissed(false);
    setLoginModalVisible(true);

    Toast.show({
      type: 'success',
      text1: 'Logged out',
      text2: 'Your session has been cleared from this device.',
    });
  };

  // ── Update user name (called from CheckoutScreen after order with real name) ──
  const handleUpdateUserName = useCallback(async (newName) => {
    if (!newName || newName === 'AplaKart User') return;

    // Only update if current name is still default (first-time capture)
    const currentName = useUserNameStore.getState().displayName
      || mockSession?.displayName?.trim()
      || '';
    if (currentName && currentName !== 'AaplaKart User') return;

    // Update global store -> Profile tab reflects immediately
    useUserNameStore.getState().setDisplayName(newName);

    // Update mockSession + persist
    if (mockSession) {
      const updatedSession = { ...mockSession, displayName: newName };
      setMockSession(updatedSession);
      await persistSession(updatedSession);
    }

    // Update backend (non-blocking)
    try {
      const { updateMyProfile } = require('./src/services/api');
      await updateMyProfile({ display_name: newName });
    } catch {
      // non-blocking
    }
  }, [mockSession]);

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
                onShowLogin={() => {
                  setLoginDismissed(false);
                  setLoginModalVisible(true);
                }}
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
                onClose={() => {
                  setCheckoutActive(false);
                  navigationRef.navigate('Home');
                }}
                onShowLogin={() => {
                  setCheckoutActive(false);
                  setLoginDismissed(false);
                  setLoginModalVisible(true);
                }}
                onBack={() => {
                  setCheckoutActive(false);
                  navigationRef.navigate('Cart');
                }}
                onUpdateUserName={handleUpdateUserName}
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
                onClose={() => {
                  setLoginModalVisible(false);
                  setLoginDismissed(true); // user chose to skip
                }}
              />
            </Modal>
          </>
        )}

        {/* Floating cart bubble — tap opens Checkout directly */}
        {!checkoutActive && !loginModalVisible && !['Cart', 'Profile'].includes(currentRoute) && (
          <FloatingCartBar onNavigateCart={() => setCheckoutActive(true)} />
        )}

        {/* Rating prompt — shown after 3rd delivery */}
        <RatingPrompt />

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
