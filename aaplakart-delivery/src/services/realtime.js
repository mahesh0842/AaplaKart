import { useDeliveryStore } from '../store/deliveryStore';

export function startPolling(intervalMs = 5000) {
  // Poll backend every 5 seconds for real orders
  const interval = setInterval(() => {
    useDeliveryStore.getState().loadOrders();
  }, intervalMs);
  return () => clearInterval(interval);
}
