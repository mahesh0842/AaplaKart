import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../utils/constants';

export default function SplashScreen({ onFinish }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        onFinish?.();
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoWrap, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>AaplaKart</Text>
        <Text style={styles.subtitle}>Delivery Partner</Text>
      </Animated.View>
      <Animated.Text style={[styles.footer, { opacity: fadeAnim }]}>v1.0.0</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  logoWrap: { alignItems: 'center' },
  logo: { width: 100, height: 100, marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  subtitle: { fontSize: 16, fontWeight: '600', color: '#fff', opacity: 0.9, marginTop: 4 },
  footer: { position: 'absolute', bottom: 40, color: '#fff', opacity: 0.6, fontSize: 12 },
});
