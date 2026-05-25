// GUI category: Common primitives. Responsive SafeAreaView shell for all screens.
// Applies top safe area only by default — tab bar handles bottom.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../utils/constants';
import { isTablet } from '../../utils/helpers';

const Container = ({
  children,
  style,
  contentStyle,
  edges = ['top', 'left', 'right'],
}) => {
  const tab = isTablet();
  return (
    <SafeAreaView edges={edges} style={[styles.safeArea, style]}>
      <View style={[styles.content, tab && styles.tabletContent, contentStyle]}>
        {children}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  tabletContent: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
});

export default Container;
