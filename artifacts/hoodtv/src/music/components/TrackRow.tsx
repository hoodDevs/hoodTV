import { Play, Pause, MonitorPlay } from "lucide-react";
import { useMusicPlayer } from "../context/MusicPlayerContext";
import { artworkUrl, fmtDuration, type Track } from "../lib/musicApi";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

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
    <motion.div
      whileHover={{ scale: track.previewUrl ? 1.01 : 1, backgroundColor: "rgba(255,255,255,0.05)" }}
      whileTap={{ scale: track.previewUrl ? 0.99 : 1 }}
      onClick={handlePlay}
      style={{
        display: "grid",
        gridTemplateColumns: showArt
          ? "48px 56px 1fr auto 40px"
          : showAlbum
          ? "48px 1fr 1fr auto 40px"
          : "48px 1fr auto 40px",
        alignItems: "center",
        gap: "16px",
        padding: "8px 16px",
        borderRadius: 12,
        cursor: track.previewUrl ? "pointer" : "default",
        background: isActive ? "linear-gradient(90deg, rgba(127,119,221,0.15), rgba(127,119,221,0.05))" : "transparent",
        border: isActive ? "1px solid rgba(127,119,221,0.2)" : "1px solid transparent",
        transition: "all 0.2s ease-out",
        color: isActive ? "#c0bdf5" : "#aaa",
        opacity: track.previewUrl ? 1 : 0.4,
        position: "relative",
        overflow: "hidden"
      }}
      className="group"
    >
      {/* Active Indicator Bar */}
      {isActive && (
        <motion.div 
          layoutId="activeTrackIndicator"
          style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 3, background: "#7F77DD", borderRadius: "0 4px 4px 0" }} 
        />
      )}

      {/* Index / play icon */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48 }}>
        {isPlaying ? (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
            <Pause size={18} fill="#9D97E8" color="#9D97E8" strokeWidth={0} />
          </motion.div>
        ) : isActive ? (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
            <Play size={18} fill="#9D97E8" color="#9D97E8" strokeWidth={0} />
          </motion.div>
        ) : (
          <span style={{ fontSize: 14, color: "#666", fontWeight: 500, fontFamily: "monospace" }}>
            {index !== undefined ? String(index + 1).padStart(2, '0') : ""}
          </span>
        )}
      </div>

      {/* Album art */}
      {showArt && (
        <div style={{ position: "relative", width: 56, height: 56, borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 10px rgba(0,0,0,0.3)" }}>
          <img
            src={artworkUrl(track.artworkUrl100, 112)}
            alt={track.trackName}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy"
          />
        </div>
      )}

      {/* Track name + artist */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: isActive ? 600 : 500,
            color: isActive ? "#fff" : "#e8e8e8",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            letterSpacing: "0.01em",
            marginBottom: 2
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
            fontSize: 13,
            color: "#888",
            textAlign: "left",
            transition: "color 0.2s",
          }}
          className="hover:text-[#9D97E8]"
          onClick={goToArtist}
        >
          {track.artistName}
        </button>
      </div>

      {/* Album name */}
      {showAlbum && !showArt && (
        <span
          style={{
            fontSize: 13,
            color: "#666",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {track.collectionName}
        </span>
      )}

      {/* Duration */}
      <div style={{ fontSize: 13, color: "#666", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {fmtDuration(track.trackTimeMillis)}
      </div>

      {/* Watch MV */}
      <motion.button
        whileHover={{ scale: 1.1, backgroundColor: "rgba(127,119,221,0.15)" }}
        whileTap={{ scale: 0.9 }}
        title="Find music video"
        onClick={handleWatchMV}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: isActive ? "#7F77DD" : "#555",
          width: 36,
          height: 36,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s",
        }}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        <MonitorPlay size={16} />
      </motion.button>
    </motion.div>
  );
}
