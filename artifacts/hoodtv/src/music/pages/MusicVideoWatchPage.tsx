import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, Clock, ExternalLink } from "lucide-react";
import { MINI_PLAYER_HEIGHT } from "../components/MiniPlayer";

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
    <div
      onClick={onClick}
      style={{
        display: "flex",
        gap: 10,
        cursor: "pointer",
        padding: "6px 0",
        borderRadius: 8,
        transition: "background 0.15s",
      }}
      className="related-card"
    >
      <div style={{ position: "relative", flexShrink: 0, width: 160, height: 90, borderRadius: 6, overflow: "hidden", background: "#111" }}>
        <img
          src={video.thumbnail}
          alt={video.title}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
        {video.duration && (
          <div
            style={{
              position: "absolute",
              bottom: 4,
              right: 4,
              background: "rgba(0,0,0,0.85)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 600,
              padding: "1px 5px",
              borderRadius: 3,
              fontFamily: "monospace",
            }}
          >
            {video.duration}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            color: "#e0e0e0",
            lineHeight: 1.35,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            marginBottom: 4,
          }}
        >
          {video.title}
        </div>
        <div style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>{video.author}</div>
        <div style={{ fontSize: 11, color: "#444" }}>
          {video.views}{video.views && video.publishedAt ? " · " : ""}{video.publishedAt}
        </div>
      </div>
      <style>{`.related-card:hover { background: rgba(255,255,255,0.04) !important; padding-left: 6px !important; }`}</style>
    </div>
  );
}

export function MusicVideoWatchPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const [, navigate] = useLocation();

  const { data: info, isLoading, isError } = useQuery<VideoInfo>({
    queryKey: ["yt-info", videoId],
    queryFn: () => fetchVideoInfo(videoId!),
    enabled: !!videoId,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#05050c",
        fontFamily: "'DM Sans', sans-serif",
        paddingBottom: `${MINI_PLAYER_HEIGHT + 24}px`,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(5,5,12,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <button
          onClick={() => window.history.back()}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#666",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            padding: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <span
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 18,
            color: "#f0f0f0",
            letterSpacing: "0.06em",
          }}
        >
          Music Videos
        </span>
        {info && (
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              color: "#555",
              textDecoration: "none",
            }}
          >
            <ExternalLink size={13} />
            YouTube
          </a>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: 0,
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0",
          alignItems: "start",
        }}
      >
        {/* Main column */}
        <div style={{ padding: "20px 24px 20px 28px" }}>
          {/* Player */}
          <div
            style={{
              position: "relative",
              paddingTop: "56.25%",
              background: "#000",
              borderRadius: 10,
              overflow: "hidden",
              marginBottom: 18,
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            }}
          >
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                border: "none",
              }}
              title={info?.title ?? "Music Video"}
            />
          </div>

          {/* Video meta */}
          {isLoading ? (
            <div>
              <div style={{ height: 24, background: "#111", borderRadius: 6, width: "70%", marginBottom: 12 }} />
              <div style={{ height: 14, background: "#0d0d0d", borderRadius: 4, width: "40%" }} />
            </div>
          ) : isError ? (
            <div style={{ color: "#555", fontSize: 13 }}>Could not load video details.</div>
          ) : info ? (
            <>
              <h1
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#f0f0f0",
                  lineHeight: 1.35,
                  marginBottom: 10,
                }}
              >
                {info.title}
              </h1>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginBottom: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "#7F77DD",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#fff",
                      flexShrink: 0,
                    }}
                  >
                    {info.author?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0" }}>{info.author}</span>
                </div>

                {info.views && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#555" }}>
                    <Eye size={13} />
                    {info.views}
                  </div>
                )}
                {info.publishedAt && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#555" }}>
                    <Clock size={13} />
                    {info.publishedAt}
                  </div>
                )}
              </div>

              {info.description && (
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 8,
                    padding: "14px 16px",
                    fontSize: 13,
                    color: "#666",
                    lineHeight: 1.6,
                    maxHeight: 120,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  {info.description.slice(0, 400)}{info.description.length > 400 ? "…" : ""}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Related videos sidebar */}
        <div
          style={{
            padding: "20px 20px 20px 0",
            borderLeft: "1px solid rgba(255,255,255,0.04)",
            minHeight: "100vh",
          }}
        >
          <h2
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 16,
              color: "#666",
              letterSpacing: "0.08em",
              marginBottom: 16,
              paddingLeft: 16,
            }}
          >
            Up Next
          </h2>

          {isLoading && (
            <div style={{ paddingLeft: 16 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 160, height: 90, borderRadius: 6, background: "#111", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 12, background: "#111", borderRadius: 3, marginBottom: 6, width: "90%" }} />
                    <div style={{ height: 12, background: "#111", borderRadius: 3, marginBottom: 6, width: "70%" }} />
                    <div style={{ height: 10, background: "#0d0d0d", borderRadius: 3, width: "50%" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && (info?.related ?? []).length === 0 && (
            <div style={{ paddingLeft: 16, color: "#444", fontSize: 13 }}>No related videos found.</div>
          )}

          <div style={{ paddingLeft: 16 }}>
            {(info?.related ?? []).map((v) => (
              <RelatedCard
                key={v.id}
                video={v}
                onClick={() => navigate(`/music/videos/${v.id}`)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
