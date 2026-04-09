import { MonitorPlay } from "lucide-react";
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

export function TrackRow({ track, index, showArt = false, showAlbum = true }: Props) {
  const [, navigate] = useLocation();

  const handleClick = () => {
    const q = encodeURIComponent(`${track.artistName} ${track.trackName}`);
    navigate(`/music/videos?q=${q}`);
  };

  const goToArtist = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/music/artist/${encodeURIComponent(track.artistName)}`);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.05)" }}
      whileTap={{ scale: 0.99 }}
      onClick={handleClick}
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
        cursor: "pointer",
        background: "transparent",
        border: "1px solid transparent",
        transition: "all 0.2s ease-out",
        position: "relative",
        overflow: "hidden",
      }}
      className="group"
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48 }}>
        <span style={{ fontSize: 14, color: "#666", fontWeight: 500, fontFamily: "monospace" }}>
          {index !== undefined ? String(index + 1).padStart(2, "0") : ""}
        </span>
      </div>

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

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: "#e8e8e8",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            letterSpacing: "0.01em",
            marginBottom: 2,
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

      <div style={{ fontSize: 13, color: "#666", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {fmtDuration(track.trackTimeMillis)}
      </div>

      <motion.button
        whileHover={{ scale: 1.1, backgroundColor: "rgba(127,119,221,0.15)" }}
        whileTap={{ scale: 0.9 }}
        title="Find music video"
        onClick={(e) => { e.stopPropagation(); handleClick(); }}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#555",
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
