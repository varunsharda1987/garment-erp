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
app.use(express.static(DIST, {
  index: false,
  setHeaders: (res, filePath) => {
    if (/[\\/]assets[\\/]/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
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
