/**
 * hoodTV Feed Algorithm
 * Tracks user interactions (chip clicks + video views) in localStorage,
 * infers genre affinities from video metadata, and builds a personalized
 * "For You" query + reorders genre chips by preference score.
 */

const STORAGE_KEY = "hoodtv_feed_v1";

export interface ChipDef {
  label: string;
  q: string;
  color?: string;
}

// Genre → keyword signals (matched against title + author, lowercase)
const GENRE_SIGNALS: Record<string, string[]> = {
  "Hip Hop": [
    "rap", "hip hop", "hip-hop", "drill", "trap", "freestyle",
    "drake", "kendrick", "travis scott", "future", "lil", "young",
    "21 savage", "nicki minaj", "cardi b", "eminem", "j cole",
  ],
  "Pop": [
    "pop", "taylor swift", "ariana grande", "dua lipa", "billie eilish",
    "the weeknd", "harry styles", "olivia rodrigo", "selena gomez",
    "ed sheeran", "charlie puth", "sabrina carpenter",
  ],
  "R&B": [
    "r&b", "rnb", "soul", "neo soul", "usher", "beyonce", "sza",
    "frank ocean", "daniel caesar", "h.e.r", "brent faiyaz",
    "summer walker", "jhene aiko", "kehlani", "tory lanez",
  ],
  "Electronic": [
    "edm", "electronic", "techno", "house", "trance", "dance",
    "dj", "remix", "avicii", "skrillex", "marshmello", "deadmau5",
    "calvin harris", "tiesto", "martin garrix", "alan walker",
  ],
  "Rock": [
    "rock", "metal", "punk", "alternative", "indie", "grunge",
    "nirvana", "linkin park", "foo fighters", "imagine dragons",
    "arctic monkeys", "green day", "red hot chili peppers",
  ],
  "Mood & Sound": [
    "lofi", "chill", "ambient", "vibes", "relax", "study",
    "lo-fi", "sleep", "coffee", "wave",
  ],
};

// ──── Storage helpers ──────────────────────────────────────────────────────────

interface FeedStore {
  scores: Record<string, number>;
  history: string[];   // last 50 video IDs watched
  totalInteractions: number;
}

function load(): FeedStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { scores: {}, history: [], totalInteractions: 0 };
    return JSON.parse(raw) as FeedStore;
  } catch {
    return { scores: {}, history: [], totalInteractions: 0 };
  }
}

function save(store: FeedStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // quota exceeded — ignore
  }
}

// ──── Public API ───────────────────────────────────────────────────────────────

/** Call whenever the user selects a genre chip. */
export function recordChipClick(label: string) {
  if (label === "For You" || label === "All") return;
  const store = load();
  store.scores[label] = (store.scores[label] ?? 0) + 3;
  store.totalInteractions += 1;
  save(store);
}

/** Call whenever the user clicks a video. Infers genre from title + author. */
export function recordVideoClick(videoId: string, title: string, author: string) {
  const store = load();

  // Avoid double-counting the same video in one session
  if (store.history.includes(videoId)) return;

  const text = (title + " " + author).toLowerCase();
  let matched = false;

  for (const [genre, keywords] of Object.entries(GENRE_SIGNALS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        store.scores[genre] = (store.scores[genre] ?? 0) + 1;
        matched = true;
        break;
      }
    }
  }

  // "official music video" bump — generic engagement signal
  if (!matched) {
    // don't inflate any specific genre, just count total engagement
  }

  store.history = [videoId, ...store.history].slice(0, 50);
  store.totalInteractions += 1;
  save(store);
}

/** Returns true if we have enough signal to personalize. */
export function hasFeedData(): boolean {
  const store = load();
  return store.totalInteractions >= 3;
}

/** Returns genre scores (for debugging / display). */
export function getGenreScores(): Record<string, number> {
  return load().scores;
}

/** Returns recently watched video IDs. */
export function getWatchHistory(): string[] {
  return load().history;
}

/**
 * Build the search query for the personalized "For You" feed.
 * Blends the top 1-2 scoring genres; falls back to trending default.
 */
export function buildFeedQuery(chips: ChipDef[]): string {
  const store = load();

  if (store.totalInteractions < 3) {
    return "official music video trending 2024";
  }

  const scored = chips
    .filter((c) => c.label !== "For You" && c.label !== "All")
    .map((c) => ({ ...c, score: store.scores[c.label] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const top = scored.filter((c) => c.score > 0).slice(0, 2);

  if (!top.length) return "official music video trending 2024";

  if (top.length === 1) {
    return top[0].q;
  }

  // Blend: take core terms from each genre query
  const terms = top.map((c) => c.q.split(" ").slice(0, 3).join(" "));
  return terms.join(" ") + " official music video";
}

/**
 * Return chips reordered by preference score.
 * "For You" and "All" stay pinned at the front; rest sorted by score descending.
 */
export function getOrderedChips(chips: ChipDef[]): ChipDef[] {
  const store = load();
  const pinned = chips.filter((c) => c.label === "For You" || c.label === "All");
  const rest = chips
    .filter((c) => c.label !== "For You" && c.label !== "All")
    .map((c) => ({ chip: c, score: store.scores[c.label] ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.chip);
  return [...pinned, ...rest];
}

/** Clear all feed data (for testing). */
export function resetFeed() {
  localStorage.removeItem(STORAGE_KEY);
}
