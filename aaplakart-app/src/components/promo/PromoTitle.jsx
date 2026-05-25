// GUI category: Promo banner. Renders the title and supporting offer text.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const PromoTitle = () => (
  <View>
    <Text style={styles.title}>FREE DELIVERY</Text>
    <Text style={styles.subtitle}>On orders above ₹199 today only!</Text>
  </View>
);

const styles = StyleSheet.create({
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: '#ffedd5',
    marginTop: 2,
    fontSize: 11,
    lineHeight: 16,
  },
});

export default PromoTitle;

