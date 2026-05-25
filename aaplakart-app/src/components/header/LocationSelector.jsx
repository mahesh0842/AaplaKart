// GUI category: Header. Shows the delivery location with a dropdown indicator.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

const LocationSelector = ({ location }) => (
  <View style={styles.container}>
    <Text style={styles.label}>Delivering to</Text>
    <View style={styles.row}>
      <Text style={styles.location}>{location}</Text>
      <Ionicons name="chevron-down" size={16} color={COLORS.text} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    color: COLORS.mutedText,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  location: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginRight: 2,
  },
});

export default LocationSelector;

