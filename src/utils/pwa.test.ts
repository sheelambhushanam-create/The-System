import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isIOSUserAgent,
  isStandaloneDisplay,
  resolveInstallPromptMode,
} from './pwa';

test('PWA install prompt decision hides when already installed in standalone mode', () => {
  assert.deepEqual(
    resolveInstallPromptMode({
      isInstalled: true,
      hasDeferredPrompt: true,
      isIOS: false,
    }),
    { visible: false, mode: 'none' }
  );

  assert.equal(
    isStandaloneDisplay({ matchMediaStandalone: true, navigatorStandalone: false }),
    true
  );
  assert.equal(
    isStandaloneDisplay({ matchMediaStandalone: false, navigatorStandalone: true }),
    true
  );
  assert.equal(
    isStandaloneDisplay({ matchMediaStandalone: false, navigatorStandalone: false }),
    false
  );
});

test('PWA install prompt decision picks native beforeinstallprompt over iOS fallback', () => {
  assert.deepEqual(
    resolveInstallPromptMode({
      isInstalled: false,
      hasDeferredPrompt: true,
      isIOS: true,
    }),
    { visible: true, mode: 'native' }
  );

  assert.deepEqual(
    resolveInstallPromptMode({
      isInstalled: false,
      hasDeferredPrompt: false,
      isIOS: true,
    }),
    { visible: true, mode: 'ios' }
  );

  assert.deepEqual(
    resolveInstallPromptMode({
      isInstalled: false,
      hasDeferredPrompt: false,
      isIOS: false,
    }),
    { visible: false, mode: 'none' }
  );
});

test('iOS user agent detection identifies iPhone/iPad/iPod only', () => {
  assert.equal(isIOSUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), true);
  assert.equal(isIOSUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/124.0'), false);
});

test('public/manifest.json contains all required PWABuilder fields and valid icon/screenshot entries', () => {
  const manifestPath = path.resolve(process.cwd(), 'public/manifest.json');
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(raw) as Record<string, unknown>;

  assert.equal(manifest.id, '/');
  assert.equal(manifest.name, 'The System — Vitality Intelligent Wellness');
  assert.equal(manifest.short_name, 'The System');
  assert.ok(String(manifest.short_name).length <= 12);
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'portrait');
  assert.equal(manifest.background_color, '#070b14');
  assert.equal(manifest.theme_color, '#00e5ff');
  assert.deepEqual(manifest.categories, ['health', 'fitness', 'lifestyle']);

  const icons = manifest.icons as Array<Record<string, string>>;
  assert.ok(Array.isArray(icons));
  assert.ok(
    icons.some(
      (i) => i.src === '/icon-512.svg' && i.sizes === '512x512' && i.type === 'image/svg+xml' && i.purpose === 'any'
    )
  );
  assert.ok(
    icons.some(
      (i) => i.src === '/icon-512.svg' && i.sizes === '512x512' && i.type === 'image/svg+xml' && i.purpose === 'maskable'
    )
  );
  assert.ok(
    icons.some(
      (i) =>
        i.src === 'https://cdn-icons-png.flaticon.com/512/2964/2964514.png' &&
        i.sizes === '512x512' &&
        i.type === 'image/png' &&
        i.purpose === 'any'
    )
  );
  assert.ok(
    icons.some(
      (i) =>
        i.src === 'https://cdn-icons-png.flaticon.com/512/2964/2964514.png' &&
        i.sizes === '192x192' &&
        i.type === 'image/png' &&
        i.purpose === 'any'
    )
  );

  const screenshots = manifest.screenshots as Array<Record<string, string>>;
  assert.ok(Array.isArray(screenshots) && screenshots.length > 0);
  assert.equal(screenshots[0].form_factor, 'narrow');
  assert.equal(screenshots[0].sizes, '512x512');
  assert.equal(screenshots[0].type, 'image/png');
});

test('public/icon-512.svg and public/sw.js exist with valid structure', () => {
  const svg = fs.readFileSync(path.resolve(process.cwd(), 'public/icon-512.svg'), 'utf-8');
  assert.ok(svg.includes('viewBox="0 0 512 512"'));
  assert.ok(svg.includes('#071712'));
  assert.ok(svg.includes('VITALITY'));

  const sw = fs.readFileSync(path.resolve(process.cwd(), 'public/sw.js'), 'utf-8');
  assert.ok(sw.includes("addEventListener('install'"));
  assert.ok(sw.includes("addEventListener('activate'"));
  assert.ok(sw.includes("addEventListener('fetch'"));
});
