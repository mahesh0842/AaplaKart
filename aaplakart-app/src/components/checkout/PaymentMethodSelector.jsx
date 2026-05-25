// GUI category: Checkout UI. Lets the user pick a payment method from a predefined list.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, PAYMENT_METHODS } from '../../utils/constants';
import { getShadowStyle, scaleW } from '../../utils/helpers';

const iconLibrary = {
  Ionicons,
  MaterialCommunityIcons,
};

const PaymentMethodSelector = ({ selected, onSelect }) => (
  <View style={styles.wrapper}>
    <Text style={styles.heading}>Payment Method</Text>
    {PAYMENT_METHODS.map((method) => {
      const IconComponent = iconLibrary[method.iconFamily] || Ionicons;
      const isSelected = selected === method.id;

      return (
        <Pressable
          key={method.id}
          accessibilityLabel={`Select ${method.label}`}
          onPress={() => onSelect(method.id)}
          style={[
            styles.option,
            isSelected && styles.optionSelected,
          ]}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.iconWrap, isSelected && styles.iconWrapSelected]}>
              <IconComponent
                name={method.iconName}
                size={22}
                color={isSelected ? '#fff' : COLORS.primary}
              />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                {method.label}
              </Text>
              <Text style={styles.optionDescription}>{method.description}</Text>
            </View>
          </View>
          <View style={[styles.radio, isSelected && styles.radioSelected]}>
            {isSelected && <View style={styles.radioDot} />}
          </View>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
  },
  heading: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fde6cf',
    ...getShadowStyle(COLORS.shadow),
  },
  optionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#fff7ed',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconWrapSelected: {
    backgroundColor: COLORS.primary,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  optionLabelSelected: {
    color: COLORS.primaryDark,
  },
  optionDescription: {
    marginTop: 3,
    fontSize: 12,
    color: COLORS.mutedText,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
});

export default PaymentMethodSelector;
