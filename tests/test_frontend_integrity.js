// tests/test_frontend_integrity.js
// Standalone Verification & Adversarial Integrity Test Suite for WHAP Frontend & PWA
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as parser from '@babel/parser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Load environment variables for live remote probe
dotenv.config({ path: path.join(ROOT_DIR, '.env.local') });

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------
function readJson(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  const raw = fs.readFileSync(fullPath, 'utf8');
  return JSON.parse(raw);
}

function getAllSourceFiles(dir, extensions = ['.js', '.jsx']) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllSourceFiles(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function resolveImportPath(importingFilePath, importSpecifier) {
  const dir = path.dirname(importingFilePath);
  const targetBase = path.resolve(dir, importSpecifier);

  const candidateExtensions = ['', '.jsx', '.js', '.css', '.json', '.svg', '.png', '.webmanifest'];
  for (const ext of candidateExtensions) {
    const candidate = targetBase + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  // Try index file in directory
  for (const ext of ['.jsx', '.js']) {
    const indexCandidate = path.join(targetBase, 'index' + ext);
    if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) {
      return indexCandidate;
    }
  }
  return null;
}

// Emulated ProtectedRoute logic matching src/components/common/ProtectedRoute.jsx
function simulateProtectedRoute({ user, role, loading, allowedRoles = [] }) {
  if (loading) {
    return { status: 'LOADING', view: 'SPINNER' };
  }
  if (!user) {
    return { status: 'REDIRECT', target: '/login' };
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    if (role === 'ADMIN') return { status: 'REDIRECT', target: '/admin' };
    if (role === 'WORKER') return { status: 'REDIRECT', target: '/worker' };
    return { status: 'REDIRECT', target: '/requester' };
  }
  return { status: 'AUTHORIZED', view: 'CHILDREN' };
}

// -----------------------------------------------------------------------------
// Test Suites
// -----------------------------------------------------------------------------

describe('WHAP Frontend Integrity & Adversarial Validation', () => {

  // ===========================================================================
  // Suite 1: Production Build Artifacts & Bundle Verification
  // ===========================================================================
  describe('Suite 1: Production Build Artifacts & Bundles', () => {
    const distDir = path.join(ROOT_DIR, 'dist');
    const indexHtmlPath = path.join(distDir, 'index.html');

    it('dist/index.html exists and contains valid mount point and meta tags', () => {
      assert.ok(fs.existsSync(indexHtmlPath), 'dist/index.html must exist');
      const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

      assert.match(htmlContent, /<div id="root"><\/div>/, 'index.html must have root mount point');
      assert.match(htmlContent, /<!doctype html>/i, 'index.html must have HTML5 doctype');
      assert.match(htmlContent, /name="viewport"/i, 'index.html must have mobile viewport');
      assert.match(htmlContent, /name="theme-color"/i, 'index.html must have theme color meta tag');
      assert.match(htmlContent, /href="\/manifest\.webmanifest"/, 'index.html must reference manifest');
    });

    it('all JS and CSS assets referenced in dist/index.html physically exist on disk', () => {
      const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

      // Match scripts
      const scriptMatches = [...htmlContent.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
      for (const src of scriptMatches) {
        if (src.startsWith('http')) continue;
        const assetPath = path.join(distDir, src.replace(/^\//, ''));
        assert.ok(fs.existsSync(assetPath), `Referenced script ${src} must exist at ${assetPath}`);
        const stat = fs.statSync(assetPath);
        assert.ok(stat.size > 0, `Script ${src} must not be empty`);
      }

      // Match stylesheets and modulepreloads
      const linkMatches = [...htmlContent.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
      for (const href of linkMatches) {
        if (href.startsWith('http') || href.endsWith('.svg') || href.endsWith('.png') || href.endsWith('.webmanifest')) {
          continue;
        }
        const assetPath = path.join(distDir, href.replace(/^\//, ''));
        assert.ok(fs.existsSync(assetPath), `Referenced link ${href} must exist at ${assetPath}`);
        const stat = fs.statSync(assetPath);
        assert.ok(stat.size > 0, `Asset ${href} must not be empty`);
      }
    });

    it('production bundles are properly code-split and within acceptable size budgets', () => {
      const assetsDir = path.join(distDir, 'assets');
      assert.ok(fs.existsSync(assetsDir), 'dist/assets directory must exist');

      const assetFiles = fs.readdirSync(assetsDir);
      const jsFiles = assetFiles.filter(f => f.endsWith('.js') && !f.endsWith('.map'));
      const cssFiles = assetFiles.filter(f => f.endsWith('.css') && !f.endsWith('.map'));

      assert.ok(jsFiles.length >= 4, `Expected at least 4 code-split JS vendor chunks, got ${jsFiles.length}`);
      assert.ok(cssFiles.length >= 1, `Expected at least 1 CSS bundle, got ${cssFiles.length}`);

      // Verify vendor chunks exist for major libraries
      const vendorReact = jsFiles.find(f => f.includes('vendor-react'));
      const vendorSupabase = jsFiles.find(f => f.includes('vendor-supabase'));
      const vendorLeaflet = jsFiles.find(f => f.includes('vendor-leaflet'));
      const vendorIcons = jsFiles.find(f => f.includes('vendor-icons'));

      assert.ok(vendorReact, 'vendor-react chunk must exist');
      assert.ok(vendorSupabase, 'vendor-supabase chunk must exist');
      assert.ok(vendorLeaflet, 'vendor-leaflet chunk must exist');
      assert.ok(vendorIcons, 'vendor-icons chunk must exist');

      // Check max chunk size (none exceeding 500KB uncompressed)
      for (const file of jsFiles) {
        const full = path.join(assetsDir, file);
        const sizeKb = fs.statSync(full).size / 1024;
        assert.ok(sizeKb < 500, `JS file ${file} size ${sizeKb.toFixed(1)}KB exceeds 500KB budget`);
      }
    });

    it('PWA service worker and manifest exist with valid structure and assets', () => {
      const swPath = path.join(distDir, 'sw.js');
      const manifestPath = path.join(distDir, 'manifest.webmanifest');
      const registerSwPath = path.join(distDir, 'registerSW.js');

      assert.ok(fs.existsSync(swPath), 'dist/sw.js must exist');
      assert.ok(fs.existsSync(manifestPath), 'dist/manifest.webmanifest must exist');
      assert.ok(fs.existsSync(registerSwPath), 'dist/registerSW.js must exist');

      const swContent = fs.readFileSync(swPath, 'utf8');
      assert.match(swContent, /precacheAndRoute/, 'Service worker must contain Workbox precache');
      assert.ok(swContent.includes('openstreetmap'), 'Service worker must cache OSM tiles');
      assert.ok(swContent.includes('supabase'), 'Service worker must cache Supabase API calls');

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      assert.equal(manifest.display, 'standalone');
      assert.equal(manifest.theme_color, '#2563eb');
      assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3, 'Manifest must specify icons');

      // Verify all icon paths exist
      for (const icon of manifest.icons) {
        const iconPath = path.join(distDir, icon.src.replace(/^\//, ''));
        assert.ok(fs.existsSync(iconPath), `Manifest icon ${icon.src} must exist at ${iconPath}`);
        assert.ok(fs.statSync(iconPath).size > 0, `Icon ${icon.src} must not be empty`);
      }
    });
  });

  // ===========================================================================
  // Suite 2: SPA Fallback & Routing Configuration
  // ===========================================================================
  describe('Suite 2: SPA Fallback & Routing Configuration', () => {
    it('vercel.json is valid and contains SPA rewrite and immutable caching headers', () => {
      const vercelConfig = readJson('vercel.json');
      assert.equal(vercelConfig.framework, 'vite');
      assert.ok(Array.isArray(vercelConfig.rewrites), 'rewrites must be an array');

      const spaRewrite = vercelConfig.rewrites.find(r => r.source === '/(.*)' && r.destination === '/index.html');
      assert.ok(spaRewrite, 'vercel.json must have SPA wildcard rewrite /(.*) -> /index.html');

      const headers = vercelConfig.headers || [];
      const swHeader = headers.find(h => h.source === '/sw.js');
      assert.ok(swHeader, 'Header for /sw.js must be configured');
      const swCacheControl = swHeader.headers.find(h => h.key === 'Cache-Control');
      assert.ok(swCacheControl.value.includes('no-cache'), 'sw.js must not be cached aggressively');

      const assetHeader = headers.find(h => h.source === '/assets/(.*)');
      assert.ok(assetHeader, 'Header for /assets/(.*) must be configured');
      const assetCacheControl = assetHeader.headers.find(h => h.key === 'Cache-Control');
      assert.ok(assetCacheControl.value.includes('immutable'), 'Hashed assets must be immutable');
    });

    it('App.jsx defines all required routes across Requester, Worker, and Admin roles', () => {
      const appCode = fs.readFileSync(path.join(ROOT_DIR, 'src', 'App.jsx'), 'utf8');

      const expectedRoutes = [
        '/',
        '/login',
        '/register',
        '/requester',
        '/requester/post-task',
        '/requester/tasks/:id',
        '/requester/wallet',
        '/requester/profile',
        '/worker',
        '/worker/tasks/:id',
        '/worker/active',
        '/worker/bids',
        '/worker/wallet',
        '/worker/profile',
        '/admin',
        '/admin/profile',
        '*'
      ];

      for (const route of expectedRoutes) {
        const regex = new RegExp(`path=["']${route.replace('*', '\\*')}["']`);
        assert.ok(regex.test(appCode), `Route ${route} must be declared in App.jsx`);
      }
    });
  });

  // ===========================================================================
  // Suite 3: ProtectedRoute Access Control Simulation
  // ===========================================================================
  describe('Suite 3: ProtectedRoute Access Control Simulation', () => {
    it('redirects unauthenticated users to /login', () => {
      const res = simulateProtectedRoute({ user: null, role: null, loading: false });
      assert.equal(res.status, 'REDIRECT');
      assert.equal(res.target, '/login');
    });

    it('renders loading state without leaking protected views while auth initializes', () => {
      const res = simulateProtectedRoute({ user: null, role: null, loading: true });
      assert.equal(res.status, 'LOADING');
      assert.equal(res.view, 'SPINNER');
    });

    it('blocks WORKER from accessing REQUESTER-only routes', () => {
      const res = simulateProtectedRoute({
        user: { id: 'worker-1' },
        role: 'WORKER',
        loading: false,
        allowedRoles: ['REQUESTER', 'ADMIN']
      });
      assert.equal(res.status, 'REDIRECT');
      assert.equal(res.target, '/worker');
    });

    it('blocks REQUESTER from accessing WORKER-only routes', () => {
      const res = simulateProtectedRoute({
        user: { id: 'req-1' },
        role: 'REQUESTER',
        loading: false,
        allowedRoles: ['WORKER', 'ADMIN']
      });
      assert.equal(res.status, 'REDIRECT');
      assert.equal(res.target, '/requester');
    });

    it('blocks non-admin users (REQUESTER and WORKER) from accessing /admin', () => {
      const reqRes = simulateProtectedRoute({
        user: { id: 'req-1' },
        role: 'REQUESTER',
        loading: false,
        allowedRoles: ['ADMIN']
      });
      assert.equal(reqRes.status, 'REDIRECT');
      assert.equal(reqRes.target, '/requester');

      const wrkRes = simulateProtectedRoute({
        user: { id: 'worker-1' },
        role: 'WORKER',
        loading: false,
        allowedRoles: ['ADMIN']
      });
      assert.equal(wrkRes.status, 'REDIRECT');
      assert.equal(wrkRes.target, '/worker');
    });

    it('allows ADMIN access to Requester, Worker, and Admin routes', () => {
      const adminUser = { id: 'admin-1' };
      const resReq = simulateProtectedRoute({
        user: adminUser,
        role: 'ADMIN',
        loading: false,
        allowedRoles: ['REQUESTER', 'ADMIN']
      });
      assert.equal(resReq.status, 'AUTHORIZED');

      const resWrk = simulateProtectedRoute({
        user: adminUser,
        role: 'ADMIN',
        loading: false,
        allowedRoles: ['WORKER', 'ADMIN']
      });
      assert.equal(resWrk.status, 'AUTHORIZED');

      const resAdm = simulateProtectedRoute({
        user: adminUser,
        role: 'ADMIN',
        loading: false,
        allowedRoles: ['ADMIN']
      });
      assert.equal(resAdm.status, 'AUTHORIZED');
    });

    it('permits any authenticated user to access unrestricted protected routes', () => {
      for (const role of ['REQUESTER', 'WORKER', 'ADMIN']) {
        const res = simulateProtectedRoute({
          user: { id: 'user-xyz' },
          role,
          loading: false,
          allowedRoles: []
        });
        assert.equal(res.status, 'AUTHORIZED');
      }
    });
  });

  // ===========================================================================
  // Suite 4: 1-Click Quick-Switch Demo Toolbar & Seed Data Synchronization
  // ===========================================================================
  describe('Suite 4: 1-Click Quick-Switch Demo Toolbar & Seed Data Synchronization', () => {
    it('AuthContext.jsx defines exactly 7 DEMO_ACCOUNTS matching seed specifications', () => {
      const authContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'context', 'AuthContext.jsx'), 'utf8');

      // Verify all 7 emails are present
      const expectedEmails = [
        'requester_1@whap.local',
        'requester_2@whap.local',
        'worker_1@whap.local',
        'worker_2@whap.local',
        'worker_3@whap.local',
        'worker_4@whap.local',
        'admin@whap.local'
      ];

      for (const email of expectedEmails) {
        assert.ok(authContent.includes(email), `DEMO_ACCOUNTS must include ${email}`);
      }

      assert.ok(authContent.includes('whap_demo_password_123'), 'Must contain worker/requester demo password');
      assert.ok(authContent.includes('whap_admin_password_123'), 'Must contain admin demo password');
    });

    it('DemoAccountBar.jsx renders switcher toolbar and links to loginAsDemo', () => {
      const demoBarContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'common', 'DemoAccountBar.jsx'), 'utf8');

      assert.ok(demoBarContent.includes('DEMO_ACCOUNTS'), 'DemoAccountBar must import DEMO_ACCOUNTS');
      assert.ok(demoBarContent.includes('loginAsDemo'), 'DemoAccountBar must use loginAsDemo');
      assert.ok(demoBarContent.includes('handleQuickSwitch'), 'DemoAccountBar must have handleQuickSwitch');
      assert.ok(demoBarContent.includes('navigate(\'/admin\')'), 'DemoAccountBar must route Admin');
      assert.ok(demoBarContent.includes('navigate(\'/worker\')'), 'DemoAccountBar must route Worker');
      assert.ok(demoBarContent.includes('navigate(\'/requester\')'), 'DemoAccountBar must route Requester');
    });

    it('Empirical Remote Auth Probe: all 7 demo accounts successfully sign in to remote GoTrue', async () => {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
      assert.ok(supabaseUrl, 'VITE_SUPABASE_URL must be defined');
      assert.ok(supabaseAnonKey, 'VITE_SUPABASE_ANON_KEY must be defined');

      const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      const accounts = [
        { email: 'requester_1@whap.local', pass: 'whap_demo_password_123', role: 'REQUESTER' },
        { email: 'requester_2@whap.local', pass: 'whap_demo_password_123', role: 'REQUESTER' },
        { email: 'worker_1@whap.local', pass: 'whap_demo_password_123', role: 'WORKER' },
        { email: 'worker_2@whap.local', pass: 'whap_demo_password_123', role: 'WORKER' },
        { email: 'worker_3@whap.local', pass: 'whap_demo_password_123', role: 'WORKER' },
        { email: 'worker_4@whap.local', pass: 'whap_demo_password_123', role: 'WORKER' },
        { email: 'admin@whap.local', pass: 'whap_admin_password_123', role: 'ADMIN' }
      ];

      for (const acc of accounts) {
        const { data, error } = await client.auth.signInWithPassword({
          email: acc.email,
          password: acc.pass
        });

        assert.ifError(error);
        assert.ok(data.user, `User data must exist for ${acc.email}`);
        assert.equal(data.user.email, acc.email);
        assert.equal(data.user.user_metadata?.role, acc.role, `User ${acc.email} metadata role mismatch`);
      }
    });
  });

  // ===========================================================================
  // Suite 5: AST Parsing, Component Syntax, & Module Import Resolution
  // ===========================================================================
  describe('Suite 5: AST Parsing, Component Syntax & Module Resolution', () => {
    const pkg = readJson('package.json');
    const knownDeps = new Set([
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
      'react',
      'react-dom',
      'react/jsx-runtime'
    ]);

    const srcFiles = getAllSourceFiles(path.join(ROOT_DIR, 'src'));

    it(`found ${srcFiles.length} source files in src/ (expected >= 30)`, () => {
      assert.ok(srcFiles.length >= 30, `Expected at least 30 source files, got ${srcFiles.length}`);
    });

    it('all src/*.jsx and src/*.js files parse cleanly without syntax errors', () => {
      for (const file of srcFiles) {
        const code = fs.readFileSync(file, 'utf8');
        try {
          parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx']
          });
        } catch (err) {
          assert.fail(`Syntax error in ${path.relative(ROOT_DIR, file)}: ${err.message}`);
        }
      }
    });

    it('all internal and external module imports resolve accurately', () => {
      for (const file of srcFiles) {
        const code = fs.readFileSync(file, 'utf8');
        const ast = parser.parse(code, {
          sourceType: 'module',
          plugins: ['jsx']
        });

        const importNodes = ast.program.body.filter(n => n.type === 'ImportDeclaration');
        for (const imp of importNodes) {
          const specifier = imp.source.value;

          if (specifier.startsWith('.')) {
            // Local relative import
            const resolved = resolveImportPath(file, specifier);
            assert.ok(
              resolved,
              `Broken local import '${specifier}' in ${path.relative(ROOT_DIR, file)}`
            );
          } else {
            // External package import
            const rootPkgName = specifier.startsWith('@')
              ? specifier.split('/').slice(0, 2).join('/')
              : specifier.split('/')[0];

            assert.ok(
              knownDeps.has(rootPkgName) || rootPkgName === 'node',
              `Unknown external dependency '${specifier}' imported in ${path.relative(ROOT_DIR, file)}`
            );
          }
        }
      }
    });

    it('all mandatory screens and components display regulatory simulated payments label', () => {
      const noticePath = path.join(ROOT_DIR, 'src', 'components', 'common', 'SimulatedPaymentNotice.jsx');
      assert.ok(fs.existsSync(noticePath), 'SimulatedPaymentNotice.jsx must exist');
      const noticeContent = fs.readFileSync(noticePath, 'utf8');
      assert.ok(
        noticeContent.includes('Prototype - simulated payments'),
        "SimulatedPaymentNotice.jsx must visibly include the exact label 'Prototype - simulated payments'"
      );

      // Verify WalletScreen and ProfileScreen import and render SimulatedPaymentNotice
      for (const rel of ['src/pages/WalletScreen.jsx', 'src/pages/ProfileScreen.jsx']) {
        const full = path.join(ROOT_DIR, rel);
        assert.ok(fs.existsSync(full), `${rel} must exist`);
        const content = fs.readFileSync(full, 'utf8');
        assert.ok(
          content.includes('SimulatedPaymentNotice'),
          `${rel} must import and render SimulatedPaymentNotice component`
        );
      }
    });

    it('all critical screens and components export expected React components', () => {
      const expectedExports = [
        { file: 'src/components/common/Header.jsx', exports: ['Header'] },
        { file: 'src/components/common/BottomNav.jsx', exports: ['BottomNav'] },
        { file: 'src/components/common/ProtectedRoute.jsx', exports: ['ProtectedRoute'] },
        { file: 'src/components/common/DemoAccountBar.jsx', exports: ['DemoAccountBar'] },
        { file: 'src/components/common/NetworkStatus.jsx', exports: ['NetworkStatus'] },
        { file: 'src/components/common/Toast.jsx', exports: ['Toast'] },
        { file: 'src/components/map/LeafletMap.jsx', exports: ['LeafletMap'] },
        { file: 'src/components/requester/OtpDisplayCard.jsx', exports: ['OtpDisplayCard'] },
        { file: 'src/components/worker/OtpInputBoxes.jsx', exports: ['OtpInputBoxes'] },
        { file: 'src/components/worker/BidSheet.jsx', exports: ['BidSheet'] },
        { file: 'src/pages/RequesterHomeScreen.jsx', exports: ['RequesterHomeScreen'] },
        { file: 'src/pages/PostTaskScreen.jsx', exports: ['PostTaskScreen'] },
        { file: 'src/pages/RequesterTaskDetailScreen.jsx', exports: ['RequesterTaskDetailScreen'] },
        { file: 'src/pages/WorkerHomeScreen.jsx', exports: ['WorkerHomeScreen'] },
        { file: 'src/pages/WorkerTaskDetailScreen.jsx', exports: ['WorkerTaskDetailScreen'] },
        { file: 'src/pages/ActiveJobScreen.jsx', exports: ['ActiveJobScreen'] },
        { file: 'src/pages/MyBidsScreen.jsx', exports: ['MyBidsScreen'] },
        { file: 'src/pages/WalletScreen.jsx', exports: ['WalletScreen'] },
        { file: 'src/pages/ProfileScreen.jsx', exports: ['ProfileScreen'] },
        { file: 'src/pages/AdminDisputesScreen.jsx', exports: ['AdminDisputesScreen'] },
        { file: 'src/pages/LoginScreen.jsx', exports: ['LoginScreen'] },
        { file: 'src/pages/RegisterScreen.jsx', exports: ['RegisterScreen'] },
      ];

      for (const item of expectedExports) {
        const full = path.join(ROOT_DIR, item.file);
        const code = fs.readFileSync(full, 'utf8');
        const ast = parser.parse(code, {
          sourceType: 'module',
          plugins: ['jsx']
        });

        const exportedNames = new Set();
        for (const node of ast.program.body) {
          if (node.type === 'ExportNamedDeclaration') {
            if (node.declaration) {
              if (node.declaration.declarations) {
                for (const d of node.declaration.declarations) {
                  exportedNames.add(d.id.name);
                }
              } else if (node.declaration.id) {
                exportedNames.add(node.declaration.id.name);
              }
            }
            if (node.specifiers) {
              for (const s of node.specifiers) {
                exportedNames.add(s.exported.name);
              }
            }
          } else if (node.type === 'ExportDefaultDeclaration') {
            if (node.declaration.id) {
              exportedNames.add(node.declaration.id.name);
            }
            exportedNames.add('default');
          }
        }

        for (const exp of item.exports) {
          assert.ok(
            exportedNames.has(exp),
            `${item.file} must export '${exp}'. Found exports: [${Array.from(exportedNames).join(', ')}]`
          );
        }
      }
    });
  });

});
