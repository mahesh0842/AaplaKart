// GUI category: App constants. Defines product data, filters, labels, and shared colors.
// ── Centralized spacing system ────────────────────────────────
export const SPACING = {
  screenH: 20,        // screen horizontal padding
  screenV: 14,        // screen vertical padding top
  card: 12,           // card internal padding (standard)
  cardSm: 8,          // small card/row padding
  cardLg: 18,         // large card padding (sections)
  gridGap: 10,        // gap between grid items
  sectionGap: 24,     // margin between sections
  sectionGapSm: 16,   // small margin between sections
  listRows: 14,       // gap between list rows (cart items)
  radius: 12,         // standard card radius
  radiusSm: 8,        // small radius (badges, chips)
  radiusLg: 22,       // large card radius (cart items, empty states)
  radiusXl: 28,       // extra large radius (profile cards)
  buttonH: 14,        // button padding vertical
  buttonW: 32,        // button padding horizontal
};

export const COLORS = {
  primary: '#f97316',
  primaryDark: '#ea580c',
  accent: '#16a34a',
  background: '#fff7ed',
  card: '#ffffff',
  border: '#fed7aa',
  text: '#1f2937',
  mutedText: '#6b7280',
  mutedBg: '#f3f4f6',
  successBg: '#dcfce7',
  successText: '#15803d',
  dangerBg: '#fee2e2',
  dangerText: '#b91c1c',
  shadow: '#9a3412',
};

export const PROMO_CODE = 'FREEDEL';
export const FREE_DELIVERY_THRESHOLD = 199;
export const DELIVERY_FEE = 30;
export const MOCK_OTP_CODE = '1234';
export const MOCK_AUTH_STORAGE_KEY = '@aaplakart/mock-session';

export const CATEGORY_OPTIONS = [
  'All',
  'Vegetables',
  'Dairy',
  'Fruits',
  'Grains',
  'Spices',
];

/** Icon mapping for each category — used by CategoryPanel and CategoryItem */
export const CATEGORY_ICONS = {
  All: 'grid-outline',
  Vegetables: 'leaf-outline',
  Dairy: 'ice-cream-outline',
  Fruits: 'nutrition-outline',
  Grains: 'ear-outline',
  Spices: 'flame-outline',
  'Classic Waffles': 'ice-cream-outline',
  'Chocolate Waffles': 'cafe-outline',
  'Special Waffles': 'star-outline',
  Beverages: 'cafe-outline',
};

export const PAYMENT_METHODS = [
  {
    id: 'upi',
    label: 'UPI',
    description: 'Google Pay, PhonePe, Paytm & more',
    iconFamily: 'MaterialCommunityIcons',
    iconName: 'qrcode-scan',
  },
  {
    id: 'cod',
    label: 'Cash on Delivery',
    description: 'Pay when your order arrives',
    iconFamily: 'Ionicons',
    iconName: 'cash-outline',
  },
];

export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  OUT_FOR_DELIVERY: 'out-for-delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

export const ORDER_STATUS_LABELS = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  'out-for-delivery': 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const RAZORPAY_KEY_ID = 'rzp_test_SiiU69ukaSSf2r';

export const DELIVERY_TIME_SLOTS = [
  { id: 'asap', label: 'ASAP', description: 'Within 60 minutes', iconName: 'flash-outline' },
  { id: 'morning', label: 'Morning', description: '7:00 AM – 12:00 PM', iconName: 'sunny-outline' },
  { id: 'afternoon', label: 'Afternoon', description: '12:00 PM – 5:00 PM', iconName: 'partly-sunny-outline' },
  { id: 'evening', label: 'Evening', description: '5:00 PM – 9:00 PM', iconName: 'moon-outline' },
];

