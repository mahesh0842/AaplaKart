// GUI category: Header. Search bar with clear button and focus styling.
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

const SearchBar = ({ value, onChangeText }) => {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      style={[styles.container, focused && styles.containerFocused]}
      onPress={() => inputRef.current?.focus()}
    >
      <Ionicons name="search-outline" size={20} color={COLORS.mutedText} />
      <TextInput
        ref={inputRef}
        accessibilityLabel="Search products"
        placeholder="Search vegetables, dairy and more"
        placeholderTextColor={COLORS.mutedText}
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        autoCapitalize="none"
        returnKeyType="search"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {value.length > 0 && (
        <Pressable
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          style={styles.clearBtn}
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={18} color={COLORS.mutedText} />
        </Pressable>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#f3d2b2',
  },
  containerFocused: {
    borderColor: COLORS.primary,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    color: COLORS.text,
    fontSize: 13,
    paddingVertical: 0,
  },
  clearBtn: {
    marginLeft: 6,
    padding: 2,
  },
});

export default SearchBar;

