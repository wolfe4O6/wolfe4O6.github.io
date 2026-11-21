import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => data.draft !== true);
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function groupByYear(posts: Post[]): [number, Post[]][] {
  const groups = new Map<number, Post[]>();
  for (const post of posts) {
    const year = post.data.date.getUTCFullYear();
    const list = groups.get(year);
    if (list) list.push(post);
    else groups.set(year, [post]);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]);
}
