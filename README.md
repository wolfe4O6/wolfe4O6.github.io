# William Kearns

A small personal site and digital archive: a calm place to check in, and a shelf for notes over time. It is an [Astro](https://astro.build) site, published at [wolfe4O6.github.io](https://wolfe4O6.github.io).

The home page opens on two photographs of Missoula: the M on Mount Sentinel, and the L on Mount Jumbo. They crossfade. A small control softens the picture toward night. The weather chip is the current Missoula reading from Open-Meteo. Phones use a taller crop of the same two photographs so each letter stays in the frame.

Photo credits:

- The M on Mount Sentinel. Lance Fisher, [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/). [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:View_of_Mt._Sentinal_from_Bear%27s_Brew_-_Flickr_-_lancefisher.jpg).
- The L on Mount Jumbo. Chris Phan, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/). [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Mount_Jumbo_in_Missoula.jpg).

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

## Edit projects

Public GitHub projects live in one list:

`src/data/projects.ts`

Each block has a `name`, the repository `repo` slug, and the `description` from GitHub. The site links to `https://github.com/wolfe4O6/` plus that slug. Set `featured: true` to also show the project on the home page. Set it to `false`, or delete the block, to take it off the home page. The full list is always at `/projects/`.

## Add a photo

1. Open `Manage Photos.command`, then choose **Add photos** or drop files into the editor. JPEG, PNG, WebP, and supported HEIC photos work.
2. Add a caption and an image description for screen readers. The optional, editable date fills from EXIF DateTimeOriginal, then DateTimeDigitized, then DateTime when available; otherwise it stays blank. This date is read before descriptive metadata is removed from the image.
3. To crop, choose **Crop** on the photo's row. Drag the selection to move it and its corners to resize it, or enter Left, Top, Width, and Height in pixels. Choose Freeform, Original, Square, 4:3, 16:9, or Portrait 3:4. Arrow keys move the focused selection or resize a focused corner by one pixel; hold Shift for ten pixels. **Reset selection** resets the frame; **Cancel** leaves the photo unchanged.
4. Choose **Apply crop**, then **Save changes**. Captions, dates, descriptions, and photo identifiers survive cropping. Move photos up or down or remove them as needed, then save again.
5. Open **Preview saved site** to check the saved gallery, then choose **Publish website** to make it live.

After a crop, **Restore original** returns to the first pre-crop image and keeps the caption, date, description, and identifier. Save and publish the restoration when ready. The sanitized backup stays privately in this checkout's `.git/photo-editor-originals`, with its lookup in `.git/photo-editor-crops.json`; these files are not published or included in a new clone, so restoration is unavailable on another computer without that local backup.

The saved gallery lives in `src/data/gallery.json`, with public images in `public/images/`.

## Edit what you're listening to

The shelf on the home page and on `/now` comes from:

`src/data/listening.ts`

Replace the placeholder rows, or delete them. Each one needs a `title` and an `artist`. `note` is optional.

To show a Spotify player on the Now page, paste a link:

```ts
spotify: 'https://open.spotify.com/track/xxxxxxxx',
```

Track, album, playlist, episode, and show links from `open.spotify.com` work. Anything else is ignored. The home page lists the titles and leaves the player for the Now page.

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
src/data/projects.ts   GitHub projects
src/data/photos.ts     photo gallery entries
src/data/listening.ts  what you're listening to
src/pages/             the site pages, archive, tags, RSS
src/styles/global.css  colors, type, and layout
src/site.ts            name, bio line, town, GitHub link
public/photos/         image files for the gallery
public/                favicon and other files served as-is
```

The archive page (`/archive/`) lists every published note, grouped by year. Tag pages are generated from the `tags` on each post. `/projects/`, `/photos/`, and the listening shelf are driven by the files in `src/data/`. `/rss.xml` and the sitemap update on every build.
