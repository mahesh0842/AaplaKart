// GUI category: Services. Local push notifications for order status updates.
// Uses expo-notifications to show alerts when order status changes.
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure notification behavior (show while app is foregrounded)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldVibrate: true,
  }),
});

let channelCreated = false;

async function ensureChannel() {
  if (channelCreated) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('order-updates', {
      name: 'Order Updates',
      description: 'Notifications about your order status',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#f97316',
      enableVibrate: true,
    });
  }
  channelCreated = true;
}

/**
 * Request notification permissions. Call once on app boot.
 */
export async function requestPermissions() {
  if (!Device.isDevice) {
    console.log('[Notifications] Not a physical device — skipping');
    return false;
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission denied');
    return false;
  }
  await ensureChannel();
  return true;
}

/**
 * Show a local notification for order status change.
 * @param {object} order — { id, status, total, ... }
 * @param {string} newStatus — new status label
 */
export async function notifyOrderStatus(order, newStatus) {
  await ensureChannel();

  const statusLabels = {
    pending: 'Order Placed',
    confirmed: 'Order Confirmed',
    preparing: 'Preparing Your Order',
    'out-for-delivery': 'Out for Delivery',
    delivered: 'Order Delivered',
    cancelled: 'Order Cancelled',
  };

  const statusIcons = {
    pending: '📄',
    confirmed: '✅',
    preparing: '🔥',
    'out-for-delivery': '🚲',
    delivered: '🎉',
    cancelled: '❌',
  };

  const label = statusLabels[newStatus] || newStatus;
  const icon = statusIcons[newStatus] || '📦';
  const body = newStatus === 'delivered'
    ? `Your order #${(order.id || '').slice(-6)} has been delivered. Enjoy!`
    : newStatus === 'out-for-delivery'
    ? `Your order is on its way! Total: ₹${order.total || 0}`
    : newStatus === 'confirmed'
    ? `Your order has been confirmed. We're preparing it now.`
    : newStatus === 'preparing'
    ? `Fresh items being packed for your order #${(order.id || '').slice(-6)}`
    : `Order #${(order.id || '').slice(-6)} status: ${label}`;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${icon} ${label}`,
        body,
        sound: 'default',
        badge: 1,
        data: { orderId: order.id, status: newStatus },
        color: '#f97316',
      },
      trigger: null, // immediate
    });
  } catch (e) {
    console.log('[Notifications] Failed to show:', e?.message);
  }
}

/**
 * Listen for notification taps (user opens app from notification).
 * @param {function} onPress — callback with notification data
 */
export function onNotificationTap(onPress) {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    onPress?.(data);
  });
  return () => subscription.remove();
}
