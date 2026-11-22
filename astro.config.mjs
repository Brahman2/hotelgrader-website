import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://hotelgrader.com',
  integrations: [
    tailwind({ applyBaseStyles: false }),
    react(),
    // /grade is noindex (per-hotel results), so keep it out of the sitemap.
    sitemap({ filter: (page) => !page.includes('/grade') }),
  ],
  server: { port: 4321, host: true },
});
