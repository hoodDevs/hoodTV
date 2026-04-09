import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { searchTracks, artworkUrl, type Track } from "../lib/musicApi";
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

export function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const artistName = decodeURIComponent(id ?? "");
  const [, navigate] = useLocation();

  const { data: tracks = [], isLoading } = useQuery<Track[]>({
    queryKey: ["artist-tracks", artistName],
    queryFn: () => searchTracks(artistName, 30),
    staleTime: 10 * 60 * 1000,
    enabled: !!artistName,
  });

  const art = tracks[0]?.artworkUrl100 ? artworkUrl(tracks[0].artworkUrl100, 600) : "";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#05050c",
        fontFamily: "'DM Sans', sans-serif",
        paddingBottom: "40px",
      }}
    >
      {/* Cinematic Hero */}
      <div style={{ position: "relative", minHeight: 400, overflow: "hidden", marginBottom: 40 }}>
        {art && (
          <motion.div
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.4 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${art})`,
              backgroundSize: "cover",
              backgroundPosition: "center 20%",
              filter: "blur(20px) saturate(1.5)",
            }}
          />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(5,5,12,0.2) 0%, rgba(5,5,12,0.8) 60%, #05050c 100%)" }} />
        
        <div style={{ position: "relative", padding: "40px 48px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <motion.button
            whileHover={{ x: -4, backgroundColor: "rgba(255,255,255,0.1)" }}
            onClick={() => window.history.back()}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 500,
              borderRadius: 30, padding: "8px 20px", alignSelf: "flex-start",
              backdropFilter: "blur(12px)",
            }}
          >
            <ArrowLeft size={16} /> Return
          </motion.button>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 40, marginTop: "auto", paddingTop: 80 }}>
            {art && (
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.1, type: "spring", stiffness: 200 }}
              >
                <img
                  src={art}
                  alt={artistName}
                  style={{ width: 220, height: 220, borderRadius: "50%", objectFit: "cover", boxShadow: "0 20px 40px rgba(0,0,0,0.6)", flexShrink: 0, border: "2px solid rgba(255,255,255,0.1)" }}
                />
              </motion.div>
            )}
            <div style={{ paddingBottom: 16 }}>
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                style={{ fontSize: 13, fontWeight: 700, color: "#9D97E8", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}
              >
                Verified Artist
              </motion.div>
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 80, color: "#fff", margin: "0 0 24px", lineHeight: 1, textShadow: "0 4px 12px rgba(0,0,0,0.5)" }}
              >
                {artistName}
              </motion.h1>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                style={{ display: "flex", gap: 16 }}
              >
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(127,119,221,0.4)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`/music/videos?q=${encodeURIComponent(artistName)}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: "linear-gradient(135deg, #7F77DD, #9D97E8)", border: "none", cursor: "pointer",
                    color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: "0.05em",
                    padding: "14px 32px", borderRadius: 30,
                  }}
                >
                  Watch Videos
                </motion.button>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 48px" }}>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "#fff", letterSpacing: "0.06em", marginBottom: 24 }}>
          Essential Tracks
        </h2>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
             {Array.from({length: 5}).map((_, i) => (
                <div key={i} style={{ height: 72, borderRadius: 12, background: "rgba(255,255,255,0.03)", animation: "pulse 2s infinite" }} />
             ))}
          </div>
        ) : tracks.length === 0 ? (
          <div style={{ color: "#666", fontSize: 15, padding: "40px 0", textAlign: "center" }}>No tracks found in the vault.</div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {tracks.map((t, i) => (
              <motion.div key={t.trackId} variants={itemVariants}>
                <TrackRow track={t} index={i} queue={tracks} showAlbum showArt />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
