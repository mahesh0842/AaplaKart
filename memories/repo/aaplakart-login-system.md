# AaplaKart Login System - New Architecture

## Files Modified/Created

### New Files:
- **`src/components/auth/EmailLogin.jsx`** — Email/password login & signup component with animated tab switcher, show/hide password, inline validation
- **`src/components/auth/SocialLogin.jsx`** — Social login buttons (Google) with proper branding divider

### Rewritten Files:
- **`src/screens/LoginScreen.jsx`** — Complete rewrite with:
  - Animated tab switcher (Phone | Email)
  - Brand header with logo
  - Social login section (Google)
  - Terms & Privacy footer
  - Keyboard-aware, SafeArea-aware layout
- **`src/components/auth/PhoneLogin.jsx`** — Simplified phone OTP login:
  - Step 1: Phone number input with country code
  - Step 2: OTP input with auto-verify (4 digits)
  - Smart OTP fallback: Mock → Backend REST → Firebase SDK
  - Resend cooldown timer (30s)
  - Inline error messages (no Toast dependency for OTP flow)
  - Proper disabled states, loading spinners
- **`src/services/authService.js`** — Cleaned up and reorganized:
  - Clear sections for each auth method
  - Removed verbose console.logs
  - Simplified error handling
  - Consistent return shapes across all methods

## Login Options Available
1. **📞 Phone OTP** - Smart fallback: Mock → Custom SMS → Backend REST → Firebase SDK
2. **✉️ Email/Password** - Login & Sign Up in one component with animated toggle
3. **🟢 Google Sign-In** - SocialLogin component ready for integration

## Props Flow
- `App.js` → `LoginScreen({ onAuthenticated, onClose })`
- `LoginScreen` → `PhoneLogin({ onAuthenticated })`
- `LoginScreen` → `EmailLogin({ onAuthenticated })`
- All screens receive `{ isAuthenticated, onShowLogin, phoneNumber, provider, ... }`

## Key Architecture Decisions
- EmailLogin uses dynamic `require()` for authService to avoid circular dependencies
- PhoneLogin removed Toast dependency for OTP errors - uses inline error states
- SocialLogin component is plug-and-play for Google/Apple auth
- All OTP methods return normalized session objects with `{ uid, phoneNumber, displayName, email, provider, idToken }`
- Backend registration is non-blocking
