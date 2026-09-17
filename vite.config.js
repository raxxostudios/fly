import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  root: resolve(import.meta.dirname, 'dist'),
  publicDir: false,
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
  resolve: { alias: { 'three/addons': resolve(import.meta.dirname, 'dist/vendor/addons'), three: resolve(import.meta.dirname, 'dist/vendor/three.module.js') } },
  optimizeDeps: { noDiscovery: true, include: [] }
});
