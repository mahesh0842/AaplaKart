<<<<<<< HEAD
# 🚚 AaplaKart Delivery — Partner App

> **React Native (Expo)** app for delivery partners — accept orders, navigate, update status
> 
> **Platform:** Android (Expo Go) | **Last Updated:** May 25, 2026

---

## 📦 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React Native (Expo) | SDK 54 |
| State | Zustand + AsyncStorage | 5.0.12 |
| Navigation | React Navigation | v7 (Native Stack) |
| Maps | react-native-maps | 1.20.1 |
| Location | expo-location | ~19 |
| Auth | Mock OTP (dev) / Firebase (prod) | — |

---

## 📁 Project Structure

```
aaplakart-delivery/
├── App.js                    # Root — auth check, navigation
├── app.json                  # Expo config
├── package.json              # Dependencies
└── src/
    ├── screens/
    │   ├── LoginScreen.jsx          # Phone + OTP login
    │   ├── DashboardScreen.jsx      # Stats + active orders list
    │   ├── OrderDetailScreen.jsx    # Order detail + map + status update
    │   └── AssignedOrdersScreen.jsx # All assigned orders
    ├── components/
    │   ├── OrderCard.jsx            # Order card UI
    │   ├── StatusBadge.jsx          # Colored status badge
    │   ├── ActionButton.jsx         # Reusable action button
    │   └── DeliveryMap.jsx          # Google Maps + route
    ├── services/
    │   ├── api.js                   # HTTP client
    │   └── realtime.js              # Polling engine (5s interval)
    ├── store/
    │   ├── authStore.js             # Auth state + session
    │   └── deliveryStore.js         # Orders + simulation
    └── utils/
        └── constants.js             # Colors, status labels, config
```

---

## 🚀 Quick Start

```bash
cd aaplakart-delivery
npm install
npx expo start --port 8082
```

> Requires backend running on `http://localhost:8000`

---

## 🔐 Auth Flow

| Mode | OTP | Token |
|------|-----|-------|
| **Dev (Mock)** | `123456` (any phone) | `delivery-dev-*` |
| **Production** | Real OTP → `/api/auth/delivery-login` | Backend token |

Session persists via AsyncStorage — restored on app reopen.

---

## 📦 Order Lifecycle (Delivery View)

```
1. Dashboard shows "active" orders (not delivered/cancelled)
2. Driver taps order → OrderDetailScreen (map + customer address)
3. Driver updates status:
   accepted → picked_up → out-for-delivery → delivered
4. Each status change calls PATCH /api/delivery/orders/{id}/status
5. Polling every 5s fetches latest orders
```

---

## 📱 Screens

| Screen | Purpose |
|--------|---------|
| **LoginScreen** | Phone + OTP authentication |
| **DashboardScreen** | Stats (active orders, earnings), nearby orders list |
| **OrderDetailScreen** | Single order detail, map with customer location, status action buttons |
| **AssignedOrdersScreen** | Complete list of assigned/completed orders |

---

## 🔄 Polling & Simulation

- Backend polled every 5 seconds via `realtime.js`
- If backend unreachable, demo mode shows simulated orders
- Distance from shop calculated using haversine formula

---

## 🐛 Known Limitations

| Issue | Status |
|-------|--------|
| `zustand` version behind main app (5.0.12 vs 5.0.13) | Upgrade pending |
| Web version unsupported (react-native-maps) | Native only |
| No real-time WebSocket (uses polling) | Future enhancement |

---

## 🔗 Related Docs

- [Main App README](../aaplakart-app/README.md)
- [Backend README](../aaplakart-backend/README.md)
- [Architecture Overview](../ARCHITECTURE_OVERVIEW.md)
- [Delivery App Analysis](../ANALYSIS_DELIVERY_APP.md)
=======
# aaplakart-delivery
>>>>>>> 6b13b350d7c7e371c1904cc5fe0ba9a121e0b565
