import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
for (const headless of [true, false]) {
  const b = await chromium.launch({ executablePath: exe, headless, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] });
  const p = await b.newPage();
  const r = await p.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2'); if (!gl) return 'no webgl2'; const d = gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(d ? d.UNMASKED_RENDERER_WEBGL : gl.RENDERER); });
  console.log('headless', headless, r);
  await b.close();
}
