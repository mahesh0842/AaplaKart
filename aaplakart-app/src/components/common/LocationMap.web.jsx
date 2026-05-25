// Web version of LocationMap — no react-native-maps, shows coordinates text instead.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../utils/constants';

const LocationMap = ({ latitude, longitude, address = '', height = 180 }) => {
  if (latitude == null || longitude == null) {
    return null;
  }

  return (
    <View style={[styles.container, { height, justifyContent: 'center', alignItems: 'center', padding: 10 }]}>
      <Text style={{ color: COLORS.mutedText, fontSize: 13, textAlign: 'center' }}>
        📍 {latitude.toFixed(4)}, {longitude.toFixed(4)}
      </Text>
      {address ? (
        <Text style={{ color: COLORS.text, fontSize: 12, marginTop: 4, textAlign: 'center' }}>{address}</Text>
      ) : null}
      <Text style={{ color: COLORS.mutedText, fontSize: 11, marginTop: 8 }}>
        Map will appear on mobile device
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});

export default LocationMap;
