/**
 * hoodTV Feed Algorithm v2
 *
 * Key improvements over v1:
 *  - Time-decay: interactions lose weight exponentially (half-life 7 days)
 *  - Multi-genre matching: one video can score across multiple genres
 *  - Author affinity: tracks clicked artists, boosts their content in queries
 *  - Score-weighted blending: dominant genres get proportionally more query weight
 *  - Diversity injection: periodically surfaces a non-dominant genre
 *  - Bounded storage: interaction log capped at 200 entries
 *  - Confidence staging: feed personalises gradually as signal accumulates
 */

const STORAGE_KEY = "hoodtv_feed_v2";
const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_LOG = 200;
const MAX_WATCHED = 100;

export interface ChipDef {
  label: string;
  q: string;
  color?: string;
}

// ──── Genre signal map ─────────────────────────────────────────────────────────
// Each entry is an array of substrings matched against (title + author).toLowerCase()
// Longer, more specific strings are matched first within the loop.

const GENRE_SIGNALS: Record<string, string[]> = {
  "Hip Hop": [
    "hip-hop", "hip hop", "rap god", "freestyle", "21 savage", "travis scott",
    "kendrick lamar", "j. cole", "j cole", "nicki minaj", "cardi b", "eminem",
    "lil baby", "lil uzi", "lil durk", "lil wayne", "young thug", "gunna",
    "future", "meek mill", "a$ap rocky", "asap rocky", "post malone",
    "chance the rapper", "mac miller", "biggie", "tupac", "nas", "jay-z",
    "kanye west", "drake", "snoop dogg", "ice cube", "doja cat",
    "roddy ricch", "polo g", "dababy", "da baby", "trippie redd",
    "blueface", "nba youngboy", "kodak black", "ddg", "fivio foreign",
    "trap", "drill", "rap",
  ],
  "Pop": [
    "taylor swift", "ariana grande", "dua lipa", "billie eilish",
    "the weeknd", "harry styles", "olivia rodrigo", "selena gomez",
    "ed sheeran", "charlie puth", "sabrina carpenter", "lizzo",
    "miley cyrus", "katy perry", "lady gaga", "rihanna", "beyoncé", "beyonce",
    "shawn mendes", "camila cabello", "5 seconds of summer", "one direction",
    "bts", "blackpink", "twice", "exo", "stray kids",
    "justin bieber", "jonas brothers", "nick jonas",
    "lorde", "halsey", "anne-marie", "bebe rexha",
    "pop music", "pop hit", "pop video",
  ],
  "R&B": [
    "neo soul", "r&b", "rnb", "r&amp;b",
    "frank ocean", "daniel caesar", "h.e.r.", "h.e.r", "brent faiyaz",
    "summer walker", "jhene aiko", "kehlani", "tinashe", "ella mai",
    "bryson tiller", "partynextdoor", "pnd", "sza", "usher",
    "alicia keys", "john legend", "marvin gaye", "stevie wonder",
    "tory lanez", "jeremih", "giveon", "lucky daye",
    "ari lennox", "snoh aalegra", "tobi lou", "mahalia",
    "soul", "groove",
  ],
  "Electronic": [
    "avicii", "skrillex", "marshmello", "deadmau5", "calvin harris",
    "tiesto", "martin garrix", "alan walker", "diplo", "zedd",
    "the chainsmokers", "kygo", "illenium", "flume", "porter robinson",
    "madeon", "eric prydz", "afrojack", "hardwell", "armin van buuren",
    "daft punk", "kraftwerk", "disclosure", "four tet",
    "edm", "electronic", "techno", "house music", "trance",
    "drum and bass", "dnb", "dubstep", "synthwave", "lo-fi beats",
    "dance music", "club", "rave", "dj set", "remix",
  ],
  "Rock": [
    "nirvana", "linkin park", "foo fighters", "imagine dragons",
    "arctic monkeys", "green day", "red hot chili peppers", "rhcp",
    "twenty one pilots", "fall out boy", "panic! at the disco",
    "my chemical romance", "mcr", "paramore", "evanescence",
    "ac/dc", "metallica", "slipknot", "system of a down",
    "radiohead", "the strokes", "kings of leon", "the killers",
    "muse", "30 seconds to mars", "three days grace",
    "breaking benjamin", "disturbed", "asking alexandria",
    "bring me the horizon", "pierce the veil",
    "rock music", "metal", "punk", "alternative", "indie rock", "grunge", "hard rock",
  ],
  "Mood & Sound": [
    "lofi hip hop", "lo-fi hip hop", "lofi beats", "chill beats",
    "study music", "relaxing music", "sleep music", "focus music",
    "ambient", "meditation", "piano", "acoustic", "instrumental",
    "jazz", "bossa nova", "classical",
    "lofi", "lo-fi", "chillhop", "chillwave", "vaporwave",
    "coffee shop", "rain sounds", "nature sounds", "wave", "vibes",
  ],
};

// ──── Storage types ────────────────────────────────────────────────────────────

interface InteractionEntry {
  genre: string;
  points: number;
  ts: number;
}

interface FeedStore {
  log: InteractionEntry[];
  watchedIds: string[];
  authorCounts: Record<string, number>;
  totalInteractions: number;
}

function emptyStore(): FeedStore {
  return { log: [], watchedIds: [], authorCounts: {}, totalInteractions: 0 };
}

function load(): FeedStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as FeedStore;
    return {
      log: parsed.log ?? [],
      watchedIds: parsed.watchedIds ?? [],
      authorCounts: parsed.authorCounts ?? {},
      totalInteractions: parsed.totalInteractions ?? 0,
    };
  } catch {
    return emptyStore();
  }
}

function save(store: FeedStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded — trim log and retry once
    store.log = store.log.slice(-50);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* give up */ }
  }
}

// ──── Core maths ───────────────────────────────────────────────────────────────

function decayFactor(ts: number): number {
  return Math.pow(0.5, (Date.now() - ts) / HALF_LIFE_MS);
}

function computeDecayedScores(log: InteractionEntry[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const { genre, points, ts } of log) {
    scores[genre] = (scores[genre] ?? 0) + points * decayFactor(ts);
  }
  return scores;
}

/**
 * Infer genre(s) from video metadata.
 * Returns scored matches across ALL genres (not just the first hit).
 * When multiple genres match, points are divided proportionally.
 */
function inferGenres(title: string, author: string): Array<{ genre: string; strength: number }> {
  const text = (title + " " + author).toLowerCase();
  const hits: Array<{ genre: string; matchCount: number }> = [];

  for (const [genre, keywords] of Object.entries(GENRE_SIGNALS)) {
    let matchCount = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) matchCount++;
    }
    if (matchCount > 0) hits.push({ genre, matchCount });
  }

  if (!hits.length) return [];

  // Strength = sqrt(matchCount) to reward more signals but with diminishing returns
  const raw = hits.map((h) => ({ genre: h.genre, strength: Math.sqrt(h.matchCount) }));
  const total = raw.reduce((s, r) => s + r.strength, 0);

  // Normalize so total strength across all genres = 1.5 per video click
  return raw.map((r) => ({ genre: r.genre, strength: (r.strength / total) * 1.5 }));
}

// ──── Diversity injection ──────────────────────────────────────────────────────

/**
 * Returns true on ~25% of days (deterministic per calendar day).
 * This lets the feed occasionally surface a non-dominant genre.
 */
function isDiversityDay(): boolean {
  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return dayIndex % 4 === 0;
}

// ──── Public API ───────────────────────────────────────────────────────────────

/** Record a chip click. Chip clicks carry more weight than video views. */
export function recordChipClick(label: string) {
  if (label === "For You" || label === "All") return;
  const store = load();
  store.log.push({ genre: label, points: 3, ts: Date.now() });
  if (store.log.length > MAX_LOG) store.log = store.log.slice(-MAX_LOG);
  store.totalInteractions += 1;
  save(store);
}

/** Record a video click — infers genres from title/author, tracks author affinity. */
export function recordVideoClick(videoId: string, title: string, author: string) {
  const store = load();

  // Deduplicate within last 100 watched
  if (store.watchedIds.includes(videoId)) return;

  const matches = inferGenres(title, author);

  for (const { genre, strength } of matches) {
    store.log.push({ genre, points: strength, ts: Date.now() });
  }

  // Author affinity: normalise the author name
  const normAuthor = author.trim().toLowerCase();
  if (normAuthor && normAuthor.length > 1) {
    store.authorCounts[normAuthor] = (store.authorCounts[normAuthor] ?? 0) + 1;
    // Cap individual author counts to avoid runaway scores
    if (store.authorCounts[normAuthor] > 20) store.authorCounts[normAuthor] = 20;
  }

  if (store.log.length > MAX_LOG) store.log = store.log.slice(-MAX_LOG);
  store.watchedIds = [videoId, ...store.watchedIds].slice(0, MAX_WATCHED);
  store.totalInteractions += 1;
  save(store);
}

/**
 * Confidence levels:
 *  0 = cold start (< 2 interactions)
 *  1 = warming up (2-7)
 *  2 = personalised (8+)
 */
export function getConfidenceLevel(): 0 | 1 | 2 {
  const { totalInteractions } = load();
  if (totalInteractions < 2) return 0;
  if (totalInteractions < 8) return 1;
  return 2;
}

export function hasFeedData(): boolean {
  return getConfidenceLevel() >= 1;
}

/** Returns decayed genre scores. */
export function getGenreScores(): Record<string, number> {
  const store = load();
  return computeDecayedScores(store.log);
}

/** Returns recently watched video IDs. */
export function getWatchHistory(): string[] {
  return load().watchedIds;
}

/**
 * Build the search query for the "For You" feed.
 *
 * Stages:
 *  Cold (0):  trending default
 *  Warming (1): top 1 genre only
 *  Personalised (2): score-weighted blend of top 2-3 genres + optional author boost
 *                    with periodic diversity injection
 */
export function buildFeedQuery(chips: ChipDef[]): string {
  const store = load();
  const level = getConfidenceLevel();

  if (level === 0) {
    return "official music video trending 2024";
  }

  const scores = computeDecayedScores(store.log);
  const totalScore = Object.values(scores).reduce((s, v) => s + v, 0);

  interface ScoredChip { label: string; q: string; score: number; share: number }

  const scoredChips: ScoredChip[] = chips
    .filter((c) => c.label !== "For You" && c.label !== "All")
    .map((c) => ({ label: c.label, q: c.q, score: scores[c.label] ?? 0, share: 0 }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((c) => ({ ...c, share: totalScore > 0 ? c.score / totalScore : 0 }));

  if (!scoredChips.length) return "official music video trending 2024";

  // Warming-up: just use the single top genre
  if (level === 1) {
    return scoredChips[0].q;
  }

  // ── Fully personalised ─────────────────────────────────────────────────────

  const top = scoredChips[0];
  const second = scoredChips[1];
  const third = scoredChips[2];

  // Diversity injection: on diversity days, swap 2nd slot for a lower-ranked genre
  let secondSlot = second;
  if (isDiversityDay() && third && second) {
    secondSlot = third; // surface the 3rd genre instead
  }

  // Author affinity: pick the top author clicked 3+ times (using original casing lost, so lowercase)
  const topAuthorEntry = Object.entries(store.authorCounts)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])[0];
  const topAuthor = topAuthorEntry ? topAuthorEntry[0] : null;

  // Build the blended query
  const topTerms = top.q.split(" ");

  // Dominant genre (>70%): single-genre query, optionally author-boosted
  if (top.share > 0.7 || !secondSlot) {
    const base = topTerms.slice(0, 4).join(" ");
    if (topAuthor) return `${topAuthor} ${base}`;
    return top.q;
  }

  // Blended: weight term counts by score share
  // e.g. top=60% → 4 terms, second=40% → 3 terms
  const topCount = top.share > 0.55 ? 4 : 3;
  const secondCount = top.share > 0.55 ? 2 : 3;

  const secondTerms = secondSlot.q.split(" ");
  const blended = [
    ...topTerms.slice(0, topCount),
    ...secondTerms.slice(0, secondCount),
    "official music video",
  ].join(" ");

  // Author boost: prepend top author if they haven't already appeared in the query
  if (topAuthor && !blended.toLowerCase().includes(topAuthor)) {
    return `${topAuthor} ${blended}`;
  }

  return blended;
}

/**
 * Return chips reordered by decayed preference score.
 * "For You" and "All" are always pinned first.
 */
export function getOrderedChips(chips: ChipDef[]): ChipDef[] {
  const scores = computeDecayedScores(load().log);
  const pinned = chips.filter((c) => c.label === "For You" || c.label === "All");
  const rest = chips
    .filter((c) => c.label !== "For You" && c.label !== "All")
    .map((c) => ({ chip: c, score: scores[c.label] ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.chip);
  return [...pinned, ...rest];
}

/** Clear all feed data. */
export function resetFeed() {
  localStorage.removeItem(STORAGE_KEY);
}
