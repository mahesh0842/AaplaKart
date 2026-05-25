// WebView-based Razorpay Checkout (Expo Go compatible)
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { RAZORPAY_KEY_ID } from '../../utils/constants';

const getCheckoutHtml = (options) => `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;background:#fff}
.loading{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;color:#6b7280;font-size:14px}
.spinner{width:40px;height:40px;border:3px solid #fde6cf;border-top-color:${options.themeColor};border-radius:50%;animation:spin .8s linear infinite;margin-bottom:16px}
@keyframes spin{to{transform:rotate(360deg)}}</style></head>
<body><div class="loading" id="loading"><div class="spinner"></div><p>Loading payment...</p></div>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>var rzp=new Razorpay({key:'${options.key}',amount:'${options.amount}',currency:'${options.currency||'INR'}',name:'${options.name}',description:'${options.description}',order_id:'${options.order_id}',prefill:{name:'${options.prefillName||''}',email:'${options.prefillEmail||''}',contact:'${options.prefillContact||''}'},theme:{color:'${options.themeColor}'},modal:{ondismiss:function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'DISMISS'}))},escape:false,animation:true},handler:function(r){window.ReactNativeWebView.postMessage(JSON.stringify({type:'SUCCESS',data:{razorpay_payment_id:r.razorpay_payment_id,razorpay_order_id:r.razorpay_order_id,razorpay_signature:r.razorpay_signature}}))}});
rzp.on('payment.failed',function(r){window.ReactNativeWebView.postMessage(JSON.stringify({type:'FAILED',data:{error:{code:r.error.code,description:r.error.description,reason:r.error.reason||''}}}))});
document.getElementById('loading').style.display='none';rzp.open();</script></body></html>`;

const RazorpayCheckout = ({ visible, onClose, onSuccess, onFailure, checkoutOptions = {} }) => {
  const [loading, setLoading] = useState(true);
  const { order_id='', amount=0, currency='INR', name='AaplaKart', description='',
    prefillName='', prefillEmail='', prefillContact='', themeColor='#f97316' } = checkoutOptions;

  const html = getCheckoutHtml({
    key: RAZORPAY_KEY_ID, order_id, amount, currency, name, description,
    prefillName, prefillEmail, prefillContact, themeColor,
  });

  const handleMessage = (e) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'SUCCESS') { onSuccess?.(msg.data); }
      else if (msg.type === 'FAILED') { onFailure?.(msg.data.error); }
      else if (msg.type === 'DISMISS') { onClose?.(); }
    } catch {}
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Secure Payment</Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={24} color={COLORS.text} /></Pressable>
        </View>
        {loading && <ActivityIndicator style={styles.loader} color={COLORS.primary} size="large" />}
        <WebView source={{ html }} style={styles.webview} onMessage={handleMessage} onLoadEnd={() => setLoading(false)} />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', marginTop: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#fde6cf' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  loader: { marginTop: 40 },
  webview: { flex: 1 },
});

export default RazorpayCheckout;
