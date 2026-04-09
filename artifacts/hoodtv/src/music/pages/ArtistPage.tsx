import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Play, Shuffle } from "lucide-react";
import { searchTracks, artworkUrl, type Track } from "../lib/musicApi";
import { useMusicPlayer } from "../context/MusicPlayerContext";
import { TrackRow } from "../components/TrackRow";
import { MINI_PLAYER_HEIGHT } from "../components/MiniPlayer";

export function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const artistName = decodeURIComponent(id ?? "");
  const [, navigate] = useLocation();
  const player = useMusicPlayer();

  const { data: tracks = [], isLoading } = useQuery<Track[]>({
    queryKey: ["artist-tracks", artistName],
    queryFn: () => searchTracks(artistName, 20),
    staleTime: 10 * 60 * 1000,
    enabled: !!artistName,
  });

  const art = tracks[0]?.artworkUrl100 ? artworkUrl(tracks[0].artworkUrl100, 300) : "";

  const handlePlayAll = () => {
    const playable = tracks.filter((t) => t.previewUrl);
    if (playable.length) player.play(playable[0], playable, 0);
  };

  const handleShuffle = () => {
    const playable = tracks.filter((t) => t.previewUrl);
    if (!playable.length) return;
    const idx = Math.floor(Math.random() * playable.length);
    player.play(playable[idx], playable, idx);
  };

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
      <div style={{ position: "relative", minHeight: 280, overflow: "hidden" }}>
        {art && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${art})`,
              backgroundSize: "cover",
              backgroundPosition: "center top",
              filter: "blur(40px) saturate(1.4)",
              opacity: 0.3,
              transform: "scale(1.1)",
            }}
          />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, #05050c)" }} />
        <div style={{ position: "relative", padding: "24px 32px 32px" }}>
          <button
            onClick={() => navigate("/music")}
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
                alt={artistName}
                style={{ width: 130, height: 130, borderRadius: "50%", objectFit: "cover", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", flexShrink: 0 }}
              />
            )}
            <div>
              <div style={{ fontSize: 11, color: "#9D97E8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Artist</div>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: "#fff", margin: "0 0 16px" }}>
                {artistName}
              </h1>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={handlePlayAll}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "#7F77DD", border: "none", cursor: "pointer",
                    color: "#fff", fontSize: 13, fontWeight: 600,
                    padding: "10px 22px", borderRadius: 24,
                  }}
                >
                  <Play size={16} fill="#fff" strokeWidth={0} />
                  Play All
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
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "#f0f0f0", letterSpacing: "0.04em", marginBottom: 12 }}>
          Top Tracks
        </h2>
        {isLoading ? (
          <div style={{ color: "#555", fontSize: 13 }}>Loading…</div>
        ) : tracks.length === 0 ? (
          <div style={{ color: "#555", fontSize: 13 }}>No tracks found.</div>
        ) : (
          tracks.map((t, i) => (
            <TrackRow key={t.trackId} track={t} index={i} queue={tracks} showAlbum />
          ))
        )}
      </div>
    </div>
  );
}
