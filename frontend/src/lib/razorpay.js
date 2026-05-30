/**
 * Reusable Razorpay Checkout launcher.
 * Calls /api/razorpay/order to create the server-verified order,
 * loads Razorpay's Checkout JS dynamically (CDN),
 * then verifies the signature via /api/razorpay/verify.
 *
 * Usage:
 *   const { launchCheckout, ready, configured } = useRazorpayCheckout();
 *   await launchCheckout({ kind:'portal', plan_id, doctor_id, onSuccess, onFailure })
 */
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptPromise = null;
function loadRazorpayScript() {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export function useRazorpayCheckout() {
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState({ enabled: false, key_id: '', mode: 'test', currency: 'INR' });

  useEffect(() => {
    let alive = true;
    axios.get(`${API}/razorpay/config`).then(r => {
      if (alive) setConfig(r.data || {});
    }).catch(() => {});
    loadRazorpayScript().then((ok) => { if (alive) setReady(ok); });
    return () => { alive = false; };
  }, []);

  const launchCheckout = useCallback(async ({ kind, plan_id, doctor_id, prefill, onSuccess, onFailure }) => {
    try {
      const okScript = await loadRazorpayScript();
      if (!okScript || !window.Razorpay) {
        onFailure?.({ message: 'Razorpay script failed to load' });
        return;
      }
      // Create order on backend
      const orderRes = await axios.post(`${API}/razorpay/order`, { kind, plan_id, doctor_id }, { withCredentials: true });
      const { order_id, amount, currency, key_id, plan_name, user } = orderRes.data;

      const options = {
        key: key_id,
        amount,
        currency,
        order_id,
        name: 'IFEELINCOLOR',
        description: plan_name || 'Subscription',
        prefill: prefill || { name: user?.name, email: user?.email, contact: user?.contact },
        theme: { color: '#FF4FBF' },
        handler: async (response) => {
          try {
            const verifyRes = await axios.post(`${API}/razorpay/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }, { withCredentials: true });
            onSuccess?.(verifyRes.data);
          } catch (e) {
            onFailure?.({ message: e.response?.data?.detail || 'Payment verification failed' });
          }
        },
        modal: {
          ondismiss: () => onFailure?.({ message: 'Checkout closed', dismissed: true }),
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.on?.('payment.failed', (resp) => onFailure?.({ message: resp?.error?.description || 'Payment failed' }));
      rzp.open();
    } catch (e) {
      onFailure?.({ message: e.response?.data?.detail || e.message || 'Checkout error' });
    }
  }, []);

  return { ready, configured: !!(config.enabled && config.key_id), config, launchCheckout };
}
