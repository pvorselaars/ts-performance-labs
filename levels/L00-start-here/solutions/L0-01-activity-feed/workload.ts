export interface FeedItem { id: number; score: number }

// The feed shows the newest item first. Appending is O(1) amortised; unshift moves every element.
// So append in arrival order, then reverse once at the end: O(n) instead of O(n^2).
export function buildFeed(count: number): FeedItem[] {
  const feed: FeedItem[] = [];
  for (let i = 0; i < count; i++)
    feed.push({ id: i, score: (i * 7) % 101 });
  return feed.reverse();
}

export function workload(): number {
  const feed = buildFeed(60_000);
  let checksum = 0;
  for (let i = 0; i < feed.length; i += 97)
    checksum += feed[i]!.id * 31 + feed[i]!.score;
  return checksum * 1_000_003 + feed.length;
}
