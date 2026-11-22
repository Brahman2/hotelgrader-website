// Google Analytics events. The tag itself loads in BaseLayout (production
// only, and never for testers), so on a dev build or a tester's browser
// `gtag` is missing and every call here is a no-op.
//
// Never pass a name or an email address: only the hotel being graded and
// what happened.

type Params = Record<string, string | number | boolean | undefined>;

export function track(event: string, params: Params = {}): void {
  try {
    const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
    gtag?.('event', event, params);
  } catch { /* analytics must never break the page */ }
}

/** The hotel a visitor is grading, as event parameters. */
export function hotelParams(t: { hotel: string; city: string; state: string }): Params {
  return { hotel: t.hotel, hotel_city: t.city, hotel_state: t.state };
}
