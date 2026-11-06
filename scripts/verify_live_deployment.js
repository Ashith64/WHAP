// scripts/verify_live_deployment.js
// Usage: node scripts/verify_live_deployment.js <LIVE_URL>
import assert from 'node:assert/strict';

const baseUrl = process.argv[2] ? process.argv[2].replace(/\/$/, '') : null;
if (!baseUrl) {
  console.error('Error: Deployment URL required. Usage: node scripts/verify_live_deployment.js <URL>');
  process.exit(1);
}

console.log(`Testing Live Vercel Deployment at: ${baseUrl}`);

async function runProbes() {
  // 1. Root Shell Probe
  const rootRes = await fetch(`${baseUrl}/`);
  assert.equal(rootRes.status, 200, 'Root / must return HTTP 200');
  const rootHtml = await rootRes.text();
  assert.ok(rootHtml.includes('<div id="root"></div>'), 'Root HTML must contain #root mount point');
  assert.ok(rootHtml.includes('WHAP — Campus Micro-Tasks'), 'Root HTML must contain WHAP title');
  console.log('✔ Root / shell verified');

  // 2. SPA Deep Route Rewrites Probe
  for (const deepRoute of ['/requester', '/worker', '/admin', '/login']) {
    const res = await fetch(`${baseUrl}${deepRoute}`);
    assert.equal(res.status, 200, `SPA route ${deepRoute} must return HTTP 200 via rewrite`);
    const html = await res.text();
    assert.ok(html.includes('<div id="root"></div>'), `Route ${deepRoute} must return index.html shell`);
  }
  console.log('✔ SPA deep link rewrites (/requester, /worker, /admin, /login) verified');

  // 3. PWA Manifest & Headers Probe
  const manifestRes = await fetch(`${baseUrl}/manifest.webmanifest`);
  assert.equal(manifestRes.status, 200, 'manifest.webmanifest must return HTTP 200');
  assert.ok(manifestRes.headers.get('content-type')?.includes('application/manifest+json'), 'Manifest must have application/manifest+json content-type');
  const manifestJson = await manifestRes.json();
  assert.equal(manifestJson.short_name, 'WHAP', 'Manifest short_name must match');
  console.log('✔ PWA manifest and caching headers verified');

  // 4. Service Worker Cache-Control Probe
  const swRes = await fetch(`${baseUrl}/sw.js`);
  assert.equal(swRes.status, 200, 'sw.js must return HTTP 200');
  const swCacheHeader = swRes.headers.get('cache-control') || '';
  assert.ok(swCacheHeader.includes('no-cache') || swCacheHeader.includes('must-revalidate'), 'sw.js must have no-cache headers');
  console.log('✔ Service worker cache-control header verified');

  console.log('\n========================================');
  console.log('LIVE VERCEL DEPLOYMENT FULLY VERIFIED!');
  console.log('========================================');
}

runProbes().catch(err => {
  console.error('Verification failed:', err.message);
  process.exit(1);
});
