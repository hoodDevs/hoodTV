import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Play } from "lucide-react";
import { searchTracks, type Track } from "../lib/musicApi";
import { useMusicPlayer } from "../context/MusicPlayerContext";
import { TrackRow } from "../components/TrackRow";
import { MINI_PLAYER_HEIGHT } from "../components/MiniPlayer";

export function GenrePage() {
  const { query } = useParams<{ query: string }>();
  const [location, navigate] = useLocation();
  const player = useMusicPlayer();

  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const label = params.get("label") ?? decodeURIComponent(query ?? "");

  const { data: tracks = [], isLoading } = useQuery<Track[]>({
    queryKey: ["genre-tracks", query],
    queryFn: () => searchTracks(decodeURIComponent(query ?? ""), 30),
    staleTime: 10 * 60 * 1000,
  });

  const handlePlayAll = () => {
    const playable = tracks.filter((t) => t.previewUrl);
    if (playable.length) player.play(playable[0], playable, 0);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#05050c",
        fontFamily: "'DM Sans', sans-serif",
        padding: "28px 32px",
        paddingBottom: `${MINI_PLAYER_HEIGHT + 24}px`,
      }}
    >
      <button
        onClick={() => navigate("/music")}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(255,255,255,0.05)", border: "none",
          color: "#aaa", cursor: "pointer", fontSize: 13,
          borderRadius: 20, padding: "6px 14px", marginBottom: 28,
        }}
      >
        <ArrowLeft size={14} /> Back
      </button>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, color: "#fff", letterSpacing: "0.04em" }}>
          {label}
        </h1>
        {tracks.length > 0 && (
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
        )}
      </div>

      {isLoading ? (
        <div style={{ color: "#555", fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
          {tracks.map((t, i) => (
            <TrackRow key={t.trackId} track={t} index={i} queue={tracks} showArt />
          ))}
        </div>
      )}
    </div>
  );
}
