// What you're listening to. Shown on the home page and on /now.
// Replace the placeholder rows with real ones, or delete them.
// Optional: paste a Spotify link to show an embed on the Now page.
//   spotify: 'https://open.spotify.com/track/xxxxxxxx'
// Track, album, playlist, episode, and show links from open.spotify.com all work.

export interface Listen {
  title: string;
  artist: string;
  note?: string;
  spotify?: string;
  placeholder?: boolean;
}

export const listening: Listen[] = [
  {
    title: 'A song you actually love',
    artist: 'Replace this artist',
    note: 'Placeholder. Put what you are really listening to here.',
    placeholder: true,
  },
  {
    title: 'Another stand-in track',
    artist: 'Your pick',
    note: 'Placeholder. A second card, so the shelf is not empty.',
    placeholder: true,
  },
  {
    title: 'One you might embed',
    artist: 'Still a placeholder',
    note: 'Placeholder. Paste a Spotify link on this entry if you want a player.',
    placeholder: true,
  },
];

const spotifyKinds = new Set(['track', 'album', 'playlist', 'episode', 'show']);

/** Turn an open.spotify.com link into an embed URL, or return null. */
export function spotifyEmbed(url: string | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname !== 'open.spotify.com') return null;
    const parts = parsed.pathname.split('/').filter(Boolean);
    const start = parts[0] === 'embed' ? 1 : 0;
    const kind = parts[start];
    const id = parts[start + 1];
    if (!kind || !id || !spotifyKinds.has(kind)) return null;
    if (!/^[A-Za-z0-9]+$/.test(id)) return null;
    return `https://open.spotify.com/embed/${kind}/${id}`;
  } catch {
    return null;
  }
}
