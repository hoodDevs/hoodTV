import { useState } from "react";
import { ExternalLink } from "lucide-react";

interface Props {
  videoId: string;
  title?: string;
}

export function MusicVideoPlayer({ videoId, title }: Props) {
  const [loaded, setLoaded] = useState(false);

  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;

  return (
    <div
      style={{
        position: "relative",
        background: "#000",
        borderRadius: 16,
        overflow: "hidden",
        aspectRatio: "16/9",
        width: "100%",
      }}
    >
      {/* Loading shimmer */}
      {!loaded && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, #111 25%, #1a1a2e 50%, #111 75%)",
            backgroundSize: "200% 100%",
            animation: "mv-shimmer 1.5s infinite",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              border: "3px solid rgba(255,255,255,0.08)",
              borderTopColor: "#7F77DD",
              animation: "mv-spin 0.8s linear infinite",
            }}
          />
        </div>
      )}

      <iframe
        src={embedUrl}
        title={title || "Music Video"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        onLoad={() => setLoaded(true)}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          position: "absolute",
          inset: 0,
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      />

      <a
        href={`https://www.youtube.com/watch?v=${videoId}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(8px)",
          color: "#ccc",
          borderRadius: 8,
          padding: "6px 12px",
          fontSize: 12,
          fontWeight: 600,
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: "1px solid rgba(255,255,255,0.1)",
          transition: "all 0.2s",
          zIndex: 5,
          opacity: loaded ? 1 : 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.color = "#fff";
          (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,0,0,0.85)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.color = "#ccc";
          (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,0,0,0.6)";
        }}
      >
        <ExternalLink size={13} /> YouTube
      </a>

      <style>{`
        @keyframes mv-spin { to { transform: rotate(360deg); } }
        @keyframes mv-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
