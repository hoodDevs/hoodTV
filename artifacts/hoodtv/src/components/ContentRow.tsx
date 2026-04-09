import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { MediaCard } from "./MediaCard";
import type { MediaItem } from "@/lib/api";

interface ContentRowProps {
  title: string;
  items: MediaItem[];
  loading?: boolean;
  accent?: boolean;
  seeAllHref?: string;
  progressMap?: Record<string, number>;
}

export function ContentRow({ title, items, loading = false, accent = false, seeAllHref, progressMap }: ContentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);
  const [visible, setVisible] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.06 }
    );
    if (rowRef.current) observer.observe(rowRef.current);
    return () => observer.disconnect();
  }, []);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 10);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [items]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "right" ? 560 : -560, behavior: "smooth" });
  };

  const testId = `content-row-${title.toLowerCase().replace(/\s/g, "-")}`;
  const count = loading ? null : items.length;

  return (
    <div
      ref={rowRef}
      className="mb-10 transition-all duration-700"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
      }}
      data-testid={testId}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
          {accent && (
            <div
              style={{
                width: "3px",
                height: "20px",
                background: "#7F77DD",
                borderRadius: "2px",
                flexShrink: 0,
              }}
            />
          )}
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
          {count !== null && count > 0 && (
            <span
              style={{
                fontSize: "10px",
                color: "#555",
                background: "#141414",
                border: "1px solid rgba(255,255,255,0.05)",
                padding: "2px 7px",
                borderRadius: "4px",
                letterSpacing: "0.05em",
              }}
            >
              {count}
            </span>
          )}
        </div>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            style={{
              fontSize: "11px",
              color: "#7F77DD",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 600,
              textDecoration: "none",
              opacity: 0.85,
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
          >
            See all →
          </Link>
        )}
      </div>

      {/* Scroll area with edge fades */}
      <div className="relative group">
        {/* Left fade + arrow */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "80px",
            zIndex: 10,
            pointerEvents: showLeft ? "auto" : "none",
            background: showLeft
              ? "linear-gradient(to right, #0a0a0a 0%, rgba(10,10,10,0.7) 50%, transparent 100%)"
              : "transparent",
            display: "flex",
            alignItems: "center",
            paddingLeft: "8px",
            transition: "background 0.3s",
          }}
        >
          <button
            onClick={() => scroll("left")}
            data-testid={`scroll-left-${title}`}
            className="opacity-0 group-hover:opacity-100"
            style={{
              width: "36px",
              height: "64px",
              background: "rgba(20,20,20,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "#f0f0f0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              visibility: showLeft ? "visible" : "hidden",
              transition: "opacity 0.25s, background 0.2s",
              backdropFilter: "blur(4px)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(127,119,221,0.18)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(20,20,20,0.95)"; }}
          >
            <ChevronLeft size={17} />
          </button>
        </div>

        {/* Scrollable cards */}
        <div
          ref={scrollRef}
          className="flex gap-[13px] overflow-x-auto scrollbar-hide"
          style={{
            padding: "6px 40px 18px",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {loading
            ? Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 snap-start" style={{ width: "160px" }}>
                  <div
                    style={{
                      aspectRatio: "2/3",
                      borderRadius: "10px",
                      background: "linear-gradient(110deg, #161616 30%, #1e1e1e 50%, #161616 70%)",
                      backgroundSize: "200% 100%",
                      animation: "shimmer 1.6s infinite",
                    }}
                  />
                  <div
                    style={{
                      height: "11px",
                      width: "68%",
                      background: "linear-gradient(110deg, #161616 30%, #1e1e1e 50%, #161616 70%)",
                      backgroundSize: "200% 100%",
                      animation: "shimmer 1.6s infinite",
                      borderRadius: "4px",
                      marginTop: "10px",
                    }}
                  />
                  <div
                    style={{
                      height: "9px",
                      width: "38%",
                      background: "linear-gradient(110deg, #161616 30%, #1e1e1e 50%, #161616 70%)",
                      backgroundSize: "200% 100%",
                      animation: "shimmer 1.6s infinite",
                      borderRadius: "4px",
                      marginTop: "6px",
                    }}
                  />
                </div>
              ))
            : items.map((item, idx) => (
                <div key={`${title}-${item.id}-${idx}`} className="snap-start flex-shrink-0">
                  <MediaCard item={item} progress={progressMap?.[item.id]} />
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
            zIndex: 10,
            pointerEvents: showRight ? "auto" : "none",
            background: showRight
              ? "linear-gradient(to left, #0a0a0a 0%, rgba(10,10,10,0.7) 50%, transparent 100%)"
              : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingRight: "8px",
            transition: "background 0.3s",
          }}
        >
          <button
            onClick={() => scroll("right")}
            data-testid={`scroll-right-${title}`}
            className="opacity-0 group-hover:opacity-100"
            style={{
              width: "36px",
              height: "64px",
              background: "rgba(20,20,20,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "#f0f0f0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              visibility: showRight ? "visible" : "hidden",
              transition: "opacity 0.25s, background 0.2s",
              backdropFilter: "blur(4px)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(127,119,221,0.18)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(20,20,20,0.95)"; }}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
