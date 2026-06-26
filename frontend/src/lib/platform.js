/**
 * Platform helpers — keeps the rest of the UI free of feature-detect noise.
 *
 * The app ships in four modes:
 *   1. Browser (Chrome/Safari/Firefox) — full Web APIs.
 *   2. PWA installed from the browser — full Web APIs.
 *   3. **Capacitor APK** (our official Android build) — Capacitor WebView.
 *      Downloads must be persisted via @capacitor/filesystem because the
 *      WebView blocks `<a download>` AND ignores `window.open(blob:…)`.
 *   4. **Generic WebView wrappers** (Median.co / WebViewGold / WebToNative
 *      / TWA) — supported via their bridge-injected globals.
 */

/** True when running inside the Capacitor APK build. */
export const isCapacitor = () => (
  typeof window !== 'undefined'
  && !!window.Capacitor
  && typeof window.Capacitor.isNativePlatform === 'function'
  && window.Capacitor.isNativePlatform()
);

/** True when the current page is loaded inside an Android WebView wrapper
 *  OTHER than our Capacitor build (Median, WebViewGold, WebToNative, etc).
 *  Capacitor is intentionally excluded so callers can route Capacitor
 *  downloads through @capacitor/filesystem instead of `window.open`. */
export const isAndroidWebView = () => {
  if (typeof navigator === 'undefined') return false;
  if (isCapacitor()) return false;
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
 * - In Capacitor APK: writes the blob to `Documents` via `@capacitor/filesystem`
 *   and opens the system share sheet so the user can save / send the file.
 * - In other Android WebViews (Median/WebViewGold/WTN): opens the blob URL in
 *   a new window so the wrapper's `setDownloadListener` takes over.
 */
export const downloadBlob = async (blob, filename) => {
  if (!blob) return;

  // ── Capacitor APK ─────────────────────────────────────────────────
  if (isCapacitor()) {
    try {
      const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share'),
      ]);
      const safeName = filename || `download-${Date.now()}`;
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onloadend = () => {
          const result = reader.result || '';
          const comma = String(result).indexOf(',');
          resolve(comma >= 0 ? String(result).slice(comma + 1) : String(result));
        };
        reader.readAsDataURL(blob);
      });
      const writeRes = await Filesystem.writeFile({
        path: safeName,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });
      try {
        await Share.share({
          title: safeName,
          url: writeRes.uri,
          dialogTitle: 'Save or open file',
        });
      } catch { /* ignore — file is already saved to Documents */ }
    } catch (e) {
      // If filesystem write fails, fall through to window.open as a last resort.
      try { window.open(URL.createObjectURL(blob), '_blank'); } catch { /* ignore */ }
    }
    return;
  }

  const url = URL.createObjectURL(blob);
  try {
    if (isAndroidWebView()) {
      // Android WebViews drop <a download>. Opening the blob URL invokes
      // the wrapper's external-link / download interceptor.
      window.open(url, '_blank');
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
 * Server-rendered PDF download — works in 100% of contexts:
 *   • Capacitor APK    → fetch + write to Documents via @capacitor/filesystem,
 *                        then open the saved file via @capacitor/share.
 *   • Other WebViews   → window.open(url) — Median.co / WebViewGold
 *                        intercept and hand the URL to Android's
 *                        DownloadManager.
 *   • Browser / PWA    → fetch as blob + <a download>.
 */
export const downloadServerPdf = async (apiPath, filename) => {
  const apiUrl = `${process.env.REACT_APP_BACKEND_URL}${apiPath}`;

  // ── Capacitor APK ─────────────────────────────────────────────────
  if (isCapacitor()) {
    // Dynamic import keeps the plugin out of the web bundle.
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const safeName = filename || `ifeelincolor-dossier-${Date.now()}.pdf`;
    const r = await fetch(apiUrl, { credentials: 'include' });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`PDF download failed (${r.status}). ${txt.slice(0, 200)}`);
    }
    const blob = await r.blob();
    // Convert blob → base64 (Filesystem.writeFile expects a base64 string).
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onloadend = () => {
        const result = reader.result || '';
        const comma = String(result).indexOf(',');
        resolve(comma >= 0 ? String(result).slice(comma + 1) : String(result));
      };
      reader.readAsDataURL(blob);
    });
    const writeRes = await Filesystem.writeFile({
      path: safeName,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });
    // Best-effort: open the system share sheet so the user can save / open
    // / send the PDF. Falls back silently if the device doesn't support it.
    try {
      await Share.share({
        title: 'Your IFEELINCOLOR dossier',
        text: 'Your wellness dossier PDF',
        url: writeRes.uri,
        dialogTitle: 'Save or open your dossier',
      });
    } catch { /* ignore — file is already saved */ }
    return blob;
  }

  // ── Other Android WebView wrappers (Median / WebViewGold / etc.) ──
  if (isAndroidWebView()) {
    const sep = apiUrl.includes('?') ? '&' : '?';
    const target = `${apiUrl}${sep}download=1&t=${Date.now()}`;
    try {
      const w = window.open(target, '_blank');
      if (!w) window.location.href = target;
    } catch {
      window.location.href = target;
    }
    return undefined;
  }

  // ── Regular browser / PWA ─────────────────────────────────────────
  const r = await fetch(apiUrl, { credentials: 'include' });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`PDF download failed (${r.status}). ${txt.slice(0, 200)}`);
  }
  const blob = await r.blob();
  await downloadBlob(blob, filename);
  return blob;
};
