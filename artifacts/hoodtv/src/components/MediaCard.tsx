import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Play, Plus, Check, Film, Tv } from "lucide-react";
import type { MediaItem } from "@/lib/api";
import { useWatchlist } from "@/hooks/useWatchlist";
import { smartReleaseLabel } from "@/lib/dateUtils";

interface MediaCardProps {
  item: MediaItem;
  className?: string;
  size?: "sm" | "md" | "lg";
  fill?: boolean;
  progress?: number;
}

export function MediaCard({ item, className = "", size = "md", fill = false, progress }: MediaCardProps) {
  const [imgError, setImgError] = useState(false);
  const [, setLocation] = useLocation();
  const { toggleWatchlist, isInWatchlist } = useWatchlist();

  const widths = { sm: "130px", md: "160px", lg: "200px" };
  const width = fill ? undefined : widths[size];

  const watchUrl =
    item.type === "tv"
      ? `/watch/${item.id}?title=${encodeURIComponent(item.title)}&type=tv&season=1&episode=1`
      : `/watch/${item.id}?title=${encodeURIComponent(item.title)}&type=movie`;

  const genre = item.genres?.[0];
  const inList = isInWatchlist(item.id);

  return (
    <Link href={`/title/${item.id}?type=${item.type}`} data-testid={`card-media-${item.id}`} className={fill ? "block w-full" : ""}>
      <div
        className={`relative group cursor-pointer flex-shrink-0 ${fill ? "w-full" : ""} ${className}`}
        style={width ? { width } : undefined}
      >
        {/* Poster */}
        <div
          style={{
            width: "100%",
            aspectRatio: "2/3",
            borderRadius: "10px",
            background: "#1e1e1e",
            overflow: "hidden",
            position: "relative",
            border: "0.5px solid rgba(255,255,255,0.05)",
            transition: "transform 0.3s cubic-bezier(.22,1,.36,1), box-shadow 0.3s",
          }}
          className="group-hover:scale-[1.04] group-hover:-translate-y-1 group-hover:shadow-[0_20px_48px_rgba(0,0,0,.7),0_0_0_1.5px_rgba(127,119,221,0.35)]"
        >
          {item.poster && !imgError ? (
            <img
              src={item.poster}
              alt={item.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center p-3 text-center gap-3"
              style={{ background: "linear-gradient(160deg, #1a1a3e 0%, #16213e 50%, #0f3460 100%)" }}
            >
              {item.type === "tv" ? (
                <Tv size={28} className="text-[#7F77DD]/60" />
              ) : (
                <Film size={28} className="text-[#7F77DD]/60" />
              )}
              <span className="text-xs font-medium text-white/80 leading-tight line-clamp-3">{item.title}</span>
            </div>
          )}

          {/* Hover overlay — play button + overview */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,.97) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.1) 100%)" }}
          >
            {/* Play button — upper-center */}
            <div className="flex-1 flex items-center justify-center">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLocation(watchUrl); }}
                data-testid={`card-play-${item.id}`}
                style={{
                  width: "42px",
                  height: "42px",
                  background: "#7F77DD",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  cursor: "pointer",
                  transform: "scale(0.75)",
                  transition: "transform 0.3s cubic-bezier(.22,1,.36,1), background 0.2s",
                  flexShrink: 0,
                  boxShadow: "0 4px 16px rgba(127,119,221,0.5)",
                }}
                className="group-hover:!scale-100 hover:!bg-[#9590e8]"
                title="Play"
              >
                <Play size={15} fill="white" className="ml-0.5" />
              </button>
            </div>

            {/* Overview text — bottom */}
            {item.overview && (
              <p
                style={{
                  padding: "0 9px 10px",
                  fontSize: "9.5px",
                  lineHeight: 1.5,
                  color: "rgba(255,255,255,0.72)",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: "0.01em",
                }}
              >
                {item.overview}
              </p>
            )}
          </div>

          {/* Rating badge (top right, shown on hover) */}
          {item.rating && (
            <div
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: "rgba(10,10,10,0.85)",
                backdropFilter: "blur(4px)",
                borderRadius: "5px",
                padding: "3px 7px",
                fontSize: "11px",
                fontWeight: 500,
                color: "#f5c518",
                display: "flex",
                alignItems: "center",
                gap: "3px",
                border: "0.5px solid rgba(245,197,24,.2)",
              }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="#f5c518">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {item.rating.toFixed(1)}
            </div>
          )}

          {/* Watchlist button (top left, shown on hover) */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWatchlist(item); }}
            className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:!bg-[#7F77DD]"
            style={{
              width: "28px",
              height: "28px",
              background: "rgba(10,10,10,0.8)",
              borderRadius: "50%",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: inList ? "#7F77DD" : "#f0f0f0",
              backdropFilter: "blur(4px)",
            }}
            title={inList ? "Remove from list" : "Add to list"}
          >
            {inList ? <Check size={13} /> : <Plus size={13} />}
          </button>

          {/* Progress bar */}
          {progress !== undefined && (
            <div
              className="absolute bottom-0 left-0 right-0"
              style={{ height: "3px", background: "rgba(255,255,255,0.1)", borderRadius: "0 0 10px 10px", overflow: "hidden" }}
            >
              <div style={{ height: "100%", width: `${progress}%`, background: "#7F77DD", borderRadius: "0 0 10px 10px" }} />
            </div>
          )}
        </div>

        {/* Card info */}
        <div style={{ padding: "10px 2px 0" }}>
          <p
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "#e8e8e8",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginBottom: "3px",
            }}
          >
            {item.title}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "11px", color: "#555" }}>
            {(item.releaseDate || item.year) && (
              <span style={{ color: item.releaseDate && smartReleaseLabel(item.releaseDate).startsWith("Coming") ? "#7F77DD" : "#666" }}>
                {smartReleaseLabel(item.releaseDate) || item.year}
              </span>
            )}
            {(item.releaseDate || item.year) && genre && (
              <span style={{ width: "2px", height: "2px", borderRadius: "50%", background: "#444" }} />
            )}
            {genre && (
              <span
                style={{
                  fontSize: "10px",
                  color: "#7F77DD",
                  background: "rgba(127,119,221,0.12)",
                  padding: "1px 6px",
                  borderRadius: "3px",
                  border: "0.5px solid rgba(127,119,221,0.28)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "90px",
                }}
              >
                {genre}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
