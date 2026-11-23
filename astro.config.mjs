// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// User site. The repository is named wolfe4O6.github.io, so Pages
// serves it from the domain root (williamkearns.org and github.io).
// Do not set `base` — a base path would break a user site.
export default defineConfig({
  site: 'https://williamkearns.org',
  trailingSlash: 'always',
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      themes: {
        light: 'everforest-light',
        dark: 'everforest-dark',
      },
      defaultColor: false,
      wrap: true,
    },
  },
});
