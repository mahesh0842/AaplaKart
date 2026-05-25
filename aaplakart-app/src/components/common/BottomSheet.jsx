// GUI category: Common primitives. Reusable animated bottom sheet — 75% height, slide-up, backdrop overlay.
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { COLORS } from '../../utils/constants';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
export const SHEET_HEIGHT = Math.min(SCREEN_HEIGHT * 0.75, 600);

const BottomSheet = ({ visible, onClose, children }) => {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.wrapper}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handleArea}>
            <View style={styles.handleBar} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    overflow: 'hidden',
  },
  handleArea: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
});

export default BottomSheet;
