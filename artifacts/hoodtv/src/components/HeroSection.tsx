import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Play, Plus, Check, Info } from "lucide-react";
import type { MediaItem } from "@/lib/api";
import { useWatchlist } from "@/hooks/useWatchlist";

interface HeroSectionProps {
  items: MediaItem[];
}

export function HeroSection({ items }: HeroSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toggleWatchlist, isInWatchlist } = useWatchlist();

  const SLIDE_DURATION = 8000;

  const goTo = (idx: number) => {
    if (idx === activeIndex) return;
    setTransitioning(true);
    setBgLoaded(false);
    setProgress(0);
    setTimeout(() => {
      setActiveIndex(idx);
      setTransitioning(false);
    }, 350);
  };

  const startTimer = () => {
    if (items.length === 0) return;
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);

    const tick = 60;
    let elapsed = 0;
    progressRef.current = setInterval(() => {
      elapsed += tick;
      setProgress(Math.min((elapsed / SLIDE_DURATION) * 100, 100));
    }, tick);

    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % Math.min(items.length, 6);
        setTransitioning(true);
        setBgLoaded(false);
        setTimeout(() => setTransitioning(false), 350);
        return next;
      });
      elapsed = 0;
      setProgress(0);
    }, SLIDE_DURATION);
  };

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [items.length]);

  useEffect(() => {
    setBgLoaded(false);
    if (!items[activeIndex]?.backdrop) return;
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = items[activeIndex].backdrop!;
  }, [activeIndex, items]);

  if (items.length === 0) {
    return (
      <div
        className="relative w-full flex items-end"
        style={{ height: "100vh", minHeight: "600px", background: "#0a0a0a" }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#7F77DD]/20 border-t-[#7F77DD] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const featured = items[activeIndex];

  const watchUrl =
    featured.type === "tv"
      ? `/watch/${featured.id}?title=${encodeURIComponent(featured.title)}&type=tv&season=1&episode=1`
      : `/watch/${featured.id}?title=${encodeURIComponent(featured.title)}&type=movie`;

  const genres = featured.genres?.slice(0, 3).join(" · ") || "";
  const totalSlides = Math.min(items.length, 6);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: "100vh", minHeight: "600px" }}
      data-testid="hero-section"
    >
      {/* Deep base */}
      <div className="absolute inset-0" style={{ background: "#050508" }} />

      {/* Backdrop */}
      {featured.backdrop && (
        <>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${featured.backdrop})`,
              backgroundSize: "cover",
              backgroundPosition: "center 20%",
              opacity: bgLoaded && !transitioning ? 1 : 0,
              transition: "opacity 1s ease",
            }}
          />
          {/* Tint layer to darken & colorize */}
          <div
            className="absolute inset-0"
            style={{
              background: "rgba(5,5,8,0.45)",
              opacity: bgLoaded && !transitioning ? 1 : 0,
              transition: "opacity 1s ease",
            }}
          />
        </>
      )}

      {/* Cinematic vignette — strong edges, open center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 75% 70% at 55% 45%, transparent 35%, rgba(5,5,8,0.6) 70%, rgba(5,5,8,0.92) 100%)",
        }}
      />

      {/* Bottom fade — tall, strong */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: "55%",
          background: "linear-gradient(to top, #0a0a0a 0%, rgba(10,10,10,0.6) 50%, transparent 100%)",
        }}
      />

      {/* Left gradient — content area protection */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to right, rgba(5,5,8,0.9) 0%, rgba(5,5,8,0.55) 38%, transparent 68%)",
        }}
      />

      {/* Purple ambient glow — bottom-left behind content */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: 0, left: 0, width: "40%", height: "50%",
          background: "radial-gradient(ellipse at 0% 100%, rgba(127,119,221,0.12) 0%, transparent 70%)",
        }}
      />

      {/* Top fade for navbar */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: "160px",
          background: "linear-gradient(to bottom, rgba(5,5,8,0.7) 0%, transparent 100%)",
        }}
      />

      {/* Content */}
      <div
        className="absolute bottom-0 left-0"
        style={{
          padding: "0 56px 72px",
          maxWidth: "640px",
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? "translateY(14px)" : "translateY(0)",
          transition: "opacity 0.35s, transform 0.35s cubic-bezier(.22,1,.36,1)",
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            background: "rgba(127,119,221,0.12)",
            border: "1px solid rgba(127,119,221,0.3)",
            borderRadius: "4px",
            padding: "5px 12px",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.14em",
            color: "#9D97E8",
            textTransform: "uppercase",
            marginBottom: "20px",
          }}
        >
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: "#7F77DD",
              animation: "heroPulse 2s infinite",
              flexShrink: 0,
            }}
          />
          {featured.type === "tv" ? "Series" : "Feature Film"}
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "clamp(60px, 9vw, 108px)",
            lineHeight: 0.93,
            letterSpacing: "2px",
            color: "#ffffff",
            marginBottom: "18px",
            textShadow: "0 4px 24px rgba(0,0,0,0.5)",
          }}
          data-testid="hero-title"
        >
          {featured.title}
        </h1>

        {/* Meta row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "14px",
            fontSize: "13px",
          }}
        >
          {featured.year && (
            <span style={{ color: "#aaa" }}>{featured.year}</span>
          )}
          {featured.rating && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                background: "rgba(245,197,24,0.1)",
                border: "1px solid rgba(245,197,24,0.25)",
                borderRadius: "4px",
                padding: "2px 7px",
                color: "#f5c518",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              ★ {featured.rating.toFixed(1)}
            </div>
          )}
          {genres && (
            <span style={{ color: "#888", fontSize: "12px" }}>{genres}</span>
          )}
        </div>

        {/* Overview */}
        {featured.overview && (
          <p
            style={{
              fontSize: "14px",
              lineHeight: 1.7,
              color: "rgba(255,255,255,0.65)",
              marginBottom: "34px",
              maxWidth: "460px",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {featured.overview}
          </p>
        )}

        {/* CTAs */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <Link href={watchUrl} data-testid="hero-play-btn">
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "9px",
                background: "#7F77DD",
                color: "#fff",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "14px",
                fontWeight: 600,
                padding: "13px 30px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                letterSpacing: "0.02em",
                boxShadow: "0 4px 20px rgba(127,119,221,0.45)",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#9590e8";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 28px rgba(127,119,221,0.6)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#7F77DD";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(127,119,221,0.45)";
              }}
            >
              <Play size={16} fill="white" />
              Play Now
            </button>
          </Link>

          <button
            onClick={() => toggleWatchlist(featured)}
            data-testid="hero-watchlist-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(255,255,255,0.1)",
              color: "#e0e0e0",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "14px",
              fontWeight: 500,
              padding: "13px 22px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.18)",
              cursor: "pointer",
              backdropFilter: "blur(6px)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.18)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)";
            }}
          >
            {isInWatchlist(featured.id) ? <Check size={15} /> : <Plus size={15} />}
            {isInWatchlist(featured.id) ? "Saved" : "My List"}
          </button>

          <Link href={`/title/${featured.id}?type=${featured.type}`}>
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                background: "rgba(255,255,255,0.06)",
                color: "#aaa",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "14px",
                fontWeight: 400,
                padding: "13px 18px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.1)",
                cursor: "pointer",
                backdropFilter: "blur(6px)",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#fff";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#aaa";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
              }}
            >
              <Info size={14} />
              More Info
            </button>
          </Link>
        </div>
      </div>

      {/* Slide indicators — bottom right */}
      <div
        className="absolute flex flex-col items-end gap-2"
        style={{ bottom: "72px", right: "48px", zIndex: 3 }}
      >
        {/* Slide count */}
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>
          {String(activeIndex + 1).padStart(2, "0")} / {String(totalSlides).padStart(2, "0")}
        </div>

        {/* Progress bars */}
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {items.slice(0, totalSlides).map((_, i) => (
            <button
              key={i}
              onClick={() => { goTo(i); startTimer(); }}
              data-testid={`hero-dot-${i}`}
              style={{
                width: i === activeIndex ? "28px" : "6px",
                height: "3px",
                borderRadius: "2px",
                background: i === activeIndex ? "#7F77DD" : "rgba(255,255,255,0.2)",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "width 0.35s cubic-bezier(.22,1,.36,1), background 0.35s",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {i === activeIndex && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: `${progress}%`,
                    background: "rgba(255,255,255,0.5)",
                    borderRadius: "2px",
                    transition: "width 0.06s linear",
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes heroPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
