// GUI category: Header. Delivery badge — rotating text (Fast/Fresh/Deliver) + ⚡ flash.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { COLORS } from '../../utils/constants';

const PHRASES = [
  { icon: '⚡', text: 'Fast Delivery' },
  { icon: '🥬', text: 'Fresh Products' },
  { icon: '🕐', text: 'Deliver in 20 min' },
];

const DeliveryBadge = () => {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const phrase = PHRASES[phraseIdx];

  // Rotate phrases every 2.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Slide out + fade out
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -12, duration: 150, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      ]).start(() => {
        setPhraseIdx((prev) => (prev + 1) % PHRASES.length);
        slideAnim.setValue(10);
        // Slide in + fade in
        Animated.parallel([
          Animated.spring(slideAnim, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
          Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start();
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [slideAnim, fadeAnim]);

  // ⚡ Fast thunder double-flash
  useEffect(() => {
    const flash = Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0.2, duration: 50, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(1800),
      ])
    );
    flash.start();
    return () => flash.stop();
  }, [flashAnim]);

  return (
    <Animated.View style={styles.badge}>
      {/* Icon with flash */}
      <Animated.Text style={[styles.icon, { opacity: flashAnim }]}>
        {phrase.icon}
      </Animated.Text>
      {/* Rotating text */}
      <Animated.Text
        style={[
          styles.text,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {phrase.text}
      </Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.successBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#22c55e44',
    minWidth: 130,
    overflow: 'hidden',
  },
  icon: {
    fontSize: 13,
  },
  text: {
    color: COLORS.successText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default DeliveryBadge;

