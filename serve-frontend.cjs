// serve-frontend.cjs — tiny Express static server for the Vite dist build
// PM2 calls this directly; it serves dist/ on FRONTEND_PORT (default 3001).
'use strict';
const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.FRONTEND_PORT || 3001);
const DIST = path.join(__dirname, 'dist');

// Serve static assets with long-lived cache headers
app.use(express.static(DIST, { maxAge: '1y', index: false }));

// SPA fallback — send index.html for all non-asset routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Frontend] running on http://0.0.0.0:${PORT}`);
});
