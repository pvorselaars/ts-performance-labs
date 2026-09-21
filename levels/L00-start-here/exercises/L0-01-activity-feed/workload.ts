export interface FeedItem { id: number; score: number }

// The feed shows the newest item first, so each new item goes to the front.
export function buildFeed(count: number): FeedItem[] {
  const feed: FeedItem[] = [];
  for (let i = 0; i < count; i++)
    feed.unshift({ id: i, score: (i * 7) % 101 });
  return feed;
}

export function workload(): number {
  const feed = buildFeed(60_000);
  let checksum = 0;
  for (let i = 0; i < feed.length; i += 97)
    checksum += feed[i]!.id * 31 + feed[i]!.score;
  return checksum * 1_000_003 + feed.length;
}
