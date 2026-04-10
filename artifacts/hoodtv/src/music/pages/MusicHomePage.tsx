import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, Sparkles, History, Heart, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { YtVideo } from "./MusicVideosPage";
import { useMusicVideoHistory } from "@/hooks/useMusicVideoHistory";
import { useMusicVideoFavorites } from "@/hooks/useMusicVideoFavorites";
import {
  recordChipClick,
  recordChipLeave,
  recordVideoClick,
  buildFeedQueries,
  getOrderedChips,
  getConfidenceLevel,
  getWatchedIds,
  incrementFeedIteration,
  type ChipDef,
} from "../lib/feedAlgorithm";

function useDebounce(value: string, ms = 500) {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return d;
}

const BASE_CHIPS: ChipDef[] = [
  { label: "For You",      q: "" },
  { label: "All",          q: "official music video 2024" },
  { label: "Hip Hop",      q: "hip hop music video 2024" },
  { label: "Pop",          q: "pop music video 2024" },
  { label: "R&B",          q: "rnb soul music video 2024" },
  { label: "Electronic",   q: "electronic music video 2024" },
  { label: "Rock",         q: "rock music video 2024" },
  { label: "Mood & Sound", q: "lofi chill vibes 2024" },
];

/** Interleave multiple arrays round-robin, deduplicating by video ID. */
function interleaveAndDedup(buckets: YtVideo[][]): YtVideo[] {
  const seen = new Set<string>();
  const out: YtVideo[] = [];
  const maxLen = Math.max(...buckets.map((b) => b.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const bucket of buckets) {
      const v = bucket[i];
      if (v && !seen.has(v.id)) {
        seen.add(v.id);
        out.push(v);
      }
    }
  }
  return out;
}

function VideoCard({ video, onClick }: { video: YtVideo; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: "pointer" }}
    >
      {/* Thumbnail */}
      <div
        style={{
          position: "relative", paddingTop: "56.25%",
          borderRadius: 10, overflow: "hidden",
          background: "#111",
          transform: hovered ? "scale(1.02)" : "scale(1)",
          transition: "transform 0.3s cubic-bezier(.22,1,.36,1), box-shadow 0.3s",
          marginBottom: 10,
          boxShadow: hovered ? "0 16px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(127,119,221,0.2)" : "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        <img
          src={video.thumbnail}
          alt={video.title}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />

        {/* Hover overlay gradient */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(5,5,12,0.85) 0%, rgba(5,5,12,0.3) 40%, transparent 70%)",
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.25s ease",
        }} />

        {/* Centered play button — appears on hover */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.2s ease",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "rgba(127,119,221,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transform: hovered ? "scale(1)" : "scale(0.5)",
            transition: "transform 0.3s cubic-bezier(.22,1,.36,1)",
            boxShadow: "0 4px 24px rgba(127,119,221,0.6)",
            flexShrink: 0,
          }}>
            <Play size={18} fill="white" color="white" style={{ marginLeft: 3 }} />
          </div>
        </div>

        {video.duration && (
          <span style={{
            position: "absolute", bottom: 7, right: 7,
            background: "rgba(0,0,0,0.88)", color: "#fff",
            fontSize: 11, fontWeight: 700, padding: "2px 6px",
            borderRadius: 4, fontFamily: "monospace",
            opacity: hovered ? 0 : 1, transition: "opacity 0.15s",
          }}>
            {video.duration}
          </span>
        )}
      </div>

      {/* Text */}
      <div
        style={{
          fontSize: 13, fontWeight: 600, lineHeight: 1.4,
          color: hovered ? "#c0bdf5" : "#d8d8e8",
          display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical", overflow: "hidden",
          marginBottom: 4, transition: "color 0.2s",
        }}
      >
        {video.title}
      </div>
      <div style={{ fontSize: 12, color: "#555" }}>{video.author}</div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "28px 20px" }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i}>
          <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 8, background: "rgba(255,255,255,0.05)", marginBottom: 10, animation: "pulse 2s infinite" }} />
          <div style={{ height: 13, borderRadius: 4, background: "rgba(255,255,255,0.05)", marginBottom: 6, animation: "pulse 2s infinite" }} />
          <div style={{ height: 12, borderRadius: 4, background: "rgba(255,255,255,0.03)", width: "45%", animation: "pulse 2s infinite" }} />
        </div>
      ))}
    </div>
  );
}

export function MusicHomePage() {
  const [, navigate] = useLocation();

  const [chips, setChips] = useState<ChipDef[]>(() => getOrderedChips(BASE_CHIPS));
  const [activeChip, setActiveChip] = useState(0);
  const [confidence, setConfidence] = useState<0 | 1 | 2>(() => getConfidenceLevel());
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery);
  const prevChipLabel = useRef<string>("For You");

  const refreshState = useCallback(() => {
    setChips(getOrderedChips(BASE_CHIPS));
    setConfidence(getConfidenceLevel());
  }, []);

  useEffect(() => { refreshState(); }, [refreshState]);

  const isSearching = debouncedSearch.trim().length > 1;
  const activeLabel = chips[activeChip]?.label ?? "For You";
  const isForYou = !isSearching && activeLabel === "For You";

  // Build multi-queries for "For You"; recompute only when confidence changes
  const feedQueries = useMemo(
    () => buildFeedQueries(BASE_CHIPS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [confidence, isForYou],
  );

  // Increment rotation counter each time "For You" comes into view
  useEffect(() => {
    if (isForYou) incrementFeedIteration();
  }, [isForYou]);

  const singleQuery = isSearching
    ? debouncedSearch
    : chips[activeChip]?.q ?? "official music video 2024";

  // ── Data fetching ────────────────────────────────────────────────────────────

  // Multi-query parallel fetch for "For You"
  const { data: forYouVideos, isLoading: forYouLoading } = useQuery<YtVideo[]>({
    queryKey: ["yt-forYou", feedQueries.join("|")],
    queryFn: async () => {
      const results = await Promise.all(
        feedQueries.map((q) =>
          fetch(`/api/yt/videos?q=${encodeURIComponent(q)}&limit=12`).then((r) => r.json()),
        ),
      );
      const buckets: YtVideo[][] = results.map((r) => r.videos ?? []);
      return interleaveAndDedup(buckets);
    },
    enabled: isForYou,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Single-query fetch for all other chips / search
  const { data: singleData, isLoading: singleLoading } = useQuery<{ videos: YtVideo[] }>({
    queryKey: ["yt-home", singleQuery],
    queryFn: () =>
      fetch(`/api/yt/videos?q=${encodeURIComponent(singleQuery)}&limit=24`).then((r) => r.json()),
    enabled: !isForYou,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const isLoading = isForYou ? forYouLoading : singleLoading;

  // Filter already-watched videos out of "For You"
  const rawVideos: YtVideo[] = isForYou
    ? (forYouVideos ?? [])
    : (singleData?.videos ?? []);

  const videos = useMemo(() => {
    if (!isForYou || confidence === 0) return rawVideos;
    const watched = new Set(getWatchedIds());
    const filtered = rawVideos.filter((v) => !watched.has(v.id));
    // Only apply filter if it leaves at least 6 results; otherwise show everything
    return filtered.length >= 6 ? filtered : rawVideos;
  }, [rawVideos, isForYou, confidence]);

  // ── Interaction handlers ─────────────────────────────────────────────────────

  const handleChipClick = (index: number) => {
    const newLabel = chips[index]?.label;
    const oldLabel = prevChipLabel.current;

    // Negative signal on the chip we're leaving
    if (oldLabel && oldLabel !== newLabel) recordChipLeave(oldLabel);

    setActiveChip(index);
    if (newLabel) recordChipClick(newLabel);
    prevChipLabel.current = newLabel ?? "For You";
    refreshState();
  };

  const { history } = useMusicVideoHistory();
  const { favorites } = useMusicVideoFavorites();

  const handleVideoClick = (video: YtVideo) => {
    recordVideoClick(video.id, video.title, video.author, video.publishedAt);
    refreshState();
    navigate(`/music/videos/${video.id}`);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#05050c", fontFamily: "'DM Sans', sans-serif", color: "#fff" }}>

      {/* Sticky top bar */}
      <div
        style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "rgba(5,5,12,0.97)", backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          padding: "14px 32px", display: "flex", alignItems: "center", gap: 28,
        }}
      >
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 30,
          letterSpacing: "0.06em", flexShrink: 0, lineHeight: 1,
          background: "linear-gradient(135deg, #fff 0%, #c0bdf5 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          ho<span style={{ WebkitTextFillColor: "#7F77DD" }}>o</span>dMUSIC
        </span>
        <div
          style={{
            flex: 1, maxWidth: 560, margin: "0 auto",
            display: "flex", alignItems: "center",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 28, padding: "9px 20px", gap: 10,
            transition: "border-color 0.2s",
          }}
          onFocus={() => {}}
        >
          <Search size={14} color="#555" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search artists, songs, videos…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontSize: 13.5, fontFamily: "'DM Sans', sans-serif" }}
          />
        </div>
        <div style={{ width: 100, flexShrink: 0 }} />
      </div>

      {/* Filter chips */}
      {!isSearching && (
        <div
          style={{
            display: "flex", gap: 8, padding: "14px 32px",
            overflowX: "auto", scrollbarWidth: "none",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          {chips.map((chip, i) => {
            const isActive = activeChip === i;
            const isForYouChip = chip.label === "For You";
            return (
              <motion.button
                key={chip.label}
                onClick={() => handleChipClick(i)}
                whileTap={{ scale: 0.95 }}
                style={{
                  flexShrink: 0, padding: "6px 14px",
                  borderRadius: 8, cursor: "pointer", border: "none",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 6,
                  background: isActive
                    ? isForYouChip ? "linear-gradient(135deg, #7F77DD, #9D97E8)" : "#fff"
                    : isForYouChip ? "rgba(127,119,221,0.15)" : "rgba(255,255,255,0.1)",
                  color: isActive
                    ? isForYouChip ? "#fff" : "#0f0f0f"
                    : isForYouChip ? "#c0bdf5" : "#fff",
                  boxShadow: isActive && isForYouChip ? "0 0 16px rgba(127,119,221,0.4)" : "none",
                  transition: "background 0.18s, color 0.18s, box-shadow 0.18s",
                }}
              >
                {isForYouChip && (
                  <Sparkles
                    size={13}
                    style={{ color: isActive ? "#fff" : confidence >= 1 ? "#9D97E8" : "#555" }}
                  />
                )}
                {chip.label}
                {isForYouChip && confidence >= 1 && !isActive && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: confidence === 2 ? "#7F77DD" : "#555", flexShrink: 0 }} />
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* "For You" subtitle */}
      <AnimatePresence>
        {isForYou && confidence >= 1 && (
          <motion.div
            key={confidence}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              padding: "10px 24px 0", fontSize: 12,
              color: confidence === 2 ? "#9D97E8" : "#666",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Sparkles size={12} />
            {confidence === 1
              ? "Learning your taste — keep watching to personalise"
              : "Tailored to your taste · blending your top genres"}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Continue Watching / Recently Watched row */}
      {!isSearching && history.length > 0 && (
        <div style={{ padding: "28px 32px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 3, height: 18, borderRadius: 2, background: "linear-gradient(to bottom, #7F77DD, #c0bdf5)", flexShrink: 0 }} />
            <History size={13} color="#9D97E8" />
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: "0.08em", color: "#e8e6ff" }}>
              {history.some((v) => v.progress && v.progress > 5 && v.progress < 95)
                ? "Continue Watching"
                : "Recently Watched"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 14, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
            {history.slice(0, 12).map((v) => {
              const showProgress = typeof v.progress === "number" && v.progress > 5 && v.progress < 95;
              return (
                <div
                  key={v.id}
                  onClick={() => navigate(`/music/videos/${v.id}`)}
                  style={{ flexShrink: 0, width: 200, cursor: "pointer" }}
                >
                  <div style={{ position: "relative", width: 200, height: 112, borderRadius: 8, overflow: "hidden", background: "#111", marginBottom: 8 }}>
                    <img
                      src={v.thumbnail}
                      alt={v.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    />
                    {/* Progress bar */}
                    {showProgress && (
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        height: 3, background: "rgba(255,255,255,0.15)",
                      }}>
                        <div style={{
                          height: "100%",
                          width: `${v.progress}%`,
                          background: "linear-gradient(90deg, #7F77DD, #c0bdf5)",
                          borderRadius: "0 2px 2px 0",
                        }} />
                      </div>
                    )}
                    {/* "Watched" checkmark for finished videos */}
                    {typeof v.progress === "number" && v.progress >= 95 && (
                      <div style={{
                        position: "absolute", top: 6, right: 6,
                        width: 22, height: 22, borderRadius: "50%",
                        background: "rgba(127,119,221,0.9)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, color: "#fff",
                      }}>✓</div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#ddd", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{v.title}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>{v.author}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Favorites row */}
      {!isSearching && favorites.length > 0 && (
        <div style={{ padding: "24px 32px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 3, height: 18, borderRadius: 2, background: "linear-gradient(to bottom, #c0bdf5, #7F77DD)", flexShrink: 0 }} />
            <Heart size={13} color="#c0bdf5" fill="#c0bdf5" />
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: "0.08em", color: "#e8e6ff" }}>
              My Favorites
            </span>
          </div>
          <div style={{ display: "flex", gap: 14, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
            {favorites.slice(0, 12).map((v) => (
              <div
                key={v.id}
                onClick={() => navigate(`/music/videos/${v.id}`)}
                style={{ flexShrink: 0, width: 200, cursor: "pointer" }}
              >
                <div style={{ position: "relative", width: 200, height: 112, borderRadius: 8, overflow: "hidden", background: "#111", marginBottom: 8, border: "1px solid rgba(127,119,221,0.2)" }}>
                  <img src={v.thumbnail} alt={v.title} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#ddd", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{v.title}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>{v.author}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video grid */}
      <div style={{ padding: "24px 32px 60px" }}>
        {isLoading ? (
          <SkeletonGrid />
        ) : videos.length === 0 ? (
          <div style={{ textAlign: "center", color: "#555", paddingTop: 80, fontSize: 15 }}>
            No videos found
          </div>
        ) : (
          <motion.div
            key={isForYou ? feedQueries.join("|") : singleQuery}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "28px 20px" }}
          >
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} onClick={() => handleVideoClick(v)} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
