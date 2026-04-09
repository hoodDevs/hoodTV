import { useEffect, useState } from "react";
import { X, Loader, Youtube } from "lucide-react";

interface Props {
  artistName: string;
  trackName: string;
  artworkUrl?: string;
  onClose: () => void;
}

interface YtVideo {
  id: string;
  title: string;
  author: string;
  thumbnail: string;
}

async function searchMusicVideo(artistName: string, trackName: string): Promise<YtVideo | null> {
  const title = `${artistName} ${trackName} official music video`;
  const res = await fetch(`/api/yt/search?${new URLSearchParams({ title, type: "music" })}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.videos?.[0] ?? null;
}

export function MusicVideoModal({ artistName, trackName, artworkUrl, onClose }: Props) {
  const [video, setVideo] = useState<YtVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    searchMusicVideo(artistName, trackName)
      .then((v) => {
        if (cancelled) return;
        if (v) setVideo(v);
        else setError("No music video found");
      })
      .catch(() => {
        if (!cancelled) setError("Search failed — check if the YouTube service is running");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [artistName, trackName]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backdropFilter: "blur(8px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#0d0d1a",
          borderRadius: 14,
          width: "100%",
          maxWidth: 860,
          overflow: "hidden",
          border: "1px solid rgba(127,119,221,0.2)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {artworkUrl && (
            <img src={artworkUrl} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: "cover" }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#e8e8e8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {trackName}
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>{artistName}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Youtube size={16} color="#ff4444" />
            <span style={{ fontSize: 11, color: "#555" }}>Music Video</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "none",
              cursor: "pointer",
              color: "#aaa",
              borderRadius: 6,
              padding: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ position: "relative", paddingTop: "56.25%", background: "#05050c" }}>
          {loading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                color: "#555",
                fontSize: 13,
              }}
            >
              <Loader size={28} color="#7F77DD" style={{ animation: "spin 1s linear infinite" }} />
              <span>Searching for music video…</span>
            </div>
          )}

          {!loading && error && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                color: "#555",
                fontSize: 13,
              }}
            >
              <Youtube size={36} color="#333" />
              <span>{error}</span>
            </div>
          )}

          {!loading && video && (
            <iframe
              src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                border: "none",
              }}
              title={video.title}
            />
          )}
        </div>

        {/* Video info strip */}
        {!loading && video && (
          <div style={{ padding: "10px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 11.5, color: "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
              {video.title}
            </div>
            <a
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: "#7F77DD", textDecoration: "none", marginLeft: 12, flexShrink: 0 }}
            >
              Open in YouTube ↗
            </a>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
