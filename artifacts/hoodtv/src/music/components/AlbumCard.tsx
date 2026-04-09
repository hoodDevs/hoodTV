import { useLocation } from "wouter";
import { Play } from "lucide-react";
import { artworkUrl, type Album } from "../lib/musicApi";

interface Props {
  album: Album;
  size?: "sm" | "md";
}

export function AlbumCard({ album, size = "md" }: Props) {
  const [, navigate] = useLocation();
  const sz = size === "sm" ? 130 : 170;
  const art = artworkUrl(album.artworkUrl100, sz * 2);

  return (
    <div
      style={{ width: sz, flexShrink: 0, cursor: "pointer" }}
      onClick={() => navigate(`/music/album/${album.collectionId}`)}
      className="album-card"
    >
      <div style={{ position: "relative", marginBottom: 8 }}>
        <img
          src={art}
          alt={album.collectionName}
          style={{
            width: sz, height: sz,
            borderRadius: 8,
            objectFit: "cover",
            display: "block",
            background: "#1a1a2e",
          }}
        />
        <div
          className="album-play-btn"
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "#7F77DD",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0,
            transform: "translateY(4px)",
            transition: "opacity 0.2s, transform 0.2s",
            boxShadow: "0 4px 14px rgba(127,119,221,0.4)",
          }}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/music/album/${album.collectionId}`);
          }}
        >
          <Play size={18} fill="#fff" color="#fff" strokeWidth={0} style={{ marginLeft: 2 }} />
        </div>
      </div>
      <div
        style={{
          fontSize: size === "sm" ? 12 : 13,
          fontWeight: 500,
          color: "#e8e8e8",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {album.collectionName}
      </div>
      <div style={{ fontSize: 11.5, color: "#666", marginTop: 2 }}>
        {new Date(album.releaseDate).getFullYear()} · {album.trackCount} tracks
      </div>

      <style>{`
        .album-card:hover .album-play-btn {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
      `}</style>
    </div>
  );
}
