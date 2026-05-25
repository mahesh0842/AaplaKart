// GUI category: Promo banner. Compact offer card — no local images, Firebase images can be used later.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import PromoTitle from './PromoTitle';
import PromoCode from './PromoCode';
import ShopNowButton from './ShopNowButton';
import { PROMO_CODE } from '../../utils/constants';
import { getShadowStyle } from '../../utils/helpers';

const PromoBanner = ({ onShopNow }) => (
  <View style={styles.outer}>
    <View style={styles.container}>
      <PromoTitle />
      <PromoCode code={PROMO_CODE} />
      <ShopNowButton onPress={onShopNow} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    marginTop: 6,
    marginHorizontal: 16,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f97316',
    alignItems: 'center',
    ...getShadowStyle('#f97316'),
  },
});

export default PromoBanner;

