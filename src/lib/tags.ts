import type { Post } from './posts';

export function tagSlug(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface TagSummary {
  slug: string;
  label: string;
  count: number;
}

export function collectTags(posts: Post[]): TagSummary[] {
  const map = new Map<string, TagSummary>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      const slug = tagSlug(tag);
      if (!slug) continue;
      const existing = map.get(slug);
      if (existing) existing.count += 1;
      else map.set(slug, { slug, label: tag.trim(), count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'en'));
}

export function postsWithTag(posts: Post[], slug: string): Post[] {
  return posts.filter((post) => post.data.tags.some((tag) => tagSlug(tag) === slug));
}
