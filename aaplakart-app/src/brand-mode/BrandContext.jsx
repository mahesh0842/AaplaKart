// GUI category: App state. Brand mode context — toggles between AaplaKart and The Waffle Guy with animations.
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';

const BrandContext = createContext({
  isWaffleMode: false,
  toggleWaffleMode: () => {},
  brandAnim: { interpolate: () => 0 },
  slideAnim: { interpolate: () => 0 },
});

export const BrandProvider = ({ children }) => {
  const [isWaffleMode, setIsWaffleMode] = useState(false);
  const brandAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const toggleWaffleMode = useCallback(() => {
    setIsWaffleMode((prev) => {
      const toValue = prev ? 0 : 1;

      // Brand content cross-fade
      Animated.timing(brandAnim, {
        toValue,
        duration: 350,
        useNativeDriver: true,
      }).start();

      // Slide transition effect
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      return !prev;
    });
  }, [brandAnim, slideAnim]);

  const contextValue = useMemo(
    () => ({ isWaffleMode, toggleWaffleMode, brandAnim, slideAnim }),
    [isWaffleMode, toggleWaffleMode, brandAnim, slideAnim]
  );

  return (
    <BrandContext.Provider value={contextValue}>
      {children}
    </BrandContext.Provider>
  );
};

export const useBrandMode = () => useContext(BrandContext);

export default BrandContext;
