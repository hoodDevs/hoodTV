import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Play, Shuffle, Clock } from "lucide-react";
import { getAlbumTracks, artworkUrl, fmtDuration, type Track } from "../lib/musicApi";
import { useMusicPlayer } from "../context/MusicPlayerContext";
import { TrackRow } from "../components/TrackRow";
import { MINI_PLAYER_HEIGHT } from "../components/MiniPlayer";

export function AlbumPage() {
  const { id } = useParams<{ id: string }>();
  const albumId = Number(id);
  const [, navigate] = useLocation();
  const player = useMusicPlayer();

  const { data, isLoading } = useQuery({
    queryKey: ["album-tracks", albumId],
    queryFn: () => getAlbumTracks(albumId),
    staleTime: 15 * 60 * 1000,
  });

  const album = data?.album;
  const tracks: Track[] = data?.tracks ?? [];

  const art = album ? artworkUrl(album.artworkUrl100, 300) : "";
  const totalMs = tracks.reduce((s, t) => s + (t.trackTimeMillis || 0), 0);

  const handlePlay = () => {
    const playable = tracks.filter((t) => t.previewUrl);
    if (playable.length) player.play(playable[0], playable, 0);
  };

  const handleShuffle = () => {
    const playable = tracks.filter((t) => t.previewUrl);
    if (!playable.length) return;
    const idx = Math.floor(Math.random() * playable.length);
    player.play(playable[idx], playable, idx);
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#05050c", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#555", fontFamily: "'DM Sans', sans-serif" }}>Loading…</div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#05050c",
        fontFamily: "'DM Sans', sans-serif",
        paddingBottom: `${MINI_PLAYER_HEIGHT + 24}px`,
      }}
    >
      {/* Hero */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        {art && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${art})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(50px) saturate(1.4)",
              opacity: 0.3,
              transform: "scale(1.15)",
            }}
          />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, #05050c)" }} />
        <div style={{ position: "relative", padding: "24px 32px 36px" }}>
          <button
            onClick={() => window.history.back()}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(0,0,0,0.4)", border: "none",
              color: "#aaa", cursor: "pointer", fontSize: 13,
              borderRadius: 20, padding: "6px 14px", marginBottom: 32,
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
            {art && (
              <img
                src={art}
                alt={album?.collectionName}
                style={{ width: 180, height: 180, borderRadius: 10, objectFit: "cover", boxShadow: "0 12px 40px rgba(0,0,0,0.6)", flexShrink: 0 }}
              />
            )}
            <div>
              <div style={{ fontSize: 11, color: "#9D97E8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                Album
              </div>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, color: "#fff", margin: "0 0 6px", lineHeight: 1.1 }}>
                {album?.collectionName ?? "Album"}
              </h1>
              <button
                onClick={() => navigate(`/music/artist/${album?.artistId}`)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#9D97E8", fontSize: 15, fontWeight: 500, padding: 0, marginBottom: 8,
                }}
              >
                {album?.artistName}
              </button>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 20 }}>
                {album ? new Date(album.releaseDate).getFullYear() : ""} · {tracks.length} tracks · {fmtDuration(totalMs)}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={handlePlay}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "#7F77DD", border: "none", cursor: "pointer",
                    color: "#fff", fontSize: 13, fontWeight: 600,
                    padding: "10px 22px", borderRadius: 24,
                  }}
                >
                  <Play size={16} fill="#fff" strokeWidth={0} />
                  Play
                </button>
                <button
                  onClick={handleShuffle}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "rgba(127,119,221,0.15)", border: "1px solid rgba(127,119,221,0.3)",
                    cursor: "pointer", color: "#9D97E8", fontSize: 13, fontWeight: 500,
                    padding: "10px 22px", borderRadius: 24,
                  }}
                >
                  <Shuffle size={16} />
                  Shuffle
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 32px" }}>
        {/* Track list header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "40px 1fr auto",
            padding: "0 12px 8px",
            borderBottom: "0.5px solid rgba(255,255,255,0.06)",
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 11, color: "#555" }}>#</span>
          <span style={{ fontSize: 11, color: "#555" }}>Title</span>
          <Clock size={13} color="#555" />
        </div>

        {tracks.map((t, i) => (
          <TrackRow key={t.trackId} track={t} index={i} queue={tracks} showAlbum={false} />
        ))}
      </div>
    </div>
  );
}
