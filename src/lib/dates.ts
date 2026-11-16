const full = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

const monthDay = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** Calendar dates in frontmatter are date-only (YYYY-MM-DD), so format them in UTC. */
export function formatDate(date: Date): string {
  return full.format(date);
}

export function formatMonthDay(date: Date): string {
  return monthDay.format(date);
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
