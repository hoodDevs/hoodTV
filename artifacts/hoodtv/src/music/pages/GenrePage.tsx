import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import type { YtVideo } from "./MusicVideosPage";

interface YtResult { videos: YtVideo[] }

function VideoCard({ video, onClick }: { video: YtVideo; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ cursor: "pointer" }}>
      <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 10, overflow: "hidden", background: "#111", marginBottom: 10 }}>
        <img
          src={video.thumbnail}
          alt={video.title}
          loading="lazy"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s ease" }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        />
        {video.duration && (
          <div style={{
            position: "absolute", bottom: 6, right: 6,
            background: "rgba(0,0,0,0.8)", color: "#fff",
            fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace",
          }}>
            {video.duration}
          </div>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {video.title}
      </div>
      <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{video.author}</div>
    </div>
  );
}

const GENRE_COLORS: Record<string, string> = {
  "hip hop": "#FF6B35",
  "pop": "#FF3CAC",
  "r&b": "#784BA0",
  "rnb": "#784BA0",
  "electronic": "#00D4FF",
  "rock": "#FF4757",
  "lofi": "#A29BFE",
  "mood": "#A29BFE",
};

export function GenrePage() {
  const { query } = useParams<{ query: string }>();
  const [location, navigate] = useLocation();

  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const label = params.get("label") ?? decodeURIComponent(query ?? "");
  const decoded = decodeURIComponent(query ?? "");
  const accentColor = GENRE_COLORS[label.toLowerCase()] ?? GENRE_COLORS[decoded.split(" ")[0].toLowerCase()] ?? "#7F77DD";

  const { data, isLoading } = useQuery<YtResult>({
    queryKey: ["genre-yt-videos", decoded],
    queryFn: () =>
      fetch(`/api/yt/videos?q=${encodeURIComponent(decoded + " music video 2024")}&limit=24`).then((r) => r.json()),
    staleTime: 10 * 60 * 1000,
    enabled: !!decoded,
  });

  const videos = data?.videos ?? [];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#05050c",
        backgroundImage: `radial-gradient(ellipse at top right, ${accentColor}18 0%, transparent 55%)`,
        fontFamily: "'DM Sans', sans-serif",
        paddingBottom: 40,
      }}
    >
      {/* Header */}
      <div style={{ padding: "40px 48px 32px" }}>
        <motion.button
          whileHover={{ x: -4 }}
          onClick={() => window.history.back()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#aaa", cursor: "pointer", fontSize: 14, fontWeight: 500,
            borderRadius: 30, padding: "8px 20px", marginBottom: 32,
          }}
        >
          <ArrowLeft size={16} /> Back
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: accentColor, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 8 }}>
            Genre
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 72, color: "#fff", margin: "0 0 8px", lineHeight: 1, letterSpacing: "0.02em" }}>
            {label}
          </h1>
          <div style={{ fontSize: 14, color: "#666" }}>
            {isLoading ? "Loading…" : `${videos.length} music videos`}
          </div>
        </motion.div>
      </div>

      {/* Videos grid */}
      <div style={{ padding: "0 48px" }}>
        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i}>
                <div style={{ paddingTop: "56.25%", borderRadius: 10, background: "rgba(255,255,255,0.04)", animation: "pulse 2s infinite" }} />
                <div style={{ height: 14, borderRadius: 4, background: "rgba(255,255,255,0.04)", marginTop: 10 }} />
              </div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div style={{ color: "#666", fontSize: 15, padding: "60px 0", textAlign: "center" }}>No videos found.</div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 }}
          >
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} onClick={() => navigate(`/music/videos/${v.id}`)} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
