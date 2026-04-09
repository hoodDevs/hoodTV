import { TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_BASE } from "./config";
import { withCache } from "./cache";

export interface MediaItem {
  id: string;
  title: string;
  type: "movie" | "tv";
  year?: string;
  releaseDate?: string;
  poster?: string;
  backdrop?: string;
  rating?: number;
  overview?: string;
  genres?: string[];
  runtime?: number;
  tmdbId?: number;
  trailerKey?: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile?: string;
}

export interface Episode {
  id: number;
  name: string;
  episode_number: number;
  season_number: number;
  overview: string;
  still_path?: string;
  air_date?: string;
}

export interface Season {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
}

export interface TitleDetails extends MediaItem {
  cast?: CastMember[];
  similar?: MediaItem[];
  seasons?: Season[];
  episodeCount?: number;
  tagline?: string;
  tmdbRating?: number;
  voteCount?: number;
  imdbId?: string;
}

async function tmdbFetch(path: string): Promise<any> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${TMDB_BASE_URL}${path}${sep}api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB error: ${res.status} ${path}`);
  return res.json();
}


export function posterUrl(path: string | null | undefined, size = "w185") {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}${size}${path}`;
}

export function backdropUrl(path: string | null | undefined, size = "w1280") {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}${size}${path}`;
}

export function profileUrl(path: string | null | undefined, size = "w185") {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}${size}${path}`;
}

function tmdbItemToMedia(item: any, type: "movie" | "tv"): MediaItem {
  const releaseDate = item.release_date || item.first_air_date || undefined;
  return {
    id: String(item.id),
    title: item.title || item.name || "",
    type,
    year: releaseDate?.substring(0, 4) || "",
    releaseDate,
    poster: item.poster_path ? posterUrl(item.poster_path) || undefined : undefined,
    backdrop: item.backdrop_path ? backdropUrl(item.backdrop_path) || undefined : undefined,
    rating: item.vote_average || undefined,
    overview: item.overview || undefined,
    tmdbId: item.id,
  };
}

export async function getTrending(): Promise<MediaItem[]> {
  return withCache("trending_tmdb", async () => {
    const data = await tmdbFetch("/trending/all/week");
    return (data.results || []).map((item: any) =>
      tmdbItemToMedia(item, item.media_type === "tv" ? "tv" : "movie")
    );
  });
}

export async function getMovies(page = 1, genreId?: number): Promise<MediaItem[]> {
  const key = `movies_tmdb_p${page}_g${genreId ?? "all"}`;
  return withCache(key, async () => {
    const genreParam = genreId ? `&with_genres=${genreId}` : "";
    const data = await tmdbFetch(`/discover/movie?sort_by=popularity.desc&page=${page}${genreParam}`);
    return (data.results || []).map((item: any) => tmdbItemToMedia(item, "movie"));
  });
}

export async function getTVShows(page = 1, genreId?: number): Promise<MediaItem[]> {
  const key = `tv_tmdb_p${page}_g${genreId ?? "all"}`;
  return withCache(key, async () => {
    const genreParam = genreId ? `&with_genres=${genreId}` : "";
    const data = await tmdbFetch(`/discover/tv?sort_by=popularity.desc&page=${page}${genreParam}`);
    return (data.results || []).map((item: any) => tmdbItemToMedia(item, "tv"));
  });
}

export async function getNewReleases(): Promise<MediaItem[]> {
  return withCache("new_releases_tmdb", async () => {
    const data = await tmdbFetch("/movie/now_playing?page=1");
    return (data.results || []).map((item: any) => tmdbItemToMedia(item, "movie"));
  });
}

export async function getUpcoming(): Promise<MediaItem[]> {
  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const future = new Date(today);
  future.setMonth(future.getMonth() + 4);
  const to = future.toISOString().slice(0, 10);
  const key = `upcoming_tmdb_${from}`;
  return withCache(key, async () => {
    const data = await tmdbFetch(
      `/discover/movie?sort_by=popularity.desc&primary_release_date.gte=${from}&primary_release_date.lte=${to}&page=1`
    );
    return (data.results || []).map((item: any) => tmdbItemToMedia(item, "movie"));
  });
}

export async function getTopRatedMovies(): Promise<MediaItem[]> {
  return withCache("top_rated_movies_tmdb", async () => {
    const data = await tmdbFetch("/movie/top_rated?page=1");
    return (data.results || []).map((item: any) => tmdbItemToMedia(item, "movie"));
  });
}

export async function getTopRatedTV(): Promise<MediaItem[]> {
  return withCache("top_rated_tv_tmdb", async () => {
    const data = await tmdbFetch("/tv/top_rated?page=1");
    return (data.results || []).map((item: any) => tmdbItemToMedia(item, "tv"));
  });
}

export async function getMoviesByGenre(genreId: number): Promise<MediaItem[]> {
  return withCache(`movies_genre_${genreId}`, async () => {
    const data = await tmdbFetch(`/discover/movie?sort_by=popularity.desc&with_genres=${genreId}&page=1`);
    return (data.results || []).map((item: any) => tmdbItemToMedia(item, "movie"));
  });
}

export async function getTVByGenre(genreId: number): Promise<MediaItem[]> {
  return withCache(`tv_genre_${genreId}`, async () => {
    const data = await tmdbFetch(`/discover/tv?sort_by=popularity.desc&with_genres=${genreId}&page=1`);
    return (data.results || []).map((item: any) => tmdbItemToMedia(item, "tv"));
  });
}

// TMDB genre IDs
export const MOVIE_GENRE_IDS = {
  Action: 28,
  Comedy: 35,
  Horror: 27,
  SciFi: 878,
  Romance: 10749,
  Animation: 16,
  Drama: 18,
  Thriller: 53,
  Crime: 80,
  Documentary: 99,
};

export const TV_GENRE_IDS = {
  Action: 10759,
  Comedy: 35,
  Drama: 18,
  SciFi: 10765,
  Crime: 80,
  Mystery: 9648,
  Animation: 16,
  Reality: 10764,
  Documentary: 99,
};

export async function getSearchSuggestions(query: string): Promise<MediaItem[]> {
  if (!query.trim() || query.length < 2) return [];
  return withCache(`suggest_tmdb_${query.toLowerCase()}`, async () => {
    const data = await tmdbFetch(`/search/multi?query=${encodeURIComponent(query)}&page=1`);
    return (data.results || [])
      .filter((item: any) => item.media_type === "movie" || item.media_type === "tv")
      .slice(0, 6)
      .map((item: any) => tmdbItemToMedia(item, item.media_type === "tv" ? "tv" : "movie"));
  }, 60 * 1000);
}

export async function searchContent(query: string, page = 1): Promise<MediaItem[]> {
  if (!query.trim()) return [];
  return withCache(`search_tmdb_${query.toLowerCase()}_p${page}`, async () => {
    const data = await tmdbFetch(`/search/multi?query=${encodeURIComponent(query)}&page=${page}`);
    return (data.results || [])
      .filter((item: any) => item.media_type === "movie" || item.media_type === "tv")
      .map((item: any) => tmdbItemToMedia(item, item.media_type === "tv" ? "tv" : "movie"));
  }, 2 * 60 * 1000);
}

export async function getTitleDetails(tmdbId: string, type?: "movie" | "tv"): Promise<TitleDetails | null> {
  try {
    let mediaType = type || "movie";

    if (!type) {
      try {
        await tmdbFetch(`/movie/${tmdbId}`);
        mediaType = "movie";
      } catch {
        mediaType = "tv";
      }
    }

    const [details, credits, videos, similar, externalIds] = await Promise.all([
      tmdbFetch(`/${mediaType}/${tmdbId}`),
      tmdbFetch(`/${mediaType}/${tmdbId}/credits`),
      tmdbFetch(`/${mediaType}/${tmdbId}/videos`),
      tmdbFetch(`/${mediaType}/${tmdbId}/similar`),
      tmdbFetch(`/${mediaType}/${tmdbId}/external_ids`).catch(() => ({})),
    ]);

    const trailerKey = videos.results?.find(
      (v: any) => v.type === "Trailer" && v.site === "YouTube"
    )?.key;

    const cast: CastMember[] = (credits.cast || []).slice(0, 15).map((c: any) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profile: profileUrl(c.profile_path) || undefined,
    }));

    const similarItems: MediaItem[] = (similar.results || []).slice(0, 10).map((s: any) =>
      tmdbItemToMedia(s, mediaType as "movie" | "tv")
    );

    const genres = (details.genres || []).map((g: any) => g.name);

    const seasonsList: Season[] = mediaType === "tv"
      ? (details.seasons || [])
          .filter((s: any) => s.season_number > 0)
          .map((s: any) => ({
            id: s.id,
            name: s.name,
            season_number: s.season_number,
            episode_count: s.episode_count,
          }))
      : [];

    return {
      id: String(tmdbId),
      title: details.title || details.name || "",
      type: mediaType as "movie" | "tv",
      year: details.release_date?.substring(0, 4) || details.first_air_date?.substring(0, 4) || "",
      releaseDate: details.release_date || details.first_air_date || undefined,
      poster: details.poster_path ? posterUrl(details.poster_path) || undefined : undefined,
      backdrop: details.backdrop_path ? backdropUrl(details.backdrop_path) || undefined : undefined,
      rating: details.vote_average,
      overview: details.overview,
      genres,
      runtime: details.runtime,
      tmdbId: details.id,
      trailerKey,
      cast,
      similar: similarItems,
      seasons: seasonsList,
      episodeCount: details.number_of_episodes,
      tagline: details.tagline,
      tmdbRating: details.vote_average,
      voteCount: details.vote_count,
      imdbId: externalIds?.imdb_id || undefined,
    };
  } catch (err) {
    console.error("getTitleDetails error:", err);
    return null;
  }
}

export interface Caption {
  language: string;
  url: string;
}

export interface StreamSource {
  name: string;
  url: string;
  source_type: "hls" | "mp4" | "embed";
  captions?: Caption[];
}

export interface StreamResponse {
  sources: StreamSource[];
}

export async function getStreamSources(
  tmdbId: string,
  type: "movie" | "tv",
  season?: number,
  episode?: number,
  meta?: { title?: string; year?: string; imdbId?: string; totalSeasons?: number }
): Promise<StreamSource[]> {
  const s = season ?? 1;
  const e = episode ?? 1;

  const nontongoQs = new URLSearchParams();
  if (meta?.imdbId) nontongoQs.set("imdb_id", meta.imdbId);
  const nontongoQStr = nontongoQs.toString() ? `?${nontongoQs.toString()}` : "";
  const nontongoPath = type === "movie"
    ? `/api/stream/movie/${tmdbId}/nontongo${nontongoQStr}`
    : `/api/stream/tv/${tmdbId}/${s}/${e}/nontongo`;

  const mbQs = new URLSearchParams();
  if (meta?.title) mbQs.set("title", meta.title);
  if (meta?.year)  mbQs.set("year",  meta.year);
  const mbQStr = mbQs.toString() ? `?${mbQs.toString()}` : "";
  const movieboxPath = type === "movie"
    ? `/api/stream/movie/${tmdbId}/moviebox${mbQStr}`
    : `/api/stream/tv/${tmdbId}/${s}/${e}/moviebox${mbQStr}`;

  const [nontongoRes, movieboxRes] = await Promise.allSettled([
    fetch(nontongoPath),
    fetch(movieboxPath),
  ]);

  const nontongoSources: StreamSource[] = [];
  if (nontongoRes.status === "fulfilled" && nontongoRes.value.ok) {
    const data: StreamResponse = await nontongoRes.value.json();
    nontongoSources.push(...(data.sources ?? []));
  }

  const movieboxSources: StreamSource[] = [];
  if (movieboxRes.status === "fulfilled" && movieboxRes.value.ok) {
    const data: StreamResponse = await movieboxRes.value.json();
    movieboxSources.push(...(data.sources ?? []));
  }

  // Order: HLS sources first (NontonGo), then MP4 (MovieBox)
  const allSources = [...nontongoSources, ...movieboxSources];

  if (allSources.length === 0) {
    throw new Error("Stream unavailable — no sources returned");
  }

  return allSources;
}

export async function getSeasonEpisodes(tmdbId: number, season: number): Promise<Episode[]> {
  try {
    const data = await tmdbFetch(`/tv/${tmdbId}/season/${season}`);
    return (data.episodes || []).map((ep: any) => ({
      id: ep.id,
      name: ep.name,
      episode_number: ep.episode_number,
      season_number: ep.season_number,
      overview: ep.overview,
      still_path: ep.still_path ? posterUrl(ep.still_path, "w300") || undefined : undefined,
      air_date: ep.air_date,
    }));
  } catch {
    return [];
  }
}

export async function getTMDBMovieGenres(): Promise<{ id: number; name: string }[]> {
  try {
    const data = await tmdbFetch("/genre/movie/list");
    return data.genres || [];
  } catch {
    return [];
  }
}

export async function getTMDBTVGenres(): Promise<{ id: number; name: string }[]> {
  try {
    const data = await tmdbFetch("/genre/tv/list");
    return data.genres || [];
  } catch {
    return [];
  }
}

