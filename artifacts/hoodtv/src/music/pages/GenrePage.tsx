import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { searchTracks, type Track } from "../lib/musicApi";
import { TrackRow } from "../components/TrackRow";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function GenrePage() {
  const { query } = useParams<{ query: string }>();
  const [location, navigate] = useLocation();

  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const label = params.get("label") ?? decodeURIComponent(query ?? "");

  const { data: tracks = [], isLoading } = useQuery<Track[]>({
    queryKey: ["genre-tracks", query],
    queryFn: () => searchTracks(decodeURIComponent(query ?? ""), 40),
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#05050c",
        backgroundImage: "radial-gradient(ellipse at top right, rgba(127,119,221,0.1) 0%, transparent 60%)",
        fontFamily: "'DM Sans', sans-serif",
        padding: "40px 48px",
        paddingBottom: "40px",
      }}
    >
      <motion.button
        whileHover={{ x: -4, backgroundColor: "rgba(255,255,255,0.1)" }}
        onClick={() => navigate("/music")}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
          color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 500,
          borderRadius: 30, padding: "8px 20px", marginBottom: 40,
        }}
      >
        <ArrowLeft size={16} /> Back to Hub
      </motion.button>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 40, borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 24 }}>
        <div>
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ fontSize: 13, fontWeight: 700, color: "#9D97E8", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8 }}
          >
            Genre Exploration
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, color: "#fff", letterSpacing: "0.04em", lineHeight: 1 }}
          >
            {label}
          </motion.h1>
        </div>
        
        {tracks.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(127,119,221,0.4)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(`/music/videos?q=${encodeURIComponent(label)}`)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "linear-gradient(135deg, #7F77DD, #9D97E8)", border: "none", cursor: "pointer",
              color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: "0.05em",
              padding: "14px 32px", borderRadius: 30,
            }}
          >
            Watch Videos
          </motion.button>
        )}
      </div>

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 48px" }}>
          {Array.from({length: 10}).map((_, i) => (
            <div key={i} style={{ height: 72, borderRadius: 12, background: "rgba(255,255,255,0.03)", animation: "pulse 2s infinite" }} />
          ))}
        </div>
      ) : (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 48px" }}
        >
          {tracks.map((t, i) => (
            <motion.div key={t.trackId} variants={itemVariants}>
              <TrackRow track={t} index={i} queue={tracks} showArt />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
