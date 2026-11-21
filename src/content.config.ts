import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Drop a new .md or .mdx file into src/content/posts to publish a note.
const posts = defineCollection({
  loader: glob({
    base: './src/content/posts',
    pattern: '**/*.{md,mdx}',
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    placeholder: z.boolean().default(false),
  }),
});

// Single pages edited as Markdown: src/content/pages/now.md and about.md.
const pages = defineCollection({
  loader: glob({
    base: './src/content/pages',
    pattern: '{now,about}.md',
  }),
  schema: z.object({
    title: z.string(),
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { posts, pages };
