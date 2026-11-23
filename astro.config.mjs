import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Local stand-in for the /api/scan Netlify function, so `astro dev` can show a
// report scored with our own collectors. Without SERPAPI_KEY in the shell it
// only reads the website, and only once the grading API has a finished scan.
const devScan = {
  name: 'dev-scan',
  configureServer(server) {
    server.middlewares.use('/api/scan', (req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', async () => {
        const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
        try {
          const { scanFor } = await import('./netlify/lib/scan.mjs');
          send(200, { scan: await scanFor(JSON.parse(raw || '{}')) });
        } catch (e) { send(500, { error: String(e) }); }
      });
    });
  },
};

export default defineConfig({
  site: 'https://hotelgrader.com',
  integrations: [
    tailwind({ applyBaseStyles: false }),
    react(),
    // /grade is noindex (per-hotel results), so keep it out of the sitemap.
    sitemap({ filter: (page) => !page.includes('/grade') }),
  ],
  server: { port: 4321, host: true },
  vite: { plugins: [devScan] },
});
