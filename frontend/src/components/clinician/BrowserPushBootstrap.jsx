import React, { useEffect, useRef } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const POLL_MS = 30000;
const STORAGE_KEY = 'clinician_push_last_seen';

/**
 * Lightweight browser-notification bootstrap for clinicians.
 * - Asks for Notification permission on first load (idempotent).
 * - Polls /clinician/notifications-feed every 30s.
 * - Fires Notification() for any feed item newer than the last seen timestamp.
 * No service worker / VAPID required — works in foreground tabs.
 */
export default function BrowserPushBootstrap() {
  const lastSeenRef = useRef(typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) || '' : '');
  const timerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return undefined;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const tick = async () => {
      try {
        const r = await axios.get(`${API}/clinician/notifications-feed`, {
          params: lastSeenRef.current ? { since: lastSeenRef.current } : {},
          withCredentials: true,
        });
        const feed = r.data?.feed || [];
        const newest = feed[0]?.created_at;
        // Notify only items strictly newer than lastSeen.
        const unseen = lastSeenRef.current
          ? feed.filter((f) => (f.created_at || '') > lastSeenRef.current)
          : feed.slice(0, 1); // first run: surface a single sample to confirm flow
        if (Notification.permission === 'granted' && unseen.length > 0) {
          unseen.slice(0, 3).forEach((n) => {
            try {
              const note = new Notification('IFEELINCOLOR · ' + (n.title || 'Update'), {
                body: n.body || '',
                tag: n.id,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
              });
              note.onclick = () => {
                window.focus();
                if (n.url) window.location.href = n.url;
              };
            } catch { /* notification failed silently */ }
          });
        }
        if (newest && newest > (lastSeenRef.current || '')) {
          lastSeenRef.current = newest;
          window.localStorage.setItem(STORAGE_KEY, newest);
        } else if (!lastSeenRef.current) {
          const serverTime = r.data?.server_time || new Date().toISOString();
          lastSeenRef.current = serverTime;
          window.localStorage.setItem(STORAGE_KEY, serverTime);
        }
      } catch { /* network noise — try again later */ }
    };

    tick();
    timerRef.current = window.setInterval(tick, POLL_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  return null;
}
