// The marketing tip in each monthly report card: one new, practical tactic that keeps a hotel's marketing
// ahead of its comp set. One tip per month, in order; it wraps around at the end. Patrick edits this list.
// Keep each tip true, specific and doable by a GM in under an hour. Changing this file changes the
// template, so bump TEMPLATE_VERSION in email.mjs and re-approve in /admin.

export const TIPS = [
  {
    title: 'Give ChatGPT the facts about your hotel',
    body: 'More travelers now ask ChatGPT where to stay before they open a booking site. Set up a business profile for your hotel where ChatGPT offers one, and make your name, address, phone, website, check-in time, parking and pet policy match your Google profile word for word. Then ask ChatGPT for the best {class}hotels in {city} and see whether it names you. Most of your competitors haven’t done this yet.',
  },
  {
    title: 'Claim your hotel on Apple Maps',
    body: 'Every iPhone guest who asks Siri or opens Apple Maps sees the Apple listing, not your Google one. Claim it free with Apple Business Connect, add photos and your booking link, and check the hours and phone number.',
  },
  {
    title: 'Claim your hotel on Bing Places',
    body: 'Bing feeds Microsoft Copilot and several AI assistants. Claiming your free Bing Places listing takes a few minutes, and you can import everything from your Google profile in one step.',
  },
  {
    title: 'Turn on Google’s free booking links',
    body: 'Google shows a free “Official site” price next to the OTAs on your hotel listing, but only if your booking engine sends it your rates. Ask your booking engine provider to switch on free booking links. It costs nothing and puts your direct rate beside Booking.com and Expedia.',
  },
  {
    title: 'Answer the questions on your Google profile',
    body: 'Your Google profile has a questions section that anyone can answer, including people who have never stayed with you. Post and answer the five questions you get most at the front desk (parking, breakfast, early check-in, pets, resort fee) so the right answers show first.',
  },
  {
    title: 'Add hotel details to your website’s code',
    body: 'Search engines and AI assistants read a hidden block of hotel details on your site (schema.org “Hotel” markup): address, star rating, amenities, check-in time. Ask your web provider to add it. It helps both Google and ChatGPT describe you correctly.',
  },
];

/** The tip for a given month. The first send (December 2026) gets the first tip, then one a month in order. */
export function tipFor(date = new Date(), { city = '', hotelClass = null } = {}) {
  const n = (date.getUTCFullYear() - 2026) * 12 + date.getUTCMonth() - 11;
  const tip = TIPS[((n % TIPS.length) + TIPS.length) % TIPS.length];
  const cls = hotelClass ? `${hotelClass}-star ` : '';
  return { ...tip, body: tip.body.replace('{class}', cls).replace('{city}', city || 'your town') };
}
