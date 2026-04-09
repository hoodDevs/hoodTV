export interface Track {
  trackId: number;
  videoId: string;
  trackName: string;
  artistName: string;
  artistId: number;
  channelId: string;
  collectionName: string;
  collectionId: number;
  artworkUrl100: string;
  previewUrl: string | null;
  trackTimeMillis: number;
  primaryGenreName: string;
  trackNumber?: number;
  discNumber?: number;
}

export interface Album {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artistId: number;
  artworkUrl100: string;
  releaseDate: string;
  trackCount: number;
  primaryGenreName: string;
}

async function ytFetch(path: string): Promise<any> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`YT Music API ${res.status}`);
  return res.json();
}

export async function searchTracks(term: string, limit = 25): Promise<Track[]> {
  const data = await ytFetch(
    `/api/yt/music/search?q=${encodeURIComponent(term)}&limit=${limit}`
  );
  return data.tracks ?? [];
}

export async function getArtistTopTracks(artistName: string, limit = 15): Promise<Track[]> {
  const data = await ytFetch(
    `/api/yt/music/search?q=${encodeURIComponent(artistName)}&limit=${limit}`
  );
  return data.tracks ?? [];
}

export async function getArtistAlbums(_artistId: number): Promise<Album[]> {
  return [];
}

export async function getAlbumTracks(
  _albumId: number
): Promise<{ album: Album | null; tracks: Track[] }> {
  return { album: null, tracks: [] };
}

export async function getChartTracks(genre: string, limit = 20): Promise<Track[]> {
  return searchTracks(genre, limit);
}

export function artworkUrl(url: string | undefined, size = 300): string {
  if (!url) return "";
  if (url.includes("ytimg.com") || url.includes("lh3.google") || url.includes("yt3.gg")) {
    return url;
  }
  return url.replace(/\d+x\d+bb/, `${size}x${size}bb`);
}

export function fmtDuration(ms: number): string {
  if (!ms) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export const GENRES: { label: string; query: string; color: string }[] = [
  { label: "Hip Hop", query: "hip hop 2024", color: "#e07b54" },
  { label: "Pop", query: "pop hits 2024", color: "#7F77DD" },
  { label: "R&B", query: "rnb soul 2024", color: "#c06090" },
  { label: "Electronic", query: "electronic dance 2024", color: "#54a8e0" },
  { label: "Rock", query: "rock hits 2024", color: "#e05454" },
  { label: "Latin", query: "latin pop 2024", color: "#e0c050" },
];
