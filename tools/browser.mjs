import { chromium } from 'playwright-core';
export const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
export const gpuArgs = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=user-gesture-required'];
export async function launch(opts = {}) {
  return chromium.launch({ executablePath: exe, headless: true, args: [...gpuArgs, ...(opts.args || [])] });
}
