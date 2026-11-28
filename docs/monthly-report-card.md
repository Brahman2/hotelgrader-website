# Monthly report card: plan and spec

Goal: bring contacts back each month with an updated report card for their hotel.

## Hard rule

**Nothing is emailed to a real contact until Patrick has approved the template and a sample run, and has switched the program to live in the admin.** Until then everything runs in test mode, and test mode sends only to the test address (`MONTHLY_TEST_TO`). No code path sends a monthly email to a contact address while `mode` is `test`.

## What it does

1. **Keeps a contact list.** Today a verified unlock only reaches a sheet, Netlify Forms and a lead alert. From now on it also writes a contact record (Netlify Blobs, store `contacts`) holding the person, the hotels they unlocked, their country (from Netlify's request geo), and their consent.
2. **Re-scans every unlocked hotel monthly** from the 25th (hotels of contacts who get the email first, so the cap spends where it counts). Each result is saved as a snapshot for the coming issue, with its method version (store `monthly-snapshots`, key `<hotel key>/<issue YYYY-MM>`; the re-scan on 25 November saves the December issue). A baseline snapshot is also saved at unlock, so the first monthly email can say what changed since the person first saw their grade.
3. **Emails each eligible contact on the 1st**, one email per contact covering their first unlocked hotel (more hotels are listed, not detailed). The sections:
   - **What's changed** (top): a recap against last issue's snapshot, or this contact's own unlock baseline: grade and score, sections that moved, comp-set rank, rating and review count, unanswered reviews, fixes done or new. A score move is only claimed when both scans used the same method version and read about as much of the hotel (coverage within 3 points); otherwise it says why the scores aren't comparable. Rate fixes are left out until the report's rate check follows the parity rule.
   - **Your grade**: letter and score, with the change.
   - **Rank movement**: their place in their comp set (same star class, close ADR) and the change.
   - **Unanswered reviews**: low-star reviews with no reply among the newest read.
   - **One fix**: the top priority from the assessment, with its step.
   - **Marketing tip of the month**: one new tactic to stay ahead of the comp set (first tip: a ChatGPT business profile). Tips rotate from `netlify/lib/tips.mjs`, which Patrick edits.
   - Button to open the full report (signed link, no gate).
4. **One-click unsubscribe**: a signed link in every email and `List-Unsubscribe` / `List-Unsubscribe-Post` headers (RFC 8058), so Gmail and Apple Mail show their own unsubscribe button. The link's page unsubscribes as soon as it loads in a browser (a bare GET from a link scanner changes nothing). Undoing it only lifts the unsubscribe; it never grants consent. Test emails carry an unsubscribe link for the test address, never for the contact they stand in for.
5. **Consent by region**: the box starts ticked only for visitors in the US and its territories (it starts unticked and is ticked only once the server confirms the country). Everywhere else, and when the country is unknown, the email goes only to people who ticked the box themselves. Contacts with no consent recorded (for example, people who verified before this shipped) never get it. `/api/contact-hotel` only adds hotels to existing contacts, at most 5 each.
6. **Admin** (`/admin`, sign-in by emailed code to `ADMIN_EMAILS`): program status, the approvals, contact counts by eligibility, the last re-scan's cost (searches and estimated dollars), month-to-date spend against the cap, and controls to set the cap, preview the template, send a sample to the test address, approve, re-scan now, enable, and switch to live.

## Safety gates

| Gate | Where | Default |
|---|---|---|
| `enabled` | admin | off: the scheduled jobs do nothing |
| `mode` | admin | `test`: every email goes to `MONTHLY_TEST_TO` only, subject prefixed `[TEST]`, at most 3 per run |
| Template approval | admin | none. `TEMPLATE_VERSION` is a fingerprint of the template code and every tip, so any edit gives a new version and voids the approval. The admin preview lists every tip, so approving the template approves them all |
| Sample approval | admin | none. Needs a sample sent after the current template was approved |
| Postal address | `MAIL_POSTAL_ADDRESS` env | Optional while hotelgrader is free and the email sells nothing (a relationship message under CAN-SPAM). Required, and shown in the footer, once the email promotes anything paid. A PO Box or virtual mailbox keeps it anonymous |
| Spend cap | admin, dollars a month | $25. The re-scan stops before it would pass the cap; skipped hotels get no email that month |

Switching to `live` requires: template approved at the current version, a sample approved after that, `MONTHLY_TEST_TO` set, and an admin signed in. Any template change drops the program back to `test`.

## Cost

A re-scan of one hotel costs up to 17 searches (prices, the class search, profile, brand search, AI question, reviews, ads). Town searches are shared and cached for a week. Cost is counted from the searches each reading actually spent, multiplied by `costPerSearch` (admin setting, default $0.015, about the price of a search on SerpAPI's Developer plan). The admin shows searches and dollars per run and month to date.

## Schedule

| Job | When (UTC) | What |
|---|---|---|
| `monthly-rescan-cron` | 25th to 28th, 10:00 | Starts or resumes the background re-scan if enabled |
| `monthly-send-cron` | 1st, 17:00 (7am Honolulu, 9am Pacific, noon Eastern), again 19:00 and 21:00 | Starts or resumes the background send if enabled |

Both jobs hand off to background functions (15-minute limit), which stop at 13 minutes, record progress and resume on the next scheduled run. Storage is read with strong consistency, and a failed read stops a run rather than starting it over.

## Admin sign-in

A 6-digit code emailed to an `ADMIN_EMAILS` address: five tries per code, each code works once, sessions last 12 hours. Visitor codes and admin codes are signed with different prefixes, so one can't stand in for the other.

## Environment variables (set in Netlify, none are secrets)

- `ADMIN_EMAILS`: comma-separated addresses allowed to sign in to `/admin`.
- `MONTHLY_TEST_TO`: the only address test-mode email goes to.
- `MAIL_POSTAL_ADDRESS`: the postal address shown in the email footer.

Existing secrets reused: `VERIFY_SECRET` (signs codes, unsubscribe links and admin sessions), `RESEND_API_KEY`, `SERPAPI_KEY`.

## Not in this build

- Back-filling contacts who unlocked before this ships (they're in the leads sheet; an import can follow once Patrick decides how to treat their consent).
- Per-hotel emails for people who unlocked several hotels (one email per person, first hotel detailed).
- Sending through anything but Resend.
