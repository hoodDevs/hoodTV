import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, Play, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface YtVideo {
  id: string;
  title: string;
  author: string;
  authorId: string;
  duration: string;
  durationSeconds: number;
  thumbnail: string;
  views: string;
  publishedAt: string;
}

async function fetchVideos(q: string): Promise<YtVideo[]> {
  const res = await fetch(`/api/yt/videos?${new URLSearchParams({ q, limit: "24" })}`);
  if (!res.ok) throw new Error("Failed to fetch videos");
  const data = await res.json();
  return data.videos ?? [];
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

function VideoCard({ video, onClick }: { video: YtVideo; onClick: () => void }) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -8 }}
      onClick={onClick}
      style={{
        cursor: "pointer",
        background: "transparent",
        borderRadius: 16,
        overflow: "hidden",
      }}
      className="group"
    >
      {/* Thumbnail */}
      <div style={{ position: "relative", paddingTop: "56.25%", background: "#111", borderRadius: 12, overflow: "hidden", marginBottom: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.03)" }}>
        <img
          src={video.thumbnail}
          alt={video.title}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.5s ease" }}
          className="group-hover:scale-105"
          loading="lazy"
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent 50%)" }} />
        
        {/* Duration chip */}
        {video.duration && (
          <div
            style={{
              position: "absolute",
              bottom: 10,
              right: 10,
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(8px)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              padding: "4px 8px",
              borderRadius: 6,
              fontFamily: "monospace",
              letterSpacing: "0.05em"
            }}
          >
            {video.duration}
          </div>
        )}
        
        {/* Hover play overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0,
            transition: "opacity 0.3s",
            backdropFilter: "blur(2px)"
          }}
          className="group-hover:opacity-100"
        >
          <motion.div
            whileHover={{ scale: 1.1 }}
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(127,119,221,0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}
          >
            <Play size={32} fill="#fff" color="#fff" strokeWidth={0} style={{ marginLeft: 4 }} />
          </motion.div>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "0 4px" }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#fff",
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            marginBottom: 6,
            transition: "color 0.2s"
          }}
          className="group-hover:text-[#c0bdf5]"
        >
          {video.title}
        </div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>{video.author}</div>
        <div style={{ fontSize: 12, color: "#555", fontWeight: 500 }}>
          {video.views}{video.views && video.publishedAt ? " · " : ""}{video.publishedAt}
        </div>
      </div>
    </motion.div>
  );
}

export function MusicVideosPage() {
  const [, navigate] = useLocation();
  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("official music video 2024");

  const { data: videos = [], isLoading, isError } = useQuery<YtVideo[]>({
    queryKey: ["yt-videos", activeQuery],
    queryFn: () => fetchVideos(activeQuery),
    staleTime: 5 * 60 * 1000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) setActiveQuery(searchInput.trim());
  };

  const isDefaultFeed = activeQuery === "official music video 2024";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#05050c",
        fontFamily: "'DM Sans', sans-serif",
        paddingBottom: "40px",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(5,5,12,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          padding: "16px 40px",
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <motion.button
          whileHover={{ x: -4, color: "#fff" }}
          onClick={() => navigate("/music")}
          style={{
            background: "none", border: "none", cursor: "pointer", color: "#888",
            display: "flex", alignItems: "center", padding: 0, transition: "color 0.2s"
          }}
        >
          <ArrowLeft size={24} />
        </motion.button>

        <h1
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 28,
            color: "#fff",
            letterSpacing: "0.06em",
            flexShrink: 0,
            margin: 0,
            lineHeight: 1
          }}
        >
          Visuals
        </h1>

        <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: 600, marginLeft: "auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 30,
              padding: "10px 20px",
              transition: "all 0.2s",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)"
            }}
            className="focus-within:border-[#7F77DD] focus-within:bg-[rgba(255,255,255,0.08)]"
          >
            <Search size={18} color="#888" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search music videos..."
              style={{
                background: "none", border: "none", outline: "none",
                color: "#fff", fontSize: 14, flex: 1,
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
            <AnimatePresence>
              {searchInput && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  type="submit"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    background: "#7F77DD", border: "none", cursor: "pointer",
                    color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: "0.02em",
                    padding: "6px 16px", borderRadius: 20,
                  }}
                >
                  Search
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </form>
      </div>

      <div style={{ padding: "32px 48px" }}>
        {!isDefaultFeed && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: 32, display: "flex", alignItems: "center", gap: 16 }}
          >
            <span style={{ fontSize: 16, color: "#888" }}>
              Showing visuals for <span style={{ color: "#fff", fontWeight: 600 }}>"{activeQuery}"</span>
            </span>
            <motion.button
              whileHover={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }}
              onClick={() => { setActiveQuery("official music video 2024"); setSearchInput(""); }}
              style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                cursor: "pointer", color: "#aaa", fontSize: 12, fontWeight: 600,
                borderRadius: 20, padding: "6px 16px", transition: "all 0.2s"
              }}
            >
              Clear filter
            </motion.button>
          </motion.div>
        )}

        {isLoading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 32 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i}>
                <div style={{ paddingTop: "56.25%", borderRadius: 12, background: "rgba(255,255,255,0.03)", animation: "pulse 2s infinite", marginBottom: 16 }} />
                <div style={{ height: 16, background: "rgba(255,255,255,0.05)", borderRadius: 4, marginBottom: 8, width: "85%" }} />
                <div style={{ height: 14, background: "rgba(255,255,255,0.03)", borderRadius: 4, width: "60%" }} />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", padding: "100px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
            <div style={{ fontSize: 16, color: "#888", marginBottom: 24 }}>Signal lost. The visual feed is currently unavailable.</div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveQuery(activeQuery + " ")}
              style={{
                background: "linear-gradient(135deg, #7F77DD, #9D97E8)", border: "none", cursor: "pointer", color: "#fff",
                padding: "12px 32px", borderRadius: 30, fontSize: 14, fontWeight: 700, letterSpacing: "0.05em"
              }}
            >
              Re-establish Connection
            </motion.button>
          </motion.div>
        )}

        {!isLoading && !isError && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 40 }}
          >
            {videos.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                onClick={() => navigate(`/music/videos/${v.id}`)}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
