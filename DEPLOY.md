# Deploy — hotelgrader marketing site (Astro)

This is the standalone marketing site. It serves `hotelgrader.com` at the root.
The React product app moves to `app.hotelgrader.com`. The Flask API stays on
Railway, unchanged.

Do the steps in this order so there is never a gap where the app is unreachable.

## 1. Move the React app to app.hotelgrader.com (do first)

- In Lovable, Settings, Domains: add `app.hotelgrader.com` as an additional
  custom domain (keep `hotelgrader.com` for now).
- DNS (send to Patrick): Type A, Host `app`, Value `185.158.133.1`, TTL auto.
  If Lovable's Domains panel shows a CNAME instead, use what Lovable shows.
- Confirm `https://app.hotelgrader.com` loads the app, log in, run a scan.

## 2. Deploy this Astro site to Netlify

- Push this repo to GitHub, connect it to Netlify (New site from Git).
- Build command `npm run build`, publish directory `dist` (Astro defaults).
- Netlify environment variables:
  - `PUBLIC_HG_API` = https://web-production-13e22.up.railway.app
  - `PUBLIC_HG_APP` = https://app.hotelgrader.com
- Test on the temporary `*.netlify.app` URL: the hero search hands off to the
  app subdomain and runs a real scan.

## 3. Redirects

`public/_redirects` already sends app-only paths to `app.hotelgrader.com`.
Marketing and legal paths (`/pricing`, `/about`, `/methodology`, `/privacy`,
`/terms`) are served by this site and are not redirected.

## 4. Cut the root over to Astro

- In Netlify, add `hotelgrader.com` and `www.hotelgrader.com`. Netlify shows
  the apex A record and the `www` CNAME to set. Confirm the values in the panel.
- In Lovable, remove `hotelgrader.com` (keep `app.hotelgrader.com`).
- Point the apex and `www` records at Netlify. SSL issues automatically.

## 5. Google sign-in

- In Google Cloud Console, add `https://app.hotelgrader.com` to the sign-in
  OAuth client Authorized JavaScript origins. Keep `https://hotelgrader.com`
  during the transition.
- Users signed in on the old root sign in once more on the subdomain. Tokens
  are per-origin in localStorage, so this is expected, not a failure.

## Rollback

Point the apex and `www` records back at Lovable and re-add `hotelgrader.com`
in Lovable. The app returns to the root within DNS propagation. Nothing here is
destructive.

## Local development

    npm install
    npm run dev        # http://localhost:4321

The hero search and CTAs read PUBLIC_HG_API and PUBLIC_HG_APP. With no `.env`
they default to the live Railway API and `https://app.hotelgrader.com`.
Copy `.env.example` to `.env` to override for local testing.
