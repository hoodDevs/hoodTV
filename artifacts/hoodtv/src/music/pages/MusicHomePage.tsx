import { useEffect, useState } from "react";
import { Search, Play, ChevronRight, MonitorPlay } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { searchTracks, GENRES, artworkUrl, type Track } from "../lib/musicApi";
import type { YtVideo } from "./MusicVideosPage";
import { TrackRow } from "../components/TrackRow";
import { ArtistCard } from "../components/ArtistCard";
import { motion } from "framer-motion";

function useDebounce(value: string, ms = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

function HeroTrack({ track }: { track: Track; queue: Track[] }) {
  const [, navigate] = useLocation();
  const art = artworkUrl(track.artworkUrl100, 600);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      style={{
        position: "relative",
        width: "100%",
        minHeight: 400,
        borderRadius: 24,
        overflow: "hidden",
        marginBottom: 48,
        background: "#0a0a14",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${art})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(80px) saturate(2)",
          opacity: 0.4,
          transform: "scale(1.2)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(5,5,12,0.95) 0%, rgba(5,5,12,0.4) 50%, transparent 100%)" }} />
      
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 40,
          padding: "48px",
          height: "100%",
        }}
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          style={{ position: "relative", zIndex: 2 }}
        >
          <img
            src={art}
            alt={track.collectionName}
            style={{ width: 240, height: 240, borderRadius: 16, objectFit: "cover", flexShrink: 0, boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
          />
        </motion.div>
        
        <div style={{ zIndex: 2, flex: 1 }}>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            style={{ fontSize: 13, fontWeight: 700, color: "#9D97E8", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}
          >
            Featured Track
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, color: "#fff", lineHeight: 1, marginBottom: 12, textShadow: "0 4px 12px rgba(0,0,0,0.5)" }}
          >
            {track.trackName}
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            style={{ fontSize: 18, color: "#e0e0e0", marginBottom: 32, opacity: 0.8 }}
          >
            {track.artistName} <span style={{ margin: "0 8px", color: "#666" }}>•</span> {track.collectionName}
          </motion.div>
          
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(127,119,221,0.5)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(`/music/videos?q=${encodeURIComponent(track.artistName + " " + track.trackName)}`)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 12,
              padding: "16px 32px", borderRadius: 40,
              background: "linear-gradient(135deg, #7F77DD, #9D97E8)", border: "none", cursor: "pointer",
              color: "#fff", fontSize: 15, fontWeight: 700, letterSpacing: "0.03em",
              boxShadow: "0 8px 24px rgba(127,119,221,0.3)",
            }}
          >
            <Play size={20} fill="#fff" strokeWidth={0} />
            Watch Video
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function Section({
  title, children, onMore,
}: { title: string; children: React.ReactNode; onMore?: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      style={{ marginBottom: 48 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "#fff", letterSpacing: "0.06em", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
          {title}
        </h2>
        {onMore && (
          <motion.button
            whileHover={{ x: 5, color: "#c0bdf5" }}
            onClick={onMore}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9D97E8", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, transition: "color 0.2s" }}
          >
            See all <ChevronRight size={16} strokeWidth={2.5} />
          </motion.button>
        )}
      </div>
      {children}
    </motion.div>
  );
}

function HScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        overflowX: "auto",
        paddingBottom: 24,
        paddingTop: 8,
        scrollbarWidth: "none",
        marginLeft: -32,
        paddingLeft: 32,
        marginRight: -32,
        paddingRight: 32,
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
    <Section title="Cinematic Experiences" onMore={() => navigate("/music/videos")}>
      <HScrollRow>
        {videos.map((v, i) => (
          <motion.div
            key={v.id}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, type: "spring", stiffness: 200, damping: 20 }}
            whileHover={{ y: -8 }}
            onClick={() => navigate(`/music/videos/${v.id}`)}
            style={{ flexShrink: 0, width: 280, cursor: "pointer" }}
            className="group"
          >
            <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 12, overflow: "hidden", background: "#111", marginBottom: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <img src={v.thumbnail} alt={v.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.5s ease" }} className="group-hover:scale-105" loading="lazy" />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent 50%)" }} />
              {v.duration && (
                <span style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 6, fontFamily: "monospace", letterSpacing: "0.05em" }}>
                  {v.duration}
                </span>
              )}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.3s" }} className="group-hover:opacity-100">
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(127,119,221,0.9)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>
                  <Play size={24} fill="#fff" strokeWidth={0} style={{ marginLeft: 2 }} />
                </div>
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 4, transition: "color 0.2s" }} className="group-hover:text-[#c0bdf5]">{v.title}</div>
            <div style={{ fontSize: 12, color: "#888" }}>{v.author}</div>
          </motion.div>
        ))}
      </HScrollRow>
    </Section>
  );
}

export function MusicHomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery);
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
  ).slice(0, 10);

  const isSearching = debouncedQuery.trim().length > 1;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#05050c",
        backgroundImage: "radial-gradient(circle at 50% 0%, rgba(127,119,221,0.05) 0%, transparent 50%)",
        padding: "40px 48px",
        paddingBottom: "40px",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48 }}>
        <motion.h1 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: "#fff", letterSpacing: "0.06em", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}
        >
          ho<span style={{ color: "#7F77DD" }}>o</span>dMusic
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            padding: "12px 20px",
            width: 320,
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            transition: "border-color 0.2s",
          }}
          className="focus-within:border-[#7F77DD]"
        >
          <Search size={18} color="#888" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search artists, songs, albums…"
            style={{
              background: "none", border: "none", outline: "none",
              color: "#fff", fontSize: 14, flex: 1,
              fontFamily: "'DM Sans', sans-serif",
            }}
          />
        </motion.div>
      </div>

      {/* Search results */}
      {isSearching ? (
        <motion.div initial="hidden" animate="show" variants={containerVariants}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#aaa", marginBottom: 24, letterSpacing: "0.02em" }}>
            {searching ? "Searching the vaults…" : `Results for "${debouncedQuery}"`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {searchResults.map((t, i) => (
              <motion.div key={t.trackId} variants={itemVariants}>
                <TrackRow track={t} index={i} queue={searchResults} showArt />
              </motion.div>
            ))}
          </div>
        </motion.div>
      ) : (
        <>
          {/* Hero */}
          {featuredTrack && <HeroTrack track={featuredTrack} queue={hotTracks} />}

          {/* Top Tracks */}
          <Section title="Late Night Rotation">
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-100px" }}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 48px" }}
            >
              {hotTracks.slice(0, 16).map((t, i) => (
                <motion.div key={t.trackId} variants={itemVariants}>
                  <TrackRow track={t} index={i} queue={hotTracks} showArt />
                </motion.div>
              ))}
            </motion.div>
          </Section>

          {/* Artists */}
          <Section title="Artists to Watch" onMore={() => {}}>
            <HScrollRow>
              {uniqueArtists.map((t, i) => (
                <motion.div 
                  key={t.artistId}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, type: "spring", stiffness: 200 }}
                >
                  <ArtistCard
                    artistId={t.artistId}
                    artistName={t.artistName}
                    artworkUrl100={t.artworkUrl100}
                    genre={t.primaryGenreName}
                  />
                </motion.div>
              ))}
            </HScrollRow>
          </Section>

          {/* Music Videos */}
          <MusicVideosPreview />

          {/* Genres */}
          <Section title="Mood & Sound">
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}
            >
              {GENRES.map((g) => (
                <motion.div key={g.label} variants={itemVariants}>
                  <motion.div
                    whileHover={{ scale: 1.03, y: -4 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/music/genre/${encodeURIComponent(g.query)}?label=${encodeURIComponent(g.label)}`)}
                    style={{
                      padding: "32px 24px",
                      borderRadius: 16,
                      background: `linear-gradient(135deg, ${g.color}33, ${g.color}11)`,
                      border: `1px solid ${g.color}44`,
                      cursor: "pointer",
                      position: "relative",
                      overflow: "hidden",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                    }}
                    className="group"
                  >
                    <div style={{ position: "relative", zIndex: 2, fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "0.02em", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>{g.label}</div>
                    <motion.div
                      style={{
                        position: "absolute",
                        bottom: -20,
                        right: -20,
                        width: 120,
                        height: 120,
                        borderRadius: 16,
                        background: `linear-gradient(135deg, ${g.color}66, transparent)`,
                        transform: "rotate(15deg)",
                        zIndex: 1,
                        transition: "transform 0.4s ease",
                      }}
                      className="group-hover:rotate-0 group-hover:scale-110"
                    />
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          </Section>

        </>
      )}
    </div>
  );
}
