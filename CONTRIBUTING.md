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

There are two ways to publish, depending on how big the change is.

- **Small copy tweak:** push to `main` and Netlify auto-builds and deploys to
  hotelgrader.com in about one to two minutes.
- **Anything bigger:** work on a **branch**, let Netlify build a preview of just
  that branch, check it, then merge into `main` to go live. Nothing reaches the
  live site until the merge. The full walkthrough is below.

### The branch workflow, step by step

The idea: your changes live on a separate branch, Netlify builds a preview of
just that branch, and only merging into `main` publishes to the live site.

1. **Start from an up-to-date `main`.** Pull the latest so you are not building
   on stale code:

       git checkout main
       git pull

2. **Create a branch and switch to it.** One command does both. Name it for what
   you are doing (the `patrick/` prefix is just convention, any name works):

       git checkout -b patrick/hero-copy

   Anything you commit now goes on this branch, not on `main`.

3. **Make your edits.** Change files in your editor and run `npm run dev` to
   check locally at http://localhost:4321 as you go.

4. **Stage and commit.** Staging picks which changes to save, committing saves
   them as a checkpoint with a message:

       git add -A
       git commit -m "Tighten hero headline and subhead"

5. **Push the branch to GitHub.** The first push needs `-u` to link your local
   branch to a matching one on GitHub:

       git push -u origin patrick/hero-copy

   After that first time, later pushes on the same branch are just `git push`.

6. **Open a Pull Request.** On GitHub, after pushing, a banner appears: "Compare
   and pull request." Click it, add a short title, create the PR. A PR is just a
   request to merge your branch into `main`.

7. **Find the Netlify preview.** Within a minute or two, Netlify builds your
   branch and posts a link in the PR. Look in the checks section at the bottom of
   the PR for "Deploy Preview" and its View deployment link. That URL is your
   branch's version of the site, live but separate from production. Share it, get
   feedback.

8. **Keep tweaking if needed.** More edits? Repeat commit and `git push` (no
   `-u` now) on the same branch. Netlify rebuilds the preview automatically each
   time.

9. **Publish by merging.** When it is approved, click Merge pull request on
   GitHub. That merges your branch into `main`, which triggers the real deploy to
   hotelgrader.com. About one to two minutes later it is live.

10. **Tidy up.** Return to main and pull the merged change. GitHub also offers a
    Delete branch button on the merged PR, which is safe to click:

        git checkout main
        git pull

### The no-terminal alternative

Same workflow, fewer commands, using a GUI:

- **VS Code:** the Source Control panel in the left sidebar has buttons for
  branch, commit, and push. The current branch name shows in the bottom-left
  status bar.
- **GitHub Desktop:** Current Branch, New Branch, make edits, Commit to branch,
  Push origin, then Create Pull Request (which opens GitHub).

Either way, the GitHub PR and Netlify preview steps (6 through 9) are identical.

### The one-line mental model

Branch, commit, push, PR, check the Netlify preview, merge to go live.

## Copy rules

Follow the writing rules in `BACKPORT.md` section 3: no em dashes, no invented
abbreviations, exact numbers, no emoji, no exclamation marks. These keep the
marketing copy and the app's report copy consistent.

## What NOT to change here

- Backend or API behavior. That is the separate backend repo on Railway.
- The app itself. That is the `insight` repo.
- Environment values. `PUBLIC_HG_API` and `PUBLIC_HG_APP` are set in Netlify, so
  nothing environment-specific is committed here.
