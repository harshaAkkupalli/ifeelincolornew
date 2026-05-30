/**
 * Platform helpers — keeps the rest of the UI free of feature-detect noise.
 *
 * The app ships in three modes:
 *   1. Browser (Chrome/Safari/Firefox) — full Web APIs.
 *   2. PWA installed from the browser — full Web APIs.
 *   3. **APK wrapper** (Median.co / WebViewGold / Capacitor / TWA) — Android
 *      System WebView. WebViews silently block `<a download>` triggers and
 *      most don't expose `navigator.credentials` (WebAuthn). We detect the
 *      WebView and switch to APK-friendly fallbacks.
 */

/** True when the current page is loaded inside an Android WebView wrapper. */
export const isAndroidWebView = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /Android/i.test(ua)
    && (
      /; wv\)/.test(ua)
      || !!window.AndroidInterface
      || !!window.median             // Median.co
      || !!window.WTN                // WebToNative
      || !!window.webtonative        // WebToNative (older builds)
      || !!window.JSBridge           // WebViewGold / generic
      || !!window.Capacitor          // Capacitor
    )
  );
};

/** WebToNative bridge object — set on the window by the wrapper at runtime. */
const getWtnBridge = () => {
  if (typeof window === 'undefined') return null;
  return window.WTN || window.webtonative || null;
};

/** True when the browser has *any* form of WebAuthn API. */
export const supportsWebAuthn = () => (
  typeof window !== 'undefined' && !!window.PublicKeyCredential
);

/**
 * Downloads a binary file regardless of context.
 *
 * - In a normal browser: triggers a hidden `<a download>` (instant save).
 * - In an Android WebView APK: opens the blob URL in a NEW window so the
 *   wrapper's `setDownloadListener` (Median.co) or the system PDF viewer
 *   takes over.
 */
export const downloadBlob = (blob, filename) => {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  try {
    if (isAndroidWebView()) {
      // Android WebViews drop <a download>. Opening the blob URL invokes
      // the wrapper's external-link / download interceptor.
      window.open(url, '_blank');
      // Keep the URL alive long enough for the wrapper to fetch it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    if (!isAndroidWebView()) {
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
  }
};

/**
 * Server-rendered PDF download — works in 100% of APK wrappers.
 *
 * In a regular browser: fetches the PDF as a blob (so we don't navigate
 * away from the page) and triggers a hidden `<a download>` save.
 *
 * In an Android WebView APK (Median.co / WebViewGold): we DON'T fetch via
 * blob. Median.co intercepts HTTP responses whose `Content-Disposition`
 * header is `attachment` and hands them to the Android DownloadManager.
 * The simplest, most-reliable trigger is to load the URL in a new window
 * (which Median maps to an `intent://` style download). We pass the cookie
 * automatically because the WebView shares cookies with the page.
 */
export const downloadServerPdf = async (apiPath, filename) => {
  const apiUrl = `${process.env.REACT_APP_BACKEND_URL}${apiPath}`;
  if (isAndroidWebView()) {
    // Append a hint param Median's download interceptor honours, plus a cache-buster.
    const sep = apiUrl.includes('?') ? '&' : '?';
    const target = `${apiUrl}${sep}download=1&t=${Date.now()}`;
    try {
      // window.open is what Median.co's native download bridge intercepts.
      const w = window.open(target, '_blank');
      // Some wrappers block window.open silently — fall back to same-tab nav.
      if (!w) window.location.href = target;
    } catch {
      window.location.href = target;
    }
    return;
  }
  // Regular browser path — fetch + a[download]
  const r = await fetch(apiUrl, { credentials: 'include' });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`PDF download failed (${r.status}). ${txt.slice(0, 200)}`);
  }
  const blob = await r.blob();
  downloadBlob(blob, filename);
  return blob;
};
