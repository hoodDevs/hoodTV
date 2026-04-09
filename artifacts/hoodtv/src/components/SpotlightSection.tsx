import { useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Play, Plus, Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { MediaItem } from "@/lib/api";
import { useWatchlist } from "@/hooks/useWatchlist";
import { Link } from "wouter";
import { smartReleaseLabel } from "@/lib/dateUtils";

interface SpotlightSectionProps {
  items: MediaItem[];
  title?: string;
}

function CinemaCard({ item }: { item: MediaItem }) {
  const [, setLocation] = useLocation();
  const { toggleWatchlist, isInWatchlist } = useWatchlist();
  const inList = isInWatchlist(item.id);
  const [hovered, setHovered] = useState(false);

  const watchUrl =
    item.type === "tv"
      ? `/watch/${item.id}?title=${encodeURIComponent(item.title)}&type=tv&season=1&episode=1`
      : `/watch/${item.id}?title=${encodeURIComponent(item.title)}&type=movie`;

  return (
    <Link
      href={`/title/${item.id}?type=${item.type}`}
      style={{ flexShrink: 0, width: "380px", display: "block", textDecoration: "none" }}
    >
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16/9",
          borderRadius: "10px",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.07)",
          cursor: "pointer",
          transition: "border-color 0.3s",
          borderColor: hovered ? "rgba(127,119,221,0.35)" : "rgba(255,255,255,0.07)",
        }}
      >
        {/* Backdrop image */}
        {item.backdrop ? (
          <img
            src={item.backdrop}
            alt={item.title}
            loading="lazy"
            decoding="async"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              transition: "transform 0.5s cubic-bezier(.22,1,.36,1)",
              transform: hovered ? "scale(1.04)" : "scale(1)",
            }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#1a1a2e,#0f3460)" }} />
        )}

        {/* Gradient overlays */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(5,5,8,0.92) 0%, rgba(5,5,8,0.2) 55%, transparent 100%)",
          }}
        />

        {/* Type badge */}
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#9D97E8",
            background: "rgba(5,5,8,0.75)",
            border: "1px solid rgba(127,119,221,0.3)",
            backdropFilter: "blur(6px)",
            borderRadius: "4px",
            padding: "3px 7px",
          }}
        >
          {item.type === "tv" ? "Series" : "Movie"}
        </div>

        {/* Bottom info */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "14px 16px",
          }}
        >
          {item.genres?.[0] && (
            <p style={{ fontSize: "9px", color: "#7F77DD", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>
              {item.genres.slice(0, 2).join(" · ")}
            </p>
          )}

          <h3
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "20px",
              letterSpacing: "1px",
              color: "#fff",
              lineHeight: 1.1,
              marginBottom: "6px",
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.title}
          </h3>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {(item.releaseDate || item.year) && (
              <span style={{
                fontSize: "11px",
                color: item.releaseDate && smartReleaseLabel(item.releaseDate).startsWith("Coming") ? "#9D97E8" : "#888",
                fontWeight: item.releaseDate && smartReleaseLabel(item.releaseDate).startsWith("Coming") ? 600 : 400,
              }}>
                {smartReleaseLabel(item.releaseDate) || item.year}
              </span>
            )}
            {item.rating && (
              <span style={{ fontSize: "11px", color: "#f5c518", fontWeight: 600 }}>★ {item.rating.toFixed(1)}</span>
            )}
          </div>

          {/* Hover actions */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "10px",
              opacity: hovered ? 1 : 0,
              transform: hovered ? "translateY(0)" : "translateY(6px)",
              transition: "opacity 0.25s, transform 0.25s",
            }}
            onClick={(e) => e.preventDefault()}
          >
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLocation(watchUrl); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "#7F77DD",
                color: "#fff",
                fontSize: "11px",
                fontWeight: 600,
                padding: "6px 14px",
                borderRadius: "5px",
                border: "none",
                cursor: "pointer",
              }}
            >
              <Play size={10} fill="white" /> Play
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWatchlist(item); }}
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "5px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: inList ? "#7F77DD" : "#f0f0f0",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {inList ? <Check size={11} /> : <Plus size={11} />}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function SpotlightSection({ items, title = "Spotlight" }: SpotlightSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 10);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    updateArrows();
    return () => el.removeEventListener("scroll", updateArrows);
  }, [items]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -420 : 420, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  return (
    <div style={{ padding: "8px 0 40px", position: "relative" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
          <div style={{ width: "3px", height: "20px", background: "#7F77DD", borderRadius: "2px" }} />
          <h2
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "21px",
              letterSpacing: "2px",
              color: "#fff",
            }}
          >
            {title}
          </h2>
        </div>
      </div>

      {/* Scroll row */}
      <div style={{ position: "relative" }}>
        {/* Left fade + arrow */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "80px",
            background: "linear-gradient(to right, #0a0a0a 0%, transparent 100%)",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingLeft: "8px",
            opacity: showLeft ? 1 : 0,
            transition: "opacity 0.2s",
            pointerEvents: showLeft ? "auto" : "none",
          }}
        >
          <button
            onClick={() => scroll("left")}
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: "rgba(20,20,20,0.9)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Cards */}
        <div
          ref={scrollRef}
          style={{
            display: "flex",
            gap: "14px",
            overflowX: "auto",
            scrollbarWidth: "none",
            padding: "4px 40px",
            scrollSnapType: "x mandatory",
          }}
        >
          {items.map((item) => (
            <div key={item.id} style={{ scrollSnapAlign: "start" }}>
              <CinemaCard item={item} />
            </div>
          ))}
        </div>

        {/* Right fade + arrow */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "80px",
            background: "linear-gradient(to left, #0a0a0a 0%, transparent 100%)",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingRight: "8px",
            opacity: showRight ? 1 : 0,
            transition: "opacity 0.2s",
            pointerEvents: showRight ? "auto" : "none",
          }}
        >
          <button
            onClick={() => scroll("right")}
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: "rgba(20,20,20,0.9)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
