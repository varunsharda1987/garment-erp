import api from '@/lib/api';

/**
 * Extract filename from Content-Disposition header
 */
function extractFilename(contentDisposition: string | null | undefined): string | null {
  if (!contentDisposition) return null;
  const match = contentDisposition.match(/filename="?([^";\n]+)"?/i);
  return match ? match[1] : null;
}

/**
 * Open a PDF in a new browser tab (with auth).
 * Creates a File object with the server's filename so "Save As" uses the correct name.
 */
export async function openPDF(endpoint: string): Promise<void> {
  const response = await api.get(endpoint, { responseType: 'blob' });
  const contentDisposition = response.headers['content-disposition'];
  const filename = extractFilename(contentDisposition) || 'document.pdf';

  // Create a File object with the proper name (instead of raw Blob)
  const file = new File([response.data], filename, { type: 'application/pdf' });
  const url = window.URL.createObjectURL(file);
  window.open(url, '_blank');
  setTimeout(() => window.URL.revokeObjectURL(url), 60000);
}

/**
 * Open a file that lives under /uploads and is served behind an auth check (today: buyer PO
 * documents). Everything else under /uploads is public and can just be linked.
 *
 * Three things here are deliberate and easy to get wrong:
 *
 *  1. Pass the ROOT-RELATIVE path (`/uploads/...`), NOT getUploadUrl()'s absolute one. Absolute
 *     means cross-origin to the API, and an Authorization header makes the request CORS-preflighted
 *     — which fails, because the API's CORS whitelist holds the Vite dev ports, not the web
 *     server's. The web server proxies `/uploads` so a relative path is same-origin and no
 *     preflight happens at all. `baseURL` is `…/api`, so the leading slash is what keeps this off
 *     the API prefix.
 *  2. The blob's own type is used, not a hardcoded application/pdf: a PO is often a phone photo.
 *  3. `targetWindow` is opened SYNCHRONOUSLY by the caller, inside the click handler. Opening it
 *     here, after the await, loses the user-gesture and popup blockers eat the tab.
 *
 * The `?token=` query param the server also accepts is deliberately NOT used — it would put a
 * full-privilege JWT into the URL bar, browser history, the access log, and any link someone
 * copies out of the address bar.
 */
export async function openUploadedFile(
  relativeUrl: string,
  fallbackName = 'document',
  targetWindow?: Window | null
): Promise<void> {
  try {
    // baseURL is `…/api`; an absolute-path URL bypasses it and hits the web server's /uploads proxy.
    const response = await api.get(relativeUrl, { responseType: 'blob', baseURL: '' });
    const type = response.data?.type || 'application/octet-stream';
    const file = new File([response.data], fallbackName, { type });
    const url = window.URL.createObjectURL(file);

    if (targetWindow && !targetWindow.closed) {
      targetWindow.location.href = url;
    } else {
      window.open(url, '_blank');
    }
    setTimeout(() => window.URL.revokeObjectURL(url), 60000);
  } catch (error) {
    // The pre-opened tab would otherwise sit blank forever with no explanation.
    if (targetWindow && !targetWindow.closed) targetWindow.close();
    throw error;
  }
}

/**
 * Download a file (with auth)
 */
export async function downloadFile(endpoint: string, filename: string): Promise<void> {
  const response = await api.get(endpoint, { responseType: 'blob' });
  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
