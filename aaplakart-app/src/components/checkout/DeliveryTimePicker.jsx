// GUI category: Checkout UI. Lets the user pick a delivery time slot before proceeding to payment.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, DELIVERY_TIME_SLOTS } from '../../utils/constants';
import { getShadowStyle } from '../../utils/helpers';

const DeliveryTimePicker = ({ selected, onSelect }) => (
  <View style={styles.wrapper}>
    <View style={styles.headerRow}>
      <Ionicons name="time-outline" size={20} color={COLORS.primary} />
      <Text style={styles.heading}>When should we deliver?</Text>
    </View>
    <Text style={styles.subheading}>
      Choose a delivery slot that works best for you.
    </Text>
    <View style={styles.slotsRow}>
      {DELIVERY_TIME_SLOTS.map((slot) => {
        const isSelected = selected === slot.id;

        return (
          <Pressable
            key={slot.id}
            accessibilityLabel={`Deliver ${slot.label}`}
            onPress={() => onSelect(slot.id)}
            style={[
              styles.slot,
              isSelected && styles.slotSelected,
            ]}
          >
            <View style={[styles.slotIcon, isSelected && styles.slotIconSelected]}>
              <Ionicons
                name={slot.iconName}
                size={22}
                color={isSelected ? '#fff' : COLORS.primary}
              />
            </View>
            <Text style={[styles.slotLabel, isSelected && styles.slotLabelSelected]}>
              {slot.label}
            </Text>
            <Text style={styles.slotDescription}>{slot.description}</Text>
            {isSelected && (
              <View style={styles.checkMark}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.accent} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  subheading: {
    fontSize: 13,
    color: COLORS.mutedText,
    marginBottom: 14,
    marginLeft: 28,
  },
  slotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  slot: {
    flex: 1,
    minWidth: 140,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fde6cf',
    alignItems: 'center',
    position: 'relative',
    ...getShadowStyle(COLORS.shadow),
  },
  slotSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#fff7ed',
  },
  slotIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  slotIconSelected: {
    backgroundColor: COLORS.primary,
  },
  slotLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 3,
  },
  slotLabelSelected: {
    color: COLORS.primaryDark,
  },
  slotDescription: {
    fontSize: 11,
    color: COLORS.mutedText,
    textAlign: 'center',
  },
  checkMark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});

export default DeliveryTimePicker;
