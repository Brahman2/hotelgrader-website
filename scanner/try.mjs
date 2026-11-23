// node scanner/try.mjs https://example-hotel.com [...]   Prints what the site collector sees.
import { scanSite } from './site.mjs';
for (const u of process.argv.slice(2)) {
  const s = await scanSite(u);
  if (!s.ok) { console.log(`\n== ${u}\n  FAILED: ${s.error} (status ${s.status ?? '-'})`); continue; }
  console.log(`\n== ${s.host}  ${s.status} ${s.ms}ms ${Math.round(s.bytes / 1024)}KB rendered=${s.rendered} words=${s.words}`);
  console.log(`  title: ${s.title}\n  h1: ${JSON.stringify(s.h1)}  desc:${s.description ? 'yes' : 'no'} viewport:${s.viewport} lang:${s.lang}`);
  console.log(`  schema: lodging=${s.schema.lodging ? JSON.stringify(s.schema.lodging) : 'none'} faq=${s.schema.faq} types=${s.schema.types.join(',')}`);
  console.log(`  booking: engine=${s.booking.engine || '-'} buttons=${s.booking.buttons} stale=${s.booking.staleCount} main=${s.booking.main.slice(0, 90)}`);
  console.log(`  firstStep: ${JSON.stringify(s.booking.firstStep)}`);
  console.log(`  contact: ${JSON.stringify(s.contact)}  signup: ${JSON.stringify(s.signup)} chat:${s.chat}`);
  console.log(`  social: ${Object.entries(s.social).map(([k, v]) => `${k}=${v.handle}`).join(' ')}`);
  console.log(`  pages: ${Object.entries(s.pages).filter(([, v]) => v).map(([k]) => k).join(',')}  robots:${s.robots.found}${s.robots.blocksAll ? ' BLOCKS ALL' : ''} sitemap:${s.sitemap.found}(${s.sitemap.urls}) llms:${s.llms.found}`);
}
