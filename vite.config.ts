import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// SPA fallback configuration:
// - Netlify: public/_redirects
// - Vercel: vercel.json
// - Cloudflare Pages: public/_redirects (same as Netlify)
// - Other hosts: Configure your server to serve index.html for all routes

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
