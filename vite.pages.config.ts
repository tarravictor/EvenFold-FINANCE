import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { createHash } from "node:crypto";
const base = process.env.GITHUB_REPOSITORY ? `/${process.env.GITHUB_REPOSITORY.split("/")[1]}/` : "/";
function offlineShell(): Plugin {
  return {
    name: "evenfold-offline-shell", apply: "build",
    generateBundle(_options, bundle) {
      const assets = [...new Set(["index.html", "manifest.webmanifest", "app-icon.svg", ...Object.keys(bundle).filter(name => /\.(js|css|html)$/.test(name))])];
      const revision = createHash("sha256").update(JSON.stringify(assets)).digest("hex").slice(0, 12);
      this.emitFile({ type: "asset", fileName: "sw.js", source: `
const CACHE = 'evenfold-shell-${revision}';
const BASE = ${JSON.stringify(base)};
const ASSETS = ${JSON.stringify(assets.map(name => base + name))};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('evenfold-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match(BASE + 'index.html'))));
  else if (ASSETS.includes(url.pathname)) event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request).then(found => found || fetch(event.request))));
});` });
    },
  };
}
export default defineConfig({ plugins: [react(), offlineShell()], resolve: { alias: { "@": path.resolve(process.cwd()) } }, base, build: { outDir: "pages-dist", emptyOutDir: true } });
