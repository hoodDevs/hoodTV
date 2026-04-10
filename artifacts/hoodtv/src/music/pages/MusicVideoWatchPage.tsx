import { useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, Clock, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { MusicVideoPlayer } from "../components/MusicVideoPlayer";

interface VideoInfo {
  id: string;
  title: string;
  author: string;
  authorId: string;
  views: string;
  publishedAt: string;
  description: string;
  thumbnail: string;
  duration: number;
  related: RelatedVideo[];
}

interface RelatedVideo {
  id: string;
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
  views: string;
  publishedAt: string;
}

async function fetchVideoInfo(videoId: string): Promise<VideoInfo> {
  const res = await fetch(`/api/yt/info/${videoId}`);
  if (!res.ok) throw new Error("Failed to fetch video info");
  return res.json();
}

function RelatedCard({ video, onClick }: { video: RelatedVideo; onClick: () => void }) {
  return (
    <motion.div
      whileHover={{ backgroundColor: "rgba(255,255,255,0.03)", x: 4 }}
      onClick={onClick}
      style={{
        display: "flex", gap: 12, cursor: "pointer", padding: "8px", borderRadius: 12, transition: "background 0.2s"
      }}
      className="group"
    >
      <div style={{ position: "relative", flexShrink: 0, width: 168, height: 94, borderRadius: 8, overflow: "hidden", background: "#111", border: "1px solid rgba(255,255,255,0.05)" }}>
        <img
          src={video.thumbnail}
          alt={video.title}
          style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.4s ease" }}
          className="group-hover:scale-105"
          loading="lazy"
        />
        {video.duration && (
          <div
            style={{
              position: "absolute", bottom: 6, right: 6,
              background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)",
              color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace",
            }}
          >
            {video.duration}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div
          style={{
            fontSize: 14, fontWeight: 600, color: "#e0e0e0", lineHeight: 1.4,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 6,
            transition: "color 0.2s"
          }}
          className="group-hover:text-[#c0bdf5]"
        >
          {video.title}
        </div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{video.author}</div>
        <div style={{ fontSize: 11, color: "#555" }}>
          {video.views}{video.views && video.publishedAt ? " · " : ""}{video.publishedAt}
        </div>
      </div>
    </motion.div>
  );
}

export function MusicVideoWatchPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const [, navigate] = useLocation();

  // Simple queue: track which video IDs we've visited so prev/next work
  const historyRef = useRef<string[]>([]);
  const prevVideoIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (videoId && videoId !== prevVideoIdRef.current) {
      if (prevVideoIdRef.current) {
        historyRef.current = [...historyRef.current, prevVideoIdRef.current];
        // Keep last 50 entries
        if (historyRef.current.length > 50) historyRef.current = historyRef.current.slice(-50);
      }
      prevVideoIdRef.current = videoId;
    }
  }, [videoId]);

  const { data: info, isLoading, isError } = useQuery<VideoInfo>({
    queryKey: ["yt-info", videoId],
    queryFn: () => fetchVideoInfo(videoId!),
    enabled: !!videoId,
    staleTime: 10 * 60 * 1000,
  });

  const handlePrev = useCallback(() => {
    const prev = historyRef.current[historyRef.current.length - 1];
    if (prev) {
      historyRef.current = historyRef.current.slice(0, -1);
      navigate(`/music/videos/${prev}`);
    }
  }, [navigate]);

  const handleNext = useCallback(() => {
    const next = info?.related?.[0];
    if (next) navigate(`/music/videos/${next.id}`);
  }, [info, navigate]);

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
          position: "sticky", top: 0, zIndex: 10,
          background: "linear-gradient(to bottom, rgba(5,5,12,0.95), rgba(5,5,12,0.6))",
          backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          padding: "16px 32px", display: "flex", alignItems: "center", gap: 16,
        }}
      >
        <motion.button
          whileHover={{ x: -4, color: "#fff" }}
          onClick={() => window.history.back()}
          style={{
            background: "none", border: "none", cursor: "pointer", color: "#888",
            display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 500, padding: 0, transition: "color 0.2s"
          }}
        >
          <ArrowLeft size={20} /> Back
        </motion.button>
        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)", margin: "0 8px" }} />
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "#fff", letterSpacing: "0.06em", lineHeight: 1 }}>
          Cinema
        </span>
        
        {info && (
          <motion.a
            whileHover={{ scale: 1.05, color: "#fff", backgroundColor: "rgba(255,255,255,0.1)" }}
            whileTap={{ scale: 0.95 }}
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginLeft: "auto", display: "flex", alignItems: "center", gap: 8,
              fontSize: 13, fontWeight: 600, color: "#aaa", textDecoration: "none",
              background: "rgba(255,255,255,0.05)", padding: "8px 16px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", transition: "all 0.2s"
            }}
          >
            <ExternalLink size={16} /> Open in YouTube
          </motion.a>
        )}
      </div>

      <div
        style={{
          display: "grid", gridTemplateColumns: "1fr 420px", gap: 0,
          maxWidth: 1600, margin: "0 auto", alignItems: "start",
        }}
      >
        {/* Main column */}
        <div style={{ padding: "32px 40px" }}>
          {/* Player */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
            style={{
              marginBottom: 32,
              boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.05)",
              overflow: "hidden",
            }}
          >
            <MusicVideoPlayer
              videoId={videoId!}
              title={info?.title}
              onPrev={handlePrev}
              onNext={handleNext}
              hasPrev={historyRef.current.length > 0}
              hasNext={(info?.related?.length ?? 0) > 0}
            />
          </motion.div>

          {/* Video meta */}
          {isLoading ? (
            <div style={{ animation: "pulse 2s infinite" }}>
              <div style={{ height: 32, background: "rgba(255,255,255,0.05)", borderRadius: 8, width: "80%", marginBottom: 24 }} />
              <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
                <div style={{ height: 48, width: 48, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
                <div style={{ height: 48, flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 8 }} />
              </div>
            </div>
          ) : isError ? (
            <div style={{ color: "#888", fontSize: 15, padding: "40px 0", textAlign: "center" }}>Signal lost. Details unavailable.</div>
          ) : info ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", lineHeight: 1.3, marginBottom: 24, letterSpacing: "0.01em" }}>
                {info.title}
              </h1>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 24, paddingBottom: 32, borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      width: 48, height: 48, borderRadius: "50%",
                      background: "linear-gradient(135deg, #7F77DD, #9D97E8)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 700, color: "#fff", flexShrink: 0,
                      boxShadow: "0 4px 12px rgba(127,119,221,0.4)"
                    }}
                  >
                    {info.author?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{info.author}</div>
                    <div style={{ fontSize: 13, color: "#888" }}>Verified Channel</div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 24, background: "rgba(255,255,255,0.03)", padding: "12px 24px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
                  {info.views && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#aaa" }}>
                      <Eye size={18} color="#7F77DD" /> {info.views}
                    </div>
                  )}
                  {info.publishedAt && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#aaa" }}>
                      <Clock size={18} color="#7F77DD" /> {(() => {
                        try {
                          return new Date(info.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
                        } catch {
                          return info.publishedAt;
                        }
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {info.description && (
                <div
                  style={{
                    background: "rgba(255,255,255,0.02)", borderRadius: 16, padding: "24px",
                    fontSize: 14, color: "#aaa", lineHeight: 1.7, maxHeight: 200, overflowY: "auto", border: "1px solid rgba(255,255,255,0.03)"
                  }}
                  className="custom-scrollbar"
                >
                  <style>{`
                    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
                  `}</style>
                  {info.description.split('\n').map((line, i) => <p key={i} style={{ margin: "0 0 10px 0" }}>{line}</p>)}
                </div>
              )}
            </motion.div>
          ) : null}
        </div>

        {/* Related videos sidebar */}
        <div style={{ padding: "32px 32px 32px 0", minHeight: "100vh" }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "#fff", letterSpacing: "0.06em", marginBottom: 24, paddingLeft: 16 }}>
            Continue Watching
          </h2>

          {isLoading && (
            <div style={{ paddingLeft: 16, display: "flex", flexDirection: "column", gap: 16 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ display: "flex", gap: 12 }}>
                  <div style={{ width: 168, height: 94, borderRadius: 8, background: "rgba(255,255,255,0.03)", flexShrink: 0, animation: "pulse 2s infinite" }} />
                  <div style={{ flex: 1, padding: "8px 0" }}>
                    <div style={{ height: 14, background: "rgba(255,255,255,0.05)", borderRadius: 4, marginBottom: 8, width: "90%" }} />
                    <div style={{ height: 14, background: "rgba(255,255,255,0.05)", borderRadius: 4, marginBottom: 8, width: "70%" }} />
                    <div style={{ height: 12, background: "rgba(255,255,255,0.03)", borderRadius: 4, width: "50%" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && (info?.related ?? []).length === 0 && (
            <div style={{ paddingLeft: 16, color: "#666", fontSize: 14 }}>No related visuals found.</div>
          )}

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            style={{ paddingLeft: 16, display: "flex", flexDirection: "column", gap: 8 }}
          >
            {(info?.related ?? []).map((v) => (
              <RelatedCard
                key={v.id}
                video={v}
                onClick={() => navigate(`/music/videos/${v.id}`)}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
