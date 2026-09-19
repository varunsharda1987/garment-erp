// Serves the built frontend (frontend/dist) and proxies /api to the backend.
// Bound to 0.0.0.0 so other PCs on the LAN can reach it.
const path = require('path');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const PORT = parseInt(process.env.PORT || '3000', 10);
const API_TARGET = process.env.API_TARGET || 'http://localhost:5000';
const DIST = path.resolve(__dirname, '../frontend/dist');

const app = express();

// Proxy /api calls to the backend
app.use('/api', createProxyMiddleware({
  target: API_TARGET,
  changeOrigin: true,
}));

// Static assets + SPA fallback to index.html.
//
// `no-cache` does NOT mean "don't cache" — the browser still stores the file and re-uses it, but
// must revalidate with the server first, which answers 304 Not Modified (a few bytes) when nothing
// changed. So the caching benefit is kept and staleness becomes impossible.
//
// It replaces `max-age=31536000, immutable` on /assets, which told browsers to trust a filename for
// a YEAR without ever asking again. That is only safe if a given filename's bytes can never change,
// and Vite does not guarantee that: a chunk's hash can stay the same across builds while its
// minified export aliases change, because those depend on which other chunks import it. On
// 2026-09-19 a cached `radio-group-<hash>.js` kept exporting the old letters while the freshly
// downloaded page chunk imported `R`, and the whole app died on
// "does not provide an export named 'R'" — unrecoverable by normal reloading, because `immutable`
// means the browser never re-asks. Only a hard refresh cleared it.
//
// If asset revalidation ever shows up as a latency problem, the fix is build-unique asset paths
// (a per-build directory), NOT restoring `immutable` on filenames whose contents can shift.
app.use(express.static(DIST, {
  index: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache');
  },
}));

// SPA fallback - all routes serve index.html
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Garment ERP web serving ${DIST} on http://0.0.0.0:${PORT} (API -> ${API_TARGET})`);
});
