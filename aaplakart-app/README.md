# 🛒 AaplaKart — Main App (Customer)

> **React Native (Expo SDK 54)** — Dual-brand grocery ordering app (AaplaKart + The Waffle Guy)
> 
> Platform: Android (Expo Go) | Web (broken — react-native-maps is native-only)
> 
> **Last Updated: May 25, 2026**

---

## 📦 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React Native (Expo) | SDK 54 |
| React | React | 19.1.0 |
| State | Zustand + AsyncStorage (persist) | 5.0.13 |
| Navigation | React Navigation | v7 (Bottom Tabs) |
| Auth | Firebase Auth + Mock OTP + Google Sign-In | — |
| Payments | Razorpay (WebView) | Test Mode |
| Maps | react-native-maps | 1.20.1 |
| UI | Ionicons, toast-message, Animated API | — |

---

## 📁 Project Structure

```
aaplakart-app/
├── App.js                    # Root — Firebase, auth, tabs, modals, cart
├── app.json                  # Expo config (scheme, permissions)
├── package.json              # Dependencies + scripts
├── .env                      # Firebase keys, mock OTP flag
├── assets/                   # Splash icon
└── src/
    ├── screens/              # 9 screens
    ├── components/           # 7 folders, 30+ components
    ├── services/             # api.js, firebase.js, razorpay.js, location
    ├── store/                # Zustand (cart, orders, addresses)
    ├── brand-mode/           # BrandContext (Kart ↔ Waffle toggle)
    └── utils/                # constants.js, helpers.js
```

---

## 🚀 Quick Start

```bash
cd aaplakart-app
npm install
npx expo start -c
```

> `-c` = **clear Metro cache** (always use after dependency changes)

### Prerequisites
- Node.js v24+
- **Expo Go** on phone (Play Store)
- **Same WiFi** for phone + laptop
- Backend running on `http://localhost:8000`

---

## 🔐 Authentication

| Method | OTP | Token | User Role |
|--------|-----|-------|-----------|
| **Mock OTP** (Dev) | `123456` (any phone) | `mock-dev-*` | `user` |
| **Firebase Phone** (Prod) | Real SMS OTP | Firebase ID Token | `user` |
| **Google Sign-In** | expo-auth-session | Backend verified | `user` |

---

## 📱 Screens

| Screen | Tab | Purpose |
|--------|-----|---------|
| **HomeScreen** | Home | Product browse, search, promo slider, pull-to-refresh |
| **BrandCategoryScreen** | Categories / Waffle | Category grid → PLP with subcategory rail |
| **CartScreen** | Cart | Items, quantity controls, checkout CTA |
| **CheckoutScreen** | Modal | 3-step: Address → Time → Payment → Confirmation |
| **ProfileScreen** | Profile | User info → Orders, Addresses, About, Privacy, Logout |
| **OrdersScreen** | Profile→Orders | Order history, status (30s auto-poll) |
| **AddressBookScreen** | Profile→Address | Saved addresses CRUD with geocoding + map |
| **LoginScreen** | Modal | Phone OTP + Google Sign-In |
| **InfoScreen** | Profile→About | About Us / Privacy Policy |

---

## 🛒 State Management (Zustand)

| Store | AsyncStorage Key | Data | Persisted |
|-------|-----------------|------|-----------|
| `cartStore` | `aaplakart-cart` | `items[]` (product + quantity) | ✅ |
| `addressStore` | `aaplakart-addresses` | `addresses[]` (Home/Office/Other) | ✅ |
| `ordersStore` | `aaplakart-orders` | `orders[]` (history) | ✅ |

---

## 🔌 API Integration

Backend URL auto-detected:
```js
// Web → localhost:8000
// Mobile → dev host IP:8000 (from expoConfig.hostUri)
// Or override via EXPO_PUBLIC_BACKEND_URL
```

---

## 🐛 Recent Fixes (May 25, 2026)

| Issue | Fix |
|-------|-----|
| ❌ "getSnapshot" infinite loop (Android) | ✅ Upgraded zustand 5.0.12→5.0.13 + stabilized React Navigation options + `useCallback` on all screen renderers + fixed `useAddressStore()` selectors |
| ❌ BrandContext re-renders | ✅ Wrapped value in `useMemo`, toggle in `useCallback` |
| ❌ `tabBarButton` remounting `BrandTabToggle` | ✅ Extracted as stable `WaffleTabButton` component |
| ⚠️ Web version broken | `react-native-maps` is native-only — web unsupported |

---

## 🔗 Related Docs

- [Backend README](../aaplakart-backend/README.md)
- [Architecture Overview](../ARCHITECTURE_OVERVIEW.md)
- [Full App Analysis](../ANALYSIS_MAIN_APP.md)
- [Start All Services](../start-all.ps1)
