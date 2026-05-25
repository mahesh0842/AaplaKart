import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import AssignedOrdersScreen from './src/screens/AssignedOrdersScreen';
import { useAuthStore } from './src/store/authStore';
import { COLORS } from './src/utils/constants';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="AssignedOrders" component={AssignedOrdersScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  const user = useAuthStore((s) => s.user);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const [loading, setLoading] = useState(true);

  useEffect(() => { restoreSession().finally(() => setLoading(false)); }, []);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        {user ? <AppNavigator /> : <LoginScreen />}
      </NavigationContainer>
      <Toast />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
});

