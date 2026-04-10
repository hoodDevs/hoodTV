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
      {video.views && <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>{video.views}</div>}
    </div>
  );
}

export function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const artistName = decodeURIComponent(id ?? "");
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<YtResult>({
    queryKey: ["artist-yt-videos", artistName],
    queryFn: () =>
      fetch(`/api/yt/videos?q=${encodeURIComponent(artistName + " official music video")}&limit=24`).then((r) => r.json()),
    staleTime: 10 * 60 * 1000,
    enabled: !!artistName,
  });

  const videos = data?.videos ?? [];
  const heroThumb = videos[0]?.thumbnail ?? "";
  const initials = (artistName || "?").slice(0, 2).toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: "#05050c", fontFamily: "'DM Sans', sans-serif", paddingBottom: 40 }}>

      {/* Cinematic Hero */}
      <div style={{ position: "relative", minHeight: 360, overflow: "hidden", marginBottom: 40 }}>
        {heroThumb && (
          <motion.div
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.35 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{
              position: "absolute", inset: 0,
              backgroundImage: `url(${heroThumb})`,
              backgroundSize: "cover", backgroundPosition: "center 20%",
              filter: "blur(20px) saturate(1.5)",
            }}
          />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(5,5,12,0.2) 0%, rgba(5,5,12,0.8) 60%, #05050c 100%)" }} />

        <div style={{ position: "relative", padding: "40px 48px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 360 }}>
          <motion.button
            whileHover={{ x: -4 }}
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

          <div style={{ display: "flex", alignItems: "flex-end", gap: 32, marginTop: "auto", paddingTop: 60 }}>
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1, type: "spring", stiffness: 200 }}
              style={{
                width: 160, height: 160, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, #7F77DD, #9D97E8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 52, fontWeight: 700, color: "#fff",
                fontFamily: "'Bebas Neue', sans-serif",
                boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                border: "2px solid rgba(255,255,255,0.1)",
                overflow: "hidden",
              }}
            >
              {heroThumb
                ? <img src={heroThumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : initials}
            </motion.div>

            <div style={{ paddingBottom: 8 }}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                style={{ fontSize: 12, fontWeight: 700, color: "#9D97E8", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8 }}
              >
                Artist
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 72, color: "#fff", margin: "0 0 8px", lineHeight: 1, textShadow: "0 4px 12px rgba(0,0,0,0.5)" }}
              >
                {artistName}
              </motion.h1>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                style={{ fontSize: 13, color: "#888" }}
              >
                {isLoading ? "Loading…" : `${videos.length} music videos`}
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Videos grid */}
      <div style={{ padding: "0 48px" }}>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "#fff", letterSpacing: "0.06em", marginBottom: 24 }}>
          Music Videos
        </h2>

        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i}>
                <div style={{ paddingTop: "56.25%", borderRadius: 10, background: "rgba(255,255,255,0.04)", animation: "pulse 2s infinite" }} />
                <div style={{ height: 14, borderRadius: 4, background: "rgba(255,255,255,0.04)", marginTop: 10, animation: "pulse 2s infinite" }} />
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
