import { useMusicPlayer } from "../context/MusicPlayerContext";
import { artworkUrl, fmtDuration } from "../lib/musicApi";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Shuffle, Repeat, Repeat1, ChevronUp,
} from "lucide-react";
import { useState, useRef } from "react";
import { useLocation } from "wouter";

export const MINI_PLAYER_HEIGHT = 80;

export function MiniPlayer() {
  const player = useMusicPlayer();
  const [, navigate] = useLocation();
  const [showVolume, setShowVolume] = useState(false);
  const seekRef = useRef<HTMLDivElement>(null);

  if (!player.currentTrack) return null;

  const { currentTrack: t, isPlaying, progress, duration, volume, shuffle, repeat } = player;

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    player.seek((e.clientX - rect.left) / rect.width);
  };

  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    player.setVolume((e.clientX - rect.left) / rect.width);
  };

  const art = artworkUrl(t.artworkUrl100, 80);
  const elapsed = fmtDuration(progress * duration * 1000);
  const total = fmtDuration(duration * 1000);

  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const repeatActive = repeat !== "none";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: `${MINI_PLAYER_HEIGHT}px`,
        zIndex: 100,
        background: "rgba(10,10,18,0.97)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "0.5px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: "16px",
      }}
    >
      {/* Track info */}
      <div
        style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: "0 0 260px", cursor: "pointer" }}
        onClick={() => navigate(`/music/album/${t.collectionId}`)}
      >
        <img
          src={art}
          alt={t.collectionName}
          style={{ width: 46, height: 46, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#f0f0f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {t.trackName}
          </div>
          <div style={{ fontSize: 11.5, color: "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {t.artistName}
          </div>
        </div>
      </div>

      {/* Center controls */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <button
            onClick={player.toggleShuffle}
            style={{ background: "none", border: "none", cursor: "pointer", color: shuffle ? "#9D97E8" : "#555", padding: 0, display: "flex" }}
          >
            <Shuffle size={15} />
          </button>
          <button
            onClick={player.prev}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", padding: 0, display: "flex" }}
          >
            <SkipBack size={18} strokeWidth={2} />
          </button>
          <button
            onClick={player.togglePlay}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "#fff", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {isPlaying
              ? <Pause size={16} fill="#000" color="#000" strokeWidth={0} />
              : <Play size={16} fill="#000" color="#000" strokeWidth={0} style={{ marginLeft: 2 }} />}
          </button>
          <button
            onClick={player.next}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", padding: 0, display: "flex" }}
          >
            <SkipForward size={18} strokeWidth={2} />
          </button>
          <button
            onClick={player.toggleRepeat}
            style={{ background: "none", border: "none", cursor: "pointer", color: repeatActive ? "#9D97E8" : "#555", padding: 0, display: "flex" }}
          >
            <RepeatIcon size={15} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", maxWidth: 500 }}>
          <span style={{ fontSize: 10, color: "#555", minWidth: 30, textAlign: "right" }}>{elapsed}</span>
          <div
            ref={seekRef}
            onClick={handleSeekClick}
            style={{
              flex: 1, height: 3, background: "rgba(255,255,255,0.12)",
              borderRadius: 2, cursor: "pointer", position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${progress * 100}%`,
                background: "#9D97E8", borderRadius: 2,
                transition: "width 0.1s linear",
              }}
            />
          </div>
          <span style={{ fontSize: 10, color: "#555", minWidth: 30 }}>{total}</span>
        </div>
      </div>

      {/* Volume */}
      <div style={{ flex: "0 0 140px", display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
        <button
          onClick={() => setShowVolume((v) => !v)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#555", padding: 0, display: "flex" }}
        >
          {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <div
          onClick={handleVolumeClick}
          style={{
            width: 80, height: 3, background: "rgba(255,255,255,0.12)",
            borderRadius: 2, cursor: "pointer", position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: `${volume * 100}%`,
              background: "#7F77DD", borderRadius: 2,
            }}
          />
        </div>
      </div>
    </div>
  );
}
