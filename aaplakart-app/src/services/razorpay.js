// Razorpay service — backend API calls + helpers.
// Uses WebView for checkout (Expo Go compatible).
import { createRazorpayOrder, verifyRazorpayPayment } from './api';

/**
 * Create a Razorpay order via the backend.
 * @param {number} amountInPaise - Amount in paise (e.g., ₹500 = 50000)
 * @param {string} [receipt] - Optional internal receipt ID
 * @returns {Promise<{razorpay_order_id: string, razorpay_key_id: string, amount: number, currency: string}>}
 */
export async function createOrder(amountInPaise, receipt = null) {
  const result = await createRazorpayOrder({
    amount: amountInPaise,
    currency: 'INR',
    receipt,
  });
  return result;
}

/**
 * Verify a Razorpay payment signature via the backend.
 * @param {object} params
 * @param {string} params.razorpay_order_id
 * @param {string} params.razorpay_payment_id
 * @param {string} params.razorpay_signature
 * @returns {Promise<{verified: boolean, message: string}>}
 */
export async function verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  return verifyRazorpayPayment({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });
}

/**
 * Convert rupees to paise.
 */
export function toPaise(rupees) {
  return Math.round(rupees * 100);
}
