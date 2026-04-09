import { useMusicPlayer } from "../context/MusicPlayerContext";
import { artworkUrl, fmtDuration } from "../lib/musicApi";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Shuffle, Repeat, Repeat1,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

export const MINI_PLAYER_HEIGHT = 90;

export function MiniPlayer() {
  const player = useMusicPlayer();
  const [, navigate] = useLocation();
  const [showVolume, setShowVolume] = useState(false);
  const volumeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (volumeRef.current && !volumeRef.current.contains(event.target as Node)) {
        setShowVolume(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!player.currentTrack) return null;

  const { currentTrack: t, isPlaying, progress, duration, volume, shuffle, repeat } = player;

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    player.seek((e.clientX - rect.left) / rect.width);
  };

  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const newVolume = (e.clientX - rect.left) / rect.width;
    player.setVolume(Math.max(0, Math.min(1, newVolume)));
  };

  const art = artworkUrl(t.artworkUrl100, 160);
  const elapsed = fmtDuration(progress * duration * 1000);
  const total = fmtDuration(duration * 1000);

  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const repeatActive = repeat !== "none";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: `${MINI_PLAYER_HEIGHT}px`,
          zIndex: 100,
          background: "linear-gradient(to top, rgba(5,5,12,0.95), rgba(15,15,25,0.85))",
          backdropFilter: "blur(32px) saturate(1.5)",
          WebkitBackdropFilter: "blur(32px) saturate(1.5)",
          borderTop: "1px solid rgba(127,119,221,0.15)",
          boxShadow: "0 -10px 40px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
          gap: "24px",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Track info */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: 0, flex: "0 0 300px", cursor: "pointer" }}
          onClick={() => navigate(`/music/artist/${encodeURIComponent(t.artistName)}`)}
        >
          {art && (
            <div style={{ position: "relative", width: 56, height: 56, borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
              <img
                src={art}
                alt={t.trackName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.3))" }} />
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "0.01em", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
              {t.trackName}
            </div>
            <div style={{ fontSize: 13, color: "#9D97E8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: 0.9 }}>
              {t.artistName}
            </div>
          </div>
        </motion.div>

        {/* Center controls */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <motion.button
              whileHover={{ scale: 1.1, color: shuffle ? "#c0bdf5" : "#fff" }}
              whileTap={{ scale: 0.9 }}
              onClick={player.toggleShuffle}
              style={{ background: "none", border: "none", cursor: "pointer", color: shuffle ? "#7F77DD" : "#666", padding: 0, display: "flex", transition: "color 0.2s" }}
            >
              <Shuffle size={18} strokeWidth={2.5} />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1, color: "#fff" }}
              whileTap={{ scale: 0.9 }}
              onClick={player.prev}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", padding: 0, display: "flex", transition: "color 0.2s" }}
            >
              <SkipBack size={22} strokeWidth={2.5} fill="currentColor" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(127,119,221,0.4)" }}
              whileTap={{ scale: 0.95 }}
              onClick={player.togglePlay}
              style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "linear-gradient(135deg, #e0e0e0, #ffffff)",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              {isPlaying
                ? <Pause size={20} fill="#05050c" color="#05050c" strokeWidth={0} />
                : <Play size={20} fill="#05050c" color="#05050c" strokeWidth={0} style={{ marginLeft: 3 }} />}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1, color: "#fff" }}
              whileTap={{ scale: 0.9 }}
              onClick={player.next}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", padding: 0, display: "flex", transition: "color 0.2s" }}
            >
              <SkipForward size={22} strokeWidth={2.5} fill="currentColor" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1, color: repeatActive ? "#c0bdf5" : "#fff" }}
              whileTap={{ scale: 0.9 }}
              onClick={player.toggleRepeat}
              style={{ background: "none", border: "none", cursor: "pointer", color: repeatActive ? "#7F77DD" : "#666", padding: 0, display: "flex", transition: "color 0.2s" }}
            >
              <RepeatIcon size={18} strokeWidth={2.5} />
            </motion.button>
          </div>

          {/* Progress bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", maxWidth: 600 }}>
            <span style={{ fontSize: 11, color: "#888", minWidth: 40, textAlign: "right", fontWeight: 500 }}>{elapsed}</span>
            <motion.div
              whileHover={{ scaleY: 1.5 }}
              onClick={handleSeekClick}
              style={{
                flex: 1, height: 4, background: "rgba(255,255,255,0.1)",
                borderRadius: 4, cursor: "pointer", position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${progress * 100}%`,
                  background: "linear-gradient(90deg, #7F77DD, #c0bdf5)", 
                  borderRadius: 4,
                  boxShadow: "0 0 10px rgba(127,119,221,0.5)",
                }}
              />
            </motion.div>
            <span style={{ fontSize: 11, color: "#888", minWidth: 40, fontWeight: 500 }}>{total}</span>
          </div>
        </div>

        {/* Volume */}
        <div style={{ flex: "0 0 200px", display: "flex", alignItems: "center", gap: "12px", justifyContent: "flex-end" }} ref={volumeRef}>
          <motion.button
            whileHover={{ scale: 1.1, color: "#fff" }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowVolume((v) => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#888", padding: 0, display: "flex", transition: "color 0.2s" }}
          >
            {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </motion.button>
          
          <div style={{ position: "relative", width: 100 }}>
            <motion.div
              whileHover={{ scaleY: 1.5 }}
              onClick={handleVolumeClick}
              style={{
                width: "100%", height: 4, background: "rgba(255,255,255,0.1)",
                borderRadius: 4, cursor: "pointer", position: "relative",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${volume * 100}%`,
                  background: "#7F77DD", borderRadius: 4,
                }}
              />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
