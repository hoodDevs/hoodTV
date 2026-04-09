import { useLocation } from "wouter";
import { artworkUrl } from "../lib/musicApi";
import { Music } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  artistId: number;
  artistName: string;
  artworkUrl100?: string;
  genre?: string;
}

export function ArtistCard({ artistName, artworkUrl100, genre }: Props) {
  const [, navigate] = useLocation();
  const art = artworkUrl100 ? artworkUrl(artworkUrl100, 300) : "";

  return (
    <motion.div
      whileHover={{ y: -8 }}
      style={{ width: 160, flexShrink: 0, cursor: "pointer", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}
      onClick={() => navigate(`/music/artist/${encodeURIComponent(artistName)}`)}
      className="group"
    >
      <motion.div
        whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(127,119,221,0.2)" }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        style={{
          width: 160,
          height: 160,
          borderRadius: "50%",
          overflow: "hidden",
          marginBottom: 16,
          background: "linear-gradient(135deg, rgba(127,119,221,0.2), rgba(127,119,221,0.05))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {art ? (
          <img 
            src={art} 
            alt={artistName} 
            style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.5s ease" }} 
            className="group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <Music size={48} color="#7F77DD" strokeWidth={1.5} />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(127,119,221,0.4), transparent)",
            opacity: 0,
            transition: "opacity 0.3s ease",
            borderRadius: "50%",
          }}
          className="group-hover:opacity-100"
        />
      </motion.div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%", letterSpacing: "0.02em" }}>
        {artistName}
      </div>
      {genre && (
        <div style={{ fontSize: 12, color: "#888", marginTop: 4, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {genre}
        </div>
      )}
    </motion.div>
  );
}
