# Contributing — hotelgrader marketing site

This repo is the standalone Astro marketing site, live at **hotelgrader.com**.
It is separate from the app: the scan and report tool is the `insight` repo,
live at **app.hotelgrader.com**. This site's "get my report" buttons hand off
to it automatically.

## Get set up

Clone (same SSH setup as the insight repo):

    git clone git@github.com:Brahman2/hotelgrader-website.git
    cd hotelgrader-website

Run it locally:

    npm install
    npm run dev

Opens at http://localhost:4321. No API keys are needed locally. The hero search
calls the live backend on its own, and the handoff targets are set in Netlify,
not in the code.

## Where things live

| Path | What it is |
|---|---|
| `src/pages/*.astro` | The pages: home, pricing, methodology, about, sample report, legal |
| `src/components/` | The sections: Hero, Pillars, FAQ, Footer, and the rest |
| `src/styles/global.css` | Global styles |
| `tailwind.config.mjs` | Colors, type, spacing, design tokens |
| `public/` | Fonts, images, favicons, robots.txt |
| `BACKPORT.md` | The design-system spec |
| `DEPLOY.md` | Hosting and deploy details |

## Publishing changes

- Push to `main` and Netlify auto-builds and deploys to hotelgrader.com in about
  one to two minutes.
- For anything bigger than a copy tweak, push a **branch** instead. Netlify
  builds a **preview URL** for that branch so you can check it before it goes
  live, then merge the branch into `main` to publish.

## Copy rules

Follow the writing rules in `BACKPORT.md` section 3: no em dashes, no invented
abbreviations, exact numbers, no emoji, no exclamation marks. These keep the
marketing copy and the app's report copy consistent.

## What NOT to change here

- Backend or API behavior. That is the separate backend repo on Railway.
- The app itself. That is the `insight` repo.
- Environment values. `PUBLIC_HG_API` and `PUBLIC_HG_APP` are set in Netlify, so
  nothing environment-specific is committed here.
