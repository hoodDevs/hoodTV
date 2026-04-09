import { useLocation } from "wouter";
import { artworkUrl, type Track } from "../lib/musicApi";
import { Music } from "lucide-react";

interface Props {
  artistId: number;
  artistName: string;
  artworkUrl100?: string;
  genre?: string;
}

export function ArtistCard({ artistId, artistName, artworkUrl100, genre }: Props) {
  const [, navigate] = useLocation();
  const art = artworkUrl100 ? artworkUrl(artworkUrl100, 200) : "";

  return (
    <div
      style={{ width: 140, flexShrink: 0, cursor: "pointer", textAlign: "center" }}
      onClick={() => navigate(`/music/artist/${artistId}`)}
      className="artist-card"
    >
      <div
        style={{
          width: 140,
          height: 140,
          borderRadius: "50%",
          overflow: "hidden",
          marginBottom: 10,
          background: "rgba(127,119,221,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {art ? (
          <img src={art} alt={artistName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Music size={40} color="#7F77DD" />
        )}
        <div
          className="artist-overlay"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0)",
            transition: "background 0.2s",
            borderRadius: "50%",
          }}
        />
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "#e8e8e8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {artistName}
      </div>
      {genre && (
        <div style={{ fontSize: 11.5, color: "#666", marginTop: 2 }}>{genre}</div>
      )}

      <style>{`
        .artist-card:hover .artist-overlay { background: rgba(127,119,221,0.15) !important; }
      `}</style>
    </div>
  );
}
