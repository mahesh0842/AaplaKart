// GUI category: Shared helpers. Keeps formatting, filtering, cart math, and responsive scaling out of UI files.
import { Dimensions, PixelRatio, Platform } from 'react-native';
import {
  DELIVERY_FEE,
  FREE_DELIVERY_THRESHOLD,
  MOCK_AUTH_STORAGE_KEY,
} from './constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions (iPhone 11 / standard phone)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// Scale a size proportionally to screen width (for horizontal elements)
export const scaleW = (size) => {
  const ratio = SCREEN_WIDTH / BASE_WIDTH;
  return PixelRatio.roundToNearestPixel(size * Math.min(ratio, 1.5));
};

// Scale a size proportionally to screen height (for vertical elements)
export const scaleH = (size) => {
  const ratio = SCREEN_HEIGHT / BASE_HEIGHT;
  return PixelRatio.roundToNearestPixel(size * Math.min(ratio, 1.5));
};

// Moderate scale — interpolates between fixed and scaled
export const moderateScale = (size, factor = 0.5) => {
  const ratio = (SCREEN_WIDTH / BASE_WIDTH - 1) * factor + 1;
  return PixelRatio.roundToNearestPixel(size * Math.min(ratio, 1.5));
};

// Responsive font size
export const responsiveFont = (size) => {
  const ratio = SCREEN_WIDTH / BASE_WIDTH;
  return PixelRatio.roundToNearestPixel(size * Math.min(ratio, 1.3));
};

// Check if device is a tablet
export const isTablet = () => {
  const aspectRatio = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) / Math.max(SCREEN_WIDTH, SCREEN_HEIGHT);
  const diagonal = Math.sqrt(SCREEN_WIDTH * SCREEN_WIDTH + SCREEN_HEIGHT * SCREEN_HEIGHT);
  return diagonal >= 900 || aspectRatio < 0.6;
};

// Get responsive card width for grid layouts
// @param {number} columns - number of columns
// @param {number} gap - gap between cards
// @param {number} [extraOffset=0] - extra horizontal offset (e.g., for sidebar rail)
export const getCardWidth = (columns, gap, extraOffset = 0) => {
  const totalGap = gap * (columns - 1);
  return (SCREEN_WIDTH - 40 - extraOffset - totalGap) / columns; // 40 = default horizontal padding
};

export const getShadowStyle = (shadowColor = '#9a3412') => ({
  shadowColor,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
  elevation: 4,
});

export const formatCurrency = (value) => `₹${Number(value || 0).toFixed(0)}`;

export const normalizePhoneNumber = (countryCode, phoneNumber) => {
  const digits = String(phoneNumber || '').replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  return `${countryCode}${digits}`;
};

export const filterProducts = (products, selectedCategory, searchTerm) => {
  const normalizedSearch = String(searchTerm || '').trim().toLowerCase();

  return products.filter((product) => {
    const matchesCategory =
      selectedCategory === 'All' || product.category === selectedCategory;

    const matchesSearch =
      !normalizedSearch ||
      product.name.toLowerCase().includes(normalizedSearch) ||
      product.category.toLowerCase().includes(normalizedSearch);

    return matchesCategory && matchesSearch;
  });
};

export const getCartCount = (items) =>
  (items || []).reduce((count, item) => count + item.quantity, 0);

export const getCartSubtotal = (items) =>
  (items || []).reduce((sum, item) => sum + item.price * item.quantity, 0);

export const getDeliveryFee = (subtotal) =>
  subtotal > FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;

export const getCartTotal = (subtotal) => subtotal + getDeliveryFee(subtotal);

export const isInStock = (product) => Number(product?.stock || 0) > 0;

/**
 * Returns true if the product has selectable options/variants (e.g., weight options).
 * Products with options + showVariants=true open AddToCartModal instead of being added directly.
 * Admin controls this via "Show Variants" toggle in catalog panel.
 */
export const hasOptions = (product) =>
  product?.showVariants === true && Array.isArray(product?.options) && product.options.length > 0;

/**
 * Converts category string array to CategoryPanel-compatible list.
 * @param {string[]} categoryNames - e.g. ['All', 'Vegetables', 'Dairy']
 * @param {object} iconMap - e.g. CATEGORY_ICONS
 * @returns {Array<{key: string, label: string, icon: string}>}
 */
export const buildCategoryList = (categoryNames, iconMap = {}) =>
  categoryNames.map((name) => ({
    key: name,
    label: name,
    icon: iconMap[name] || 'grid-outline',
  }));

export const sleep = (duration = 500) =>
  new Promise((resolve) => setTimeout(resolve, duration));

export const getMockSessionKey = () => MOCK_AUTH_STORAGE_KEY;

// Mask phone: show last 4 digits, hide rest with x
// "+91 9876543210" → "+91 987654xxxx"
export const maskPhoneNumber = (phone) => {
  if (!phone) return '';

  const normalized = String(phone).replace(/[^\d+]/g, '');
  const match = normalized.match(/^(\+\d{1,3})?(\d+)$/);

  if (!match) {
    return phone;
  }

  const countryCode = match[1] || '';
  const localNumber = match[2] || '';
  const lastFourDigits = localNumber.slice(-4);
  const maskedValue = `XXXX${lastFourDigits}`;

  return countryCode ? `${countryCode} ${maskedValue}` : maskedValue;
};
