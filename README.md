# William Kearns

A small personal site and digital archive: a calm place to check in, and a shelf for notes over time. It is an [Astro](https://astro.build) site, published at [wolfe4O6.github.io](https://wolfe4O6.github.io).

The three posts already in the project are **placeholders**. Edit them or delete them. They are not a record of anything that happened.

## Write a new post

1. Create a new file in `src/content/posts/`. The file name becomes the link.

   `src/content/posts/morning-walk.md` is published at `/posts/morning-walk/`.

   Use lowercase words and hyphens. You can use `.md` or `.mdx`. Plain Markdown is enough.

2. Start the file with this block, then write underneath it:

   ```md
   ---
   title: Morning walk
   description: One sentence about the note.
   date: 2026-11-16
   tags:
     - notes
   ---

   Write the note here.
   ```

   - `title`, `description`, and `date` are required. Write the date as `YYYY-MM-DD`.
   - `tags` is a list. Each tag gets its own page under `/tags/`.
   - Add `draft: true` to hide a note until you are ready. Drafts stay off the site, the archive, and the RSS feed.
   - `placeholder: true` shows a small “this is a sample” note at the top. Leave it off for real posts.

3. Save the file. If the site is running locally, the new post shows up on its own. A push to `main` publishes it.

To take a post down, delete its file, or set `draft: true`.

## Edit the Now page

What you are up to lives in one file:

`src/content/pages/now.md`

That file is the Now section on the home page and the page at `/now/`. Change the words, and change `updated:` at the top when you do.

## Edit the About page

The short bio at the top of `/about/` (name, the line “A tinkerer learning the ways of the world.”, Missoula, GitHub) comes from `src/site.ts`.

The paragraphs under that come from `src/content/pages/about.md`. Edit that file for the longer version of About.

## Run it locally

You need [Node.js](https://nodejs.org) 22 or newer.

```sh
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

To build the site the way GitHub will:

```sh
npm run build
npm run preview
```

The finished files land in `dist/`.

## Publish

Pushes to `main` run `.github/workflows/deploy.yml`. That workflow installs dependencies, builds the site with the [official Astro action](https://docs.astro.build/en/guides/deploy/github/), and deploys it with GitHub’s `actions/deploy-pages` action.

### One-time Pages setting

GitHub has to be told to deploy from Actions:

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.

If it is already set to GitHub Actions, there is nothing to do. The next push to `main` publishes the site at [https://wolfe4O6.github.io](https://wolfe4O6.github.io).

This is a user site (`username.github.io`), so it is served from the root of that address. There is no extra base path to configure.

## Where things live

```text
src/content/posts/     notes, one Markdown file each
src/content/pages/     now.md and about.md
src/pages/             the site pages, archive, tags, RSS
src/styles/global.css  colors, type, and layout
src/site.ts            name, bio line, town, GitHub link
public/                favicon and other files served as-is
```

The archive page (`/archive/`) lists every published note, grouped by year. Tag pages are generated from the `tags` on each post. `/rss.xml` and the sitemap update on every build.
