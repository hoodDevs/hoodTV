import { Play, Pause, MonitorPlay } from "lucide-react";
import { useMusicPlayer } from "../context/MusicPlayerContext";
import { artworkUrl, fmtDuration, type Track } from "../lib/musicApi";
import { useLocation } from "wouter";

interface Props {
  track: Track;
  index?: number;
  queue: Track[];
  showArt?: boolean;
  showAlbum?: boolean;
}

export function TrackRow({ track, index, queue, showArt = false, showAlbum = true }: Props) {
  const player = useMusicPlayer();
  const [, navigate] = useLocation();

  const isActive = player.currentTrack?.trackId === track.trackId;
  const isPlaying = isActive && player.isPlaying;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!track.previewUrl) return;
    if (isActive) {
      player.togglePlay();
    } else {
      const idx = queue.findIndex((t) => t.trackId === track.trackId);
      player.play(track, queue, idx >= 0 ? idx : 0);
    }
  };

  const handleWatchMV = (e: React.MouseEvent) => {
    e.stopPropagation();
    const q = encodeURIComponent(`${track.artistName} ${track.trackName}`);
    navigate(`/music/videos?q=${q}`);
  };

  const goToArtist = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/music/artist/${encodeURIComponent(track.artistName)}`);
  };

  return (
    <div
      onClick={handlePlay}
      style={{
        display: "grid",
        gridTemplateColumns: showArt
          ? "40px 46px 1fr auto 28px"
          : showAlbum
          ? "40px 1fr 1fr auto 28px"
          : "40px 1fr auto 28px",
        alignItems: "center",
        gap: "12px",
        padding: "6px 12px",
        borderRadius: 8,
        cursor: track.previewUrl ? "pointer" : "default",
        background: isActive ? "rgba(127,119,221,0.08)" : "transparent",
        transition: "background 0.15s",
        color: isActive ? "#c0bdf5" : "#aaa",
        opacity: track.previewUrl ? 1 : 0.4,
      }}
      className="track-row"
    >
      {/* Index / play icon */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28 }}>
        {isPlaying ? (
          <Pause size={14} fill="#9D97E8" color="#9D97E8" strokeWidth={0} />
        ) : isActive ? (
          <Play size={14} fill="#9D97E8" color="#9D97E8" strokeWidth={0} />
        ) : (
          <span style={{ fontSize: 12, color: "#555" }}>{index !== undefined ? index + 1 : ""}</span>
        )}
      </div>

      {/* Album art */}
      {showArt && (
        <img
          src={artworkUrl(track.artworkUrl100, 46)}
          alt={track.trackName}
          style={{ width: 46, height: 46, borderRadius: 4, objectFit: "cover" }}
        />
      )}

      {/* Track name + artist */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: isActive ? "#c0bdf5" : "#e8e8e8",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {track.trackName}
        </div>
        <button
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontSize: 12,
            color: "#666",
            textAlign: "left",
          }}
          onClick={goToArtist}
        >
          {track.artistName}
        </button>
      </div>

      {/* Album name (plain text — YouTube has no real album IDs) */}
      {showAlbum && !showArt && (
        <span
          style={{
            fontSize: 12,
            color: "#555",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {track.collectionName}
        </span>
      )}

      {/* Duration */}
      <div style={{ fontSize: 12, color: "#555", textAlign: "right" }}>
        {fmtDuration(track.trackTimeMillis)}
      </div>

      {/* Watch MV */}
      <button
        title="Find music video"
        onClick={handleWatchMV}
        className="mv-btn"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#333",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "color 0.15s",
        }}
      >
        <MonitorPlay size={14} />
      </button>

      <style>{`
        .track-row:hover { background: rgba(255,255,255,0.04) !important; }
        .track-row:hover .mv-btn { color: #7F77DD !important; }
      `}</style>
    </div>
  );
}
