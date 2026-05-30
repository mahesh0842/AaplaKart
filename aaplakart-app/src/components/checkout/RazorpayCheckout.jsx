// ═══════════════════════════════════════════════════════════════
// RazorpayCheckout — Clean UPI Payment Modal (Expo Go compatible)
// ═══════════════════════════════════════════════════════════════
// Opens Razorpay's hosted checkout in a WebView with a clean branded header.
// Shows amount, UPI app hints (GPay/PhonePe/Paytm), and secure badge.
// Handles: SUCCESS → onSuccess, FAILED → onFailure, DISMISS → onClose (silent).
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RAZORPAY_KEY_ID } from '../../utils/constants';

// ═══ Razorpay Checkout HTML ═══
const getCheckoutHtml = (options) => `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff}
.loading{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;color:#64748b;font-size:14px;gap:12px}
.spinner{width:36px;height:36px;border:3px solid #fde6cf;border-top-color:${options.themeColor};border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.loading-logo{font-size:24px;font-weight:900;color:#f97316;letter-spacing:-0.5px}
.loading-logo span{color:#1f2937}
</style></head>
<body><div class="loading" id="loading"><div class="loading-logo">Aapla<span>Kart</span></div><div class="spinner"></div><p>Connecting to secure payment...</p></div>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>var rzp=new Razorpay({key:'${options.key}',amount:'${options.amount}',currency:'${options.currency||'INR'}',name:'${options.name}',description:'${options.description}',order_id:'${options.order_id}',prefill:{name:'${options.prefillName||''}',email:'${options.prefillEmail||''}',contact:'${options.prefillContact||''}'},theme:{color:'${options.themeColor}'},modal:{ondismiss:function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'DISMISS'}))},escape:false,animation:true},handler:function(r){window.ReactNativeWebView.postMessage(JSON.stringify({type:'SUCCESS',data:{razorpay_payment_id:r.razorpay_payment_id,razorpay_order_id:r.razorpay_order_id,razorpay_signature:r.razorpay_signature}}))}});
rzp.on('payment.failed',function(r){window.ReactNativeWebView.postMessage(JSON.stringify({type:'FAILED',data:{error:{code:r.error.code,description:r.error.description,reason:r.error.reason||''}}}))});
document.getElementById('loading').style.display='none';rzp.open();</script></body></html>`;

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const RazorpayCheckout = ({ visible, onClose, onSuccess, onFailure, checkoutOptions = {} }) => {
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const {
    order_id = '', amount = 0, currency = 'INR',
    name = 'AaplaKart', description = '',
    prefillName = '', prefillEmail = '', prefillContact = '',
    themeColor = '#f97316',
  } = checkoutOptions;

  const amountInRupees = (Number(amount) / 100).toFixed(0);

  const html = getCheckoutHtml({
    key: RAZORPAY_KEY_ID, order_id, amount, currency, name, description,
    prefillName, prefillEmail, prefillContact, themeColor,
  });

  const handleMessage = (e) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'SUCCESS') {
        setLoading(true);
        onSuccess?.(msg.data);
      } else if (msg.type === 'FAILED') {
        onFailure?.(msg.data.error);
      } else if (msg.type === 'DISMISS') {
        onClose?.(); // Silent — no alert
      }
    } catch {}
  };

  React.useEffect(() => {
    if (visible) {
      setLoading(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* ═══ HEADER BAR ═══ */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={22} color="#475569" />
          </Pressable>

          <View style={styles.headerCenter}>
            <View style={styles.secureBadge}>
              <Ionicons name="shield-checkmark" size={13} color="#16a34a" />
              <Text style={styles.secureText}>Secure UPI</Text>
            </View>
          </View>

          <View style={styles.headerRight} />
        </View>

        {/* ═══ LOADING OVERLAY ═══ */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingCard}>
              <Text style={styles.loadingBrand}>Aapla<Text style={{ color: '#f97316' }}>Kart</Text></Text>
              <ActivityIndicator size="small" color={themeColor} style={{ marginTop: 10 }} />
              <Text style={styles.loadingText}>Opening payment gateway...</Text>
            </View>
          </View>
        )}

        {/* ═══ WEBVIEW ═══ */}
        <WebView
          source={{ html }}
          style={styles.webview}
          onMessage={handleMessage}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState={false}
          allowsBackForwardNavigationGestures={false}
        />
      </Animated.View>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 48 : 32,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  secureText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
    letterSpacing: 0.3,
  },
  headerRight: {
    width: 36,
    alignItems: 'flex-end',
  },
  brandText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1f2937',
    letterSpacing: -0.3,
  },
  brandAccent: {
    color: '#f97316',
  },

  // ── Info Bar (Amount) ──
  infoBar: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#fff7ed',
    borderBottomWidth: 1,
    borderBottomColor: '#fde6cf',
  },
  infoLine: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  infoAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1f2937',
  },

  // ── Loading Overlay ──
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 36,
    paddingVertical: 28,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
    }),
  },
  loadingBrand: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1f2937',
    letterSpacing: -0.5,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },

  // ── WebView ──
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default RazorpayCheckout;
