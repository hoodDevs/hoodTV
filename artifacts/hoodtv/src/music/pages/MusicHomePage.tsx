import { useEffect, useState, useRef } from "react";
import { Search, Play, ChevronRight, MonitorPlay } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { searchTracks, GENRES, artworkUrl, type Track } from "../lib/musicApi";
import type { YtVideo } from "./MusicVideosPage";
import { useMusicPlayer } from "../context/MusicPlayerContext";
import { TrackRow } from "../components/TrackRow";
import { ArtistCard } from "../components/ArtistCard";
import { MINI_PLAYER_HEIGHT } from "../components/MiniPlayer";

function useDebounce(value: string, ms = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function HeroTrack({ track, queue }: { track: Track; queue: Track[] }) {
  const player = useMusicPlayer();
  const isActive = player.currentTrack?.trackId === track.trackId;
  const art = artworkUrl(track.artworkUrl100, 400);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: 320,
        borderRadius: 16,
        overflow: "hidden",
        marginBottom: 40,
        background: "#0d0d1a",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${art})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(60px) saturate(1.5)",
          opacity: 0.35,
          transform: "scale(1.1)",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 28,
          padding: "36px 36px",
        }}
      >
        <img
          src={art}
          alt={track.collectionName}
          style={{ width: 160, height: 160, borderRadius: 12, objectFit: "cover", flexShrink: 0, boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}
        />
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#9D97E8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            Featured Track
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: "#fff", lineHeight: 1.05, marginBottom: 8 }}>
            {track.trackName}
          </div>
          <div style={{ fontSize: 15, color: "#aaa", marginBottom: 20 }}>
            {track.artistName} · {track.collectionName}
          </div>
          <button
            onClick={() => player.play(track, queue, 0)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 24px", borderRadius: 30,
              background: "#7F77DD", border: "none", cursor: "pointer",
              color: "#fff", fontSize: 14, fontWeight: 600, letterSpacing: "0.02em",
            }}
          >
            <Play size={18} fill="#fff" strokeWidth={0} />
            {isActive && player.isPlaying ? "Playing" : "Play Preview"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title, children, onMore,
}: { title: string; children: React.ReactNode; onMore?: () => void }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "#f0f0f0", letterSpacing: "0.04em" }}>
          {title}
        </h2>
        {onMore && (
          <button
            onClick={onMore}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#7F77DD", fontSize: 12.5, display: "flex", alignItems: "center", gap: 2 }}
          >
            See all <ChevronRight size={14} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function HScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        overflowX: "auto",
        paddingBottom: 8,
        scrollbarWidth: "none",
      }}
    >
      <style>{`.hscroll::-webkit-scrollbar { display: none; }`}</style>
      {children}
    </div>
  );
}

function MusicVideosPreview() {
  const [, navigate] = useLocation();
  const { data } = useQuery<{ videos: YtVideo[] }>({
    queryKey: ["yt-videos-preview"],
    queryFn: () => fetch("/api/yt/videos?q=official+music+video+2024&limit=8").then((r) => r.json()),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const videos = data?.videos ?? [];
  if (!videos.length) return null;

  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MonitorPlay size={18} color="#7F77DD" />
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "#f0f0f0", letterSpacing: "0.04em" }}>
            Music Videos
          </h2>
        </div>
        <button
          onClick={() => navigate("/music/videos")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#7F77DD", fontSize: 12.5, display: "flex", alignItems: "center", gap: 2 }}
        >
          See all <ChevronRight size={14} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
        {videos.map((v) => (
          <div
            key={v.id}
            onClick={() => navigate(`/music/videos/${v.id}`)}
            style={{ flexShrink: 0, width: 220, cursor: "pointer" }}
            className="mv-preview-card"
          >
            <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 8, overflow: "hidden", background: "#111", marginBottom: 8 }}>
              <img src={v.thumbnail} alt={v.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              {v.duration && (
                <span style={{ position: "absolute", bottom: 5, right: 5, background: "rgba(0,0,0,0.85)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 5px", borderRadius: 3, fontFamily: "monospace" }}>
                  {v.duration}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: "#e0e0e0", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 3 }}>{v.title}</div>
            <div style={{ fontSize: 11.5, color: "#555" }}>{v.author}</div>
          </div>
        ))}
      </div>
      <style>{`.mv-preview-card:hover img { filter: brightness(1.1); } .mv-preview-card img { transition: filter 0.2s; }`}</style>
    </div>
  );
}

export function MusicHomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery);
  const player = useMusicPlayer();
  const [, navigate] = useLocation();

  const { data: hotTracks = [] } = useQuery<Track[]>({
    queryKey: ["music-hot"],
    queryFn: () => searchTracks("top hits 2024", 25),
    staleTime: 10 * 60 * 1000,
  });

  const { data: searchResults = [], isFetching: searching } = useQuery<Track[]>({
    queryKey: ["music-search", debouncedQuery],
    queryFn: () => searchTracks(debouncedQuery, 20),
    enabled: debouncedQuery.trim().length > 1,
    staleTime: 2 * 60 * 1000,
  });

  const featuredTrack = hotTracks[0] ?? null;

  const uniqueArtists = Array.from(
    new Map(hotTracks.map((t) => [t.artistId, t])).values()
  ).slice(0, 8);

  const isSearching = debouncedQuery.trim().length > 1;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#05050c",
        padding: "28px 32px",
        paddingBottom: `${MINI_PLAYER_HEIGHT + 24}px`,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "#fff", letterSpacing: "0.04em" }}>
          ho<span style={{ color: "#7F77DD" }}>o</span>dMusic
        </h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "8px 14px",
            width: 280,
          }}
        >
          <Search size={15} color="#666" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search artists, songs, albums…"
            style={{
              background: "none", border: "none", outline: "none",
              color: "#e0e0e0", fontSize: 13.5, flex: 1,
              fontFamily: "'DM Sans', sans-serif",
            }}
          />
        </div>
      </div>

      {/* Search results */}
      {isSearching ? (
        <div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
            {searching ? "Searching…" : `Results for "${debouncedQuery}"`}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {searchResults.map((t, i) => (
              <TrackRow key={t.trackId} track={t} index={i} queue={searchResults} showArt />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Hero */}
          {featuredTrack && <HeroTrack track={featuredTrack} queue={hotTracks} />}

          {/* Top Tracks */}
          <Section title="Hot Right Now">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
              {hotTracks.slice(0, 16).map((t, i) => (
                <TrackRow key={t.trackId} track={t} index={i} queue={hotTracks} showArt />
              ))}
            </div>
          </Section>

          {/* Genres */}
          <Section title="Browse by Genre">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {GENRES.map((g) => (
                <div
                  key={g.label}
                  onClick={() => navigate(`/music/genre/${encodeURIComponent(g.query)}?label=${encodeURIComponent(g.label)}`)}
                  style={{
                    padding: "20px 18px",
                    borderRadius: 10,
                    background: `linear-gradient(135deg, ${g.color}22, ${g.color}11)`,
                    border: `1px solid ${g.color}33`,
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                    transition: "transform 0.15s",
                  }}
                  className="genre-tile"
                >
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0" }}>{g.label}</div>
                  <div
                    style={{
                      position: "absolute",
                      bottom: -12,
                      right: -12,
                      width: 70,
                      height: 70,
                      borderRadius: 8,
                      background: `${g.color}33`,
                      transform: "rotate(20deg)",
                    }}
                  />
                </div>
              ))}
            </div>
          </Section>

          {/* Artists */}
          <Section title="Artists">
            <HScrollRow>
              {uniqueArtists.map((t) => (
                <ArtistCard
                  key={t.artistId}
                  artistId={t.artistId}
                  artistName={t.artistName}
                  artworkUrl100={t.artworkUrl100}
                  genre={t.primaryGenreName}
                />
              ))}
            </HScrollRow>
          </Section>

          {/* Music Videos */}
          <MusicVideosPreview />
        </>
      )}

      <style>{`
        .genre-tile:hover { transform: scale(1.02) !important; }
      `}</style>
    </div>
  );
}
