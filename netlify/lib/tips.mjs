// The marketing tip in each monthly report card: one new, practical tactic that keeps a hotel's marketing
// ahead of its comp set. One tip per month, in order; it wraps around at the end. Patrick edits this list.
// Keep each tip true, specific and doable by a GM in under an hour. Changing this file changes the
// template, so bump TEMPLATE_VERSION in email.mjs and re-approve in /admin.

export const TIPS = [
  {
    title: 'Get your hotel ready for ChatGPT',
    body: 'Travelers are starting to ask AI assistants like ChatGPT where to stay. ChatGPT answers from what it can read about you: your website, your Google profile and the big listing sites. If ChatGPT offers a business profile for hotels where you are, claim it. Either way, make your name, address, phone, website, check-in time, parking and pet policy match everywhere, word for word. Then ask ChatGPT for the best {class}hotels in {city} and see whether it names you. It takes ten minutes, and it’s an easy way to get ahead of hotels that haven’t looked.',
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
    title: 'Post an offer on your Google profile',
    body: 'Your Google profile can show posts, including offers with dates and a booking link. Post one book-direct offer a month (a late checkout, breakfast, parking included). It shows on your listing where guests compare you, and it costs nothing.',
  },
  {
    title: 'Add hotel details to your website’s code',
    body: 'Search engines and AI assistants read a hidden block of hotel details on your site (schema.org “Hotel” markup): address, star rating, amenities, check-in time. Ask your web provider to add it. It gives search engines your facts in a form they can read without guessing.',
  },
];

/** The tip for a given month. The first send (December 2026) gets the first tip, then one a month in order. */
export function tipFor(date = new Date(), { city = '', hotelClass = null } = {}) {
  const n = (date.getUTCFullYear() - 2026) * 12 + date.getUTCMonth() - 11;
  const tip = TIPS[((n % TIPS.length) + TIPS.length) % TIPS.length];
  const cls = hotelClass ? `${hotelClass}-star ` : '';
  return { ...tip, body: tip.body.replace('{class}', cls).replace('{city}', city || 'your town') };
}
