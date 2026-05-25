// GUI category: Header. Delivery badge with dramatic lightning animation — "⚡ Deliver in 20 min".
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../utils/constants';

const DeliveryBadge = () => {
  const flashAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Thunder flash — quick bright pulse
    const flash = Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(flashAnim, { toValue: 0.8, duration: 100, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay(2000),
      ])
    );
    flash.start();
    return () => flash.stop();
  }, [flashAnim]);

  useEffect(() => {
    // Subtle scale breathing
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [scaleAnim]);

  return (
    <View style={styles.badge}>
      <Animated.Text style={{ opacity: flashAnim, fontSize: 14 }}>⚡</Animated.Text>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Text style={styles.text}>Deliver in 20 min</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.successBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: {
    color: COLORS.successText,
    fontSize: 11,
    fontWeight: '700',
  },
});

export default DeliveryBadge;

