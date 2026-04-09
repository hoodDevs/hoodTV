const ITUNES = "https://itunes.apple.com";

export interface Track {
  trackId: number;
  trackName: string;
  artistName: string;
  artistId: number;
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

async function itunesFetch(path: string): Promise<any> {
  const res = await fetch(`${ITUNES}${path}`);
  if (!res.ok) throw new Error(`iTunes API ${res.status}`);
  return res.json();
}

export async function searchTracks(term: string, limit = 25): Promise<Track[]> {
  const data = await itunesFetch(
    `/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`
  );
  return (data.results || []).filter((r: any) => r.wrapperType === "track");
}

export async function getArtistTopTracks(artistId: number, limit = 15): Promise<Track[]> {
  const data = await itunesFetch(
    `/lookup?id=${artistId}&entity=song&limit=${limit + 1}`
  );
  return (data.results || []).filter((r: any) => r.wrapperType === "track").slice(0, limit);
}

export async function getArtistAlbums(artistId: number): Promise<Album[]> {
  const data = await itunesFetch(`/lookup?id=${artistId}&entity=album&limit=25`);
  return (data.results || []).filter((r: any) => r.wrapperType === "collection");
}

export async function getAlbumTracks(albumId: number): Promise<{ album: Album | null; tracks: Track[] }> {
  const data = await itunesFetch(`/lookup?id=${albumId}&entity=song`);
  const results = data.results || [];
  const album = results.find((r: any) => r.wrapperType === "collection") ?? null;
  const tracks = results
    .filter((r: any) => r.wrapperType === "track")
    .sort((a: any, b: any) => (a.discNumber - b.discNumber) || (a.trackNumber - b.trackNumber));
  return { album, tracks };
}

export async function getChartTracks(genre: string, limit = 20): Promise<Track[]> {
  return searchTracks(genre, limit);
}

export function artworkUrl(url: string | undefined, size = 300): string {
  if (!url) return "";
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
