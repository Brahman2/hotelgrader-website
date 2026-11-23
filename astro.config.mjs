import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Local stand-in for the /api/site-scan Netlify function, so `astro dev` can
// show a report scored with our own website collector.
const devSiteScan = {
  name: 'dev-site-scan',
  configureServer(server) {
    server.middlewares.use('/api/site-scan', (req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', async () => {
        const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
        try {
          const { hotel, city, state } = JSON.parse(raw || '{}');
          const { fetchAudit } = await import('./netlify/lib/report.mjs');
          const { siteFor } = await import('./netlify/lib/site.mjs');
          const audit = await fetchAudit(hotel, city, state);
          send(audit ? 200 : 409, audit ? { crawl: await siteFor(audit) } : { error: 'not ready' });
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
  vite: { plugins: [devSiteScan] },
});
