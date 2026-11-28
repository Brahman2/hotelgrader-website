# Monthly report card: plan and spec

Goal: bring contacts back each month with an updated report card for their hotel.

## Hard rule

**Nothing is emailed to a real contact until Patrick has approved the template and a sample run, and has switched the program to live in the admin.** Until then everything runs in test mode, and test mode sends only to the test address (`MONTHLY_TEST_TO`). No code path sends a monthly email to a contact address while `mode` is `test`.

## What it does

1. **Keeps a contact list.** Today a verified unlock only reaches a sheet, Netlify Forms and a lead alert. From now on it also writes a contact record (Netlify Blobs, store `contacts`) holding the person, the hotels they unlocked, their country (from Netlify's request geo), and their consent.
2. **Re-scans every unlocked hotel monthly** on the 25th, so the email on the 1st is fresh. Each result is saved as a snapshot with its method version (store `monthly-snapshots`, key `<hotel key>/<YYYY-MM>`). A baseline snapshot is also saved at unlock, so the first monthly email can say what changed since the person first saw their grade.
3. **Emails each eligible contact on the 1st**, one email per contact covering their first unlocked hotel (more hotels are listed, not detailed). The sections:
   - **What's changed** (top): a recap against their last snapshot: grade and score, sections that moved, comp-set rank, rating and review count, unanswered reviews, fixes done or new. When the method version changed between snapshots, it says so and doesn't claim a grade movement.
   - **Your grade**: letter and score, with the change.
   - **Rank movement**: their place in their comp set (same star class, close ADR) and the change.
   - **Unanswered reviews**: low-star reviews with no reply among the newest read.
   - **One fix**: the top priority from the assessment, with its step.
   - **Marketing tip of the month**: one new tactic to stay ahead of the comp set (first tip: a ChatGPT business profile). Tips rotate from `netlify/lib/tips.mjs`, which Patrick edits.
   - Button to open the full report (signed link, no gate).
4. **One-click unsubscribe**: a signed link in every email and `List-Unsubscribe` / `List-Unsubscribe-Post` headers (RFC 8058), so Gmail and Apple Mail show their own unsubscribe button. One click unsubscribes immediately; the page offers "resubscribe" in case it was a mistake.
5. **Consent by region**: contacts in the EU/EEA, the UK, Switzerland and Canada get the monthly email only if they ticked the opt-in box. Everyone else is opted in by default at signup, can untick the box, and can unsubscribe at any time. Contacts with an unknown country are treated as opt-in-only.
6. **Admin** (`/admin`, sign-in by emailed code to `ADMIN_EMAILS`): program status, the approvals, contact counts by eligibility, the last re-scan's cost (searches and estimated dollars), month-to-date spend against the cap, and controls to set the cap, preview the template, send a sample to the test address, approve, re-scan now, enable, and switch to live.

## Safety gates

| Gate | Where | Default |
|---|---|---|
| `enabled` | admin | off: the scheduled jobs do nothing |
| `mode` | admin | `test`: every email goes to `MONTHLY_TEST_TO` only, subject prefixed `[TEST]`, at most 3 per run |
| Template approval | admin | none. Approval records `TEMPLATE_VERSION`; editing the template bumps the version and voids it |
| Sample approval | admin | none. Needs a sample sent after the current template was approved |
| Postal address | `MAIL_POSTAL_ADDRESS` env | Required (CAN-SPAM) before live can be switched on |
| Spend cap | admin, dollars a month | $25. The re-scan stops before it would pass the cap; skipped hotels get no email that month |

Switching to `live` requires: template approved at the current version, a sample approved after that, a postal address set, and an admin signed in. Any template change drops the program back to `test`.

## Cost

A re-scan of one hotel costs up to 16 searches (prices, the class search, profile, brand search, AI question, reviews, ads). Town searches are shared and cached for a week. Cost is counted from the searches each reading actually spent, multiplied by `costPerSearch` (admin setting, default $0.015, about the price of a search on SerpAPI's Developer plan). The admin shows searches and dollars per run and month to date.

## Schedule

| Job | When (UTC) | What |
|---|---|---|
| `monthly-rescan-cron` | 25th 10:00 | Starts the background re-scan if enabled |
| `monthly-send-cron` | 1st 17:00 (7am Honolulu, 9am Pacific, noon Eastern) | Starts the background send if enabled |

Both jobs hand off to background functions (15-minute limit), which work through the list and record progress, so a rerun picks up where the last stopped.

## Environment variables (set in Netlify, none are secrets)

- `ADMIN_EMAILS`: comma-separated addresses allowed to sign in to `/admin`.
- `MONTHLY_TEST_TO`: the only address test-mode email goes to.
- `MAIL_POSTAL_ADDRESS`: the postal address shown in the email footer.

Existing secrets reused: `VERIFY_SECRET` (signs codes, unsubscribe links and admin sessions), `RESEND_API_KEY`, `SERPAPI_KEY`.

## Not in this build

- Back-filling contacts who unlocked before this ships (they're in the leads sheet; an import can follow once Patrick decides how to treat their consent).
- Per-hotel emails for people who unlocked several hotels (one email per person, first hotel detailed).
- Sending through anything but Resend.
