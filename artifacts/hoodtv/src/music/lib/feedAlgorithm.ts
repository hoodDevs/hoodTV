/**
 * hoodTV Feed Algorithm v3
 *
 * v3 additions over v2:
 *  - Multi-query parallel fetch: buildFeedQueries() returns 2-3 queries
 *    that the home page fires in parallel and interleaves
 *  - Query rotation: feedIteration counter cycles variant suffixes so each
 *    "For You" visit surfaces different videos
 *  - Negative chip signal: switching away from a chip records a mild penalty
 *  - Recency preference: parses publishedAt to learn new-vs-classic taste,
 *    appends year modifiers to queries accordingly
 *  - Watch history dedup: callers can get watchedIds to filter displayed videos
 */

const STORAGE_KEY = "hoodtv_feed_v3";
const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LOG = 300;
const MAX_WATCHED = 150;

export interface ChipDef {
  label: string;
  q: string;
  color?: string;
}

// ──── Genre signal map ─────────────────────────────────────────────────────────

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

// ──── Storage ──────────────────────────────────────────────────────────────────

interface InteractionEntry {
  genre: string;
  points: number; // negative values allowed (penalties)
  ts: number;
}

interface FeedStore {
  log: InteractionEntry[];
  watchedIds: string[];
  authorCounts: Record<string, number>;
  totalInteractions: number;
  feedIteration: number;   // cycles query variant suffixes
  recencyScore: number;    // + = prefers new, - = prefers classic
}

function emptyStore(): FeedStore {
  return {
    log: [], watchedIds: [], authorCounts: {},
    totalInteractions: 0, feedIteration: 0, recencyScore: 0,
  };
}

function load(): FeedStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const p = JSON.parse(raw) as FeedStore;
    return {
      log: p.log ?? [],
      watchedIds: p.watchedIds ?? [],
      authorCounts: p.authorCounts ?? {},
      totalInteractions: p.totalInteractions ?? 0,
      feedIteration: p.feedIteration ?? 0,
      recencyScore: p.recencyScore ?? 0,
    };
  } catch {
    return emptyStore();
  }
}

function save(store: FeedStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    store.log = store.log.slice(-60);
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
  // Floor at 0: negative totals don't invert rankings, they just zero out
  for (const k of Object.keys(scores)) {
    if (scores[k] < 0) scores[k] = 0;
  }
  return scores;
}

function inferGenres(title: string, author: string): Array<{ genre: string; strength: number }> {
  const text = (title + " " + author).toLowerCase();
  const hits: Array<{ genre: string; matchCount: number }> = [];

  for (const [genre, keywords] of Object.entries(GENRE_SIGNALS)) {
    let n = 0;
    for (const kw of keywords) if (text.includes(kw)) n++;
    if (n > 0) hits.push({ genre, matchCount: n });
  }

  if (!hits.length) return [];

  const raw = hits.map((h) => ({ genre: h.genre, strength: Math.sqrt(h.matchCount) }));
  const total = raw.reduce((s, r) => s + r.strength, 0);
  return raw.map((r) => ({ genre: r.genre, strength: (r.strength / total) * 1.5 }));
}

/** Parse publishedAt text ("3 days ago", "2 years ago") → recency signal. */
function parseRecencySignal(publishedAt: string): number {
  if (!publishedAt) return 0;
  const s = publishedAt.toLowerCase();
  if (/hour|day|week/.test(s)) return 1;          // very new → +1
  if (/\d+ month/.test(s)) return 0.5;            // recent-ish → +0.5
  const yMatch = s.match(/(\d+)\s*year/);
  if (yMatch) {
    const yrs = parseInt(yMatch[1]);
    if (yrs <= 2) return 0;
    if (yrs <= 5) return -0.5;
    return -1;                                     // classic → -1
  }
  return 0;
}

// ──── Query building helpers ───────────────────────────────────────────────────

// Suffix variants cycled per feedIteration so each "For You" load feels fresh
const QUERY_VARIANTS = ["official music video", "music video 2024", "new music video", "best music video", "latest music video", "official audio"];

function getVariant(iteration: number): string {
  return QUERY_VARIANTS[iteration % QUERY_VARIANTS.length];
}

function isDiversitySession(iteration: number): boolean {
  return iteration % 4 === 3;
}

function getTopAuthor(store: FeedStore): string | null {
  const entry = Object.entries(store.authorCounts)
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])[0];
  return entry ? entry[0] : null;
}

function recencyModifier(recencyScore: number): string {
  if (recencyScore >= 4) return " new 2025 2024";
  if (recencyScore <= -4) return " classic best";
  return "";
}

// ──── Public API ───────────────────────────────────────────────────────────────

/** Record a chip click (+3 pts to that genre). */
export function recordChipClick(label: string) {
  if (label === "For You" || label === "All") return;
  const store = load();
  store.log.push({ genre: label, points: 3, ts: Date.now() });
  if (store.log.length > MAX_LOG) store.log = store.log.slice(-MAX_LOG);
  store.totalInteractions += 1;
  save(store);
}

/**
 * Mild negative signal when leaving a chip (-0.5 pts).
 * Helps genres you bounce away from lose weight over time.
 */
export function recordChipLeave(label: string) {
  if (label === "For You" || label === "All") return;
  const store = load();
  store.log.push({ genre: label, points: -0.5, ts: Date.now() });
  if (store.log.length > MAX_LOG) store.log = store.log.slice(-MAX_LOG);
  save(store);
}

/** Record a video click. Infers genre, tracks author affinity + recency preference. */
export function recordVideoClick(
  videoId: string,
  title: string,
  author: string,
  publishedAt?: string,
) {
  const store = load();
  if (store.watchedIds.includes(videoId)) return;

  const matches = inferGenres(title, author);
  for (const { genre, strength } of matches) {
    store.log.push({ genre, points: strength, ts: Date.now() });
  }

  // Author affinity
  const normAuthor = author.trim().toLowerCase();
  if (normAuthor.length > 1) {
    store.authorCounts[normAuthor] = Math.min(
      (store.authorCounts[normAuthor] ?? 0) + 1,
      20,
    );
  }

  // Recency preference
  if (publishedAt) {
    store.recencyScore = Math.max(-10, Math.min(10,
      store.recencyScore + parseRecencySignal(publishedAt),
    ));
  }

  if (store.log.length > MAX_LOG) store.log = store.log.slice(-MAX_LOG);
  store.watchedIds = [videoId, ...store.watchedIds].slice(0, MAX_WATCHED);
  store.totalInteractions += 1;
  save(store);
}

/** Increment the query rotation counter — call each time "For You" loads. */
export function incrementFeedIteration() {
  const store = load();
  store.feedIteration = (store.feedIteration + 1) % 100;
  save(store);
}

export function getConfidenceLevel(): 0 | 1 | 2 {
  const { totalInteractions } = load();
  if (totalInteractions < 2) return 0;
  if (totalInteractions < 6) return 1;
  return 2;
}

export function hasFeedData(): boolean {
  return getConfidenceLevel() >= 1;
}

export function getGenreScores(): Record<string, number> {
  return computeDecayedScores(load().log);
}

export function getWatchedIds(): string[] {
  return load().watchedIds;
}

/**
 * Returns 1–3 search queries for the "For You" feed.
 * The home page fires all of them in parallel and interleaves results.
 *
 * Cold  (0): ["trending music video"]
 * Warm  (1): [top genre query]
 * Full  (2): [top genre (+ author/recency), second genre (+ diversity), trending freshener]
 */
export function buildFeedQueries(chips: ChipDef[]): string[] {
  const store = load();
  const level = getConfidenceLevel();

  if (level === 0) return ["trending official music video 2024"];

  const scores = computeDecayedScores(store.log);
  const recMod = recencyModifier(store.recencyScore);

  interface SC { label: string; q: string; score: number; share: number }

  const totalScore = Object.values(scores).reduce((s, v) => s + v, 0);
  const ranked: SC[] = chips
    .filter((c) => c.label !== "For You" && c.label !== "All")
    .map((c) => ({ label: c.label, q: c.q, score: scores[c.label] ?? 0, share: 0 }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((c) => ({ ...c, share: totalScore > 0 ? c.score / totalScore : 0 }));

  if (!ranked.length) return [`trending official music video 2024${recMod}`];

  // Warming up: just the top genre
  if (level === 1) return [ranked[0].q + recMod];

  // ── Fully personalised ─────────────────────────────────────────────────────
  const variant = getVariant(store.feedIteration);
  const topAuthor = getTopAuthor(store);
  const isDiversity = isDiversitySession(store.feedIteration);

  const queries: string[] = [];

  // ① Primary: author-boosted if available, else top genre + variant + recency
  if (topAuthor) {
    queries.push(`${topAuthor} official music video`);
  } else {
    queries.push(`${ranked[0].q}${recMod} ${variant}`.trim());
  }

  // ② Secondary: diversity swaps 2nd → 3rd genre; else just 2nd genre
  const secondGenre = isDiversity && ranked[2] ? ranked[2] : ranked[1];
  if (secondGenre) {
    queries.push(secondGenre.q + recMod);
  }

  // ③ Freshener: trending to ensure the feed doesn't go stale
  queries.push(`new music video ${new Date().getFullYear()}`);

  return queries;
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
