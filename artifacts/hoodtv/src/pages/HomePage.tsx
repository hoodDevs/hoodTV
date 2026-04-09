import { useEffect, useState } from "react";
import { Link } from "wouter";
import { HeroSection } from "@/components/HeroSection";
import { ContentRow } from "@/components/ContentRow";
import { SpotlightSection } from "@/components/SpotlightSection";
import {
  getTrending,
  getMovies,
  getTVShows,
  getNewReleases,
  getUpcoming,
  getTopRatedMovies,
  getTopRatedTV,
  getMoviesByGenre,
  getTVByGenre,
  MOVIE_GENRE_IDS,
  TV_GENRE_IDS,
} from "@/lib/api";
import { useContinueWatching } from "@/hooks/useContinueWatching";
import type { MediaItem } from "@/lib/api";

const GENRE_TILES = [
  { label: "Action",      id: 28,    emoji: "⚡", from: "#3a0a0a", to: "#7a1a1a", accent: "#e05555" },
  { label: "Comedy",      id: 35,    emoji: "😄", from: "#2a1e00", to: "#5a4000", accent: "#e0a820" },
  { label: "Sci-Fi",      id: 878,   emoji: "🚀", from: "#0a1a3a", to: "#1a3a6a", accent: "#5588e0" },
  { label: "Horror",      id: 27,    emoji: "💀", from: "#1a0a00", to: "#3a1a00", accent: "#c04830" },
  { label: "Romance",     id: 10749, emoji: "💕", from: "#2a0a1a", to: "#5a1a3a", accent: "#e060a0" },
  { label: "Animation",   id: 16,    emoji: "🎨", from: "#0a2a0a", to: "#1a5a1a", accent: "#50c050" },
  { label: "Crime",       id: 80,    emoji: "🔍", from: "#0f0f18", to: "#1e1e30", accent: "#7070b0" },
  { label: "Drama",       id: 18,    emoji: "🎭", from: "#1a1200", to: "#3a2800", accent: "#c08840" },
  { label: "Thriller",    id: 53,    emoji: "🔪", from: "#18001a", to: "#380038", accent: "#9040c0" },
  { label: "Documentary", id: 99,    emoji: "📹", from: "#001a1a", to: "#003838", accent: "#40b0b0" },
];

export default function HomePage() {
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [newReleases, setNewReleases] = useState<MediaItem[]>([]);
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [tvShows, setTVShows] = useState<MediaItem[]>([]);
  const [topMovies, setTopMovies] = useState<MediaItem[]>([]);
  const [topTV, setTopTV] = useState<MediaItem[]>([]);
  const [actionMovies, setActionMovies] = useState<MediaItem[]>([]);
  const [scifiMovies, setScifiMovies] = useState<MediaItem[]>([]);
  const [crimeTV, setCrimeTV] = useState<MediaItem[]>([]);
  const [comedyMovies, setComedyMovies] = useState<MediaItem[]>([]);
  const [dramaTV, setDramaTV] = useState<MediaItem[]>([]);
  const [upcoming, setUpcoming] = useState<MediaItem[]>([]);
  const [animationMovies, setAnimationMovies] = useState<MediaItem[]>([]);

  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingNew, setLoadingNew] = useState(true);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [loadingTV, setLoadingTV] = useState(true);
  const [loadingTopMovies, setLoadingTopMovies] = useState(true);
  const [loadingTopTV, setLoadingTopTV] = useState(true);
  const [loadingAction, setLoadingAction] = useState(true);
  const [loadingScifi, setLoadingScifi] = useState(true);
  const [loadingCrime, setLoadingCrime] = useState(true);
  const [loadingComedy, setLoadingComedy] = useState(true);
  const [loadingDrama, setLoadingDrama] = useState(true);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [loadingAnim, setLoadingAnim] = useState(true);

  const { continueWatching } = useContinueWatching();

  useEffect(() => {
    getTrending().then((d) => { setTrending(d); setLoadingTrending(false); });
    getNewReleases().then((d) => { setNewReleases(d); setLoadingNew(false); });

    getMovies(1).then((d) => { setMovies(d); setLoadingMovies(false); });
    getTVShows(1).then((d) => { setTVShows(d); setLoadingTV(false); });

    getTopRatedMovies().then((d) => { setTopMovies(d); setLoadingTopMovies(false); });
    getTopRatedTV().then((d) => { setTopTV(d); setLoadingTopTV(false); });

    getMoviesByGenre(MOVIE_GENRE_IDS.Action).then((d) => { setActionMovies(d); setLoadingAction(false); });
    getMoviesByGenre(MOVIE_GENRE_IDS.SciFi).then((d) => { setScifiMovies(d); setLoadingScifi(false); });
    getMoviesByGenre(MOVIE_GENRE_IDS.Comedy).then((d) => { setComedyMovies(d); setLoadingComedy(false); });
    getMoviesByGenre(MOVIE_GENRE_IDS.Animation).then((d) => { setAnimationMovies(d); setLoadingAnim(false); });

    getTVByGenre(TV_GENRE_IDS.Crime).then((d) => { setCrimeTV(d); setLoadingCrime(false); });
    getTVByGenre(TV_GENRE_IDS.Drama).then((d) => { setDramaTV(d); setLoadingDrama(false); });

    getUpcoming().then((d) => { setUpcoming(d); setLoadingUpcoming(false); });
  }, []);

  const continueWatchingItems: MediaItem[] = continueWatching.map((w) => ({
    id: w.id,
    title: w.title,
    type: w.type,
    year: w.year,
    poster: w.poster,
    backdrop: w.backdrop,
    rating: w.rating,
    overview: w.overview,
    genres: w.genres,
  }));

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0a", color: "#f0f0f0" }}>
      <HeroSection items={trending} />

      <main style={{ paddingBottom: "60px", marginTop: "-2px", position: "relative", zIndex: 10 }}>

        {/* Continue watching */}
        {continueWatchingItems.length > 0 && (
          <div style={{ paddingTop: "24px" }}>
            <ContentRow title="Continue Watching" items={continueWatchingItems} accent />
          </div>
        )}

        <div style={{ paddingTop: continueWatchingItems.length > 0 ? "8px" : "28px" }}>

          {/* Trending */}
          <ContentRow title="Trending Now" items={trending} loading={loadingTrending} accent seeAllHref="/trending" />

          {/* Browse by Genre tiles */}
          <div style={{ padding: "4px 0 40px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "11px", padding: "0 40px", marginBottom: "16px" }}>
              <div style={{ width: "3px", height: "20px", background: "#7F77DD", borderRadius: "2px" }} />
              <h2
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: "21px",
                  letterSpacing: "2px",
                  color: "#fff",
                }}
              >
                Browse by Genre
              </h2>
            </div>
            <div
              className="scrollbar-hide"
              style={{
                display: "flex",
                gap: "10px",
                overflowX: "auto",
                padding: "4px 40px 8px",
              }}
            >
              {GENRE_TILES.map((g) => (
                <Link key={g.id} href={`/movies?genre=${g.id}`}>
                  <div
                    style={{
                      flexShrink: 0,
                      width: "128px",
                      height: "72px",
                      borderRadius: "10px",
                      background: `linear-gradient(135deg, ${g.from} 0%, ${g.to} 100%)`,
                      border: `1px solid ${g.accent}28`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      cursor: "pointer",
                      transition: "transform 0.2s cubic-bezier(.22,1,.36,1), box-shadow 0.2s, border-color 0.2s",
                      textDecoration: "none",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.transform = "scale(1.05) translateY(-2px)";
                      el.style.boxShadow = `0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px ${g.accent}55`;
                      el.style.borderColor = `${g.accent}55`;
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.transform = "scale(1) translateY(0)";
                      el.style.boxShadow = "none";
                      el.style.borderColor = `${g.accent}28`;
                    }}
                  >
                    <span style={{ fontSize: "22px", lineHeight: 1 }}>{g.emoji}</span>
                    <span
                      style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: "13px",
                        letterSpacing: "1.5px",
                        color: g.accent,
                        lineHeight: 1,
                      }}
                    >
                      {g.label}
                    </span>
                  </div>
                </Link>
              ))}
              <div style={{ flexShrink: 0, width: "24px" }} />
            </div>
          </div>

          {/* Spotlight — scrollable landscape cinema row */}
          {newReleases.length >= 2 && (
            <SpotlightSection items={newReleases} title="Now In Cinemas" />
          )}

          {/* Popular */}
          <ContentRow title="Popular Movies" items={movies} loading={loadingMovies} seeAllHref="/movies" />
          <ContentRow title="Popular TV Shows" items={tvShows} loading={loadingTV} seeAllHref="/tv" />

          {/* Top Rated */}
          <ContentRow title="Top Rated Movies" items={topMovies} loading={loadingTopMovies} />
          <ContentRow title="Top Rated Series" items={topTV} loading={loadingTopTV} />

          {/* Action */}
          <ContentRow title="Action & Adventure" items={actionMovies} loading={loadingAction} />

          {/* Crime drama TV */}
          <ContentRow title="Crime & Thriller Series" items={crimeTV} loading={loadingCrime} />

          {/* Sci-Fi */}
          <ContentRow title="Sci-Fi & Fantasy" items={scifiMovies} loading={loadingScifi} />

          {/* Drama TV */}
          <ContentRow title="Drama Series" items={dramaTV} loading={loadingDrama} />

          {/* Comedy */}
          <ContentRow title="Comedy Movies" items={comedyMovies} loading={loadingComedy} />

          {/* Animation */}
          <ContentRow title="Animated Films" items={animationMovies} loading={loadingAnim} />

          {/* Coming soon */}
          <ContentRow title="Coming Soon" items={upcoming} loading={loadingUpcoming} />

        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          padding: "36px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "20px",
        }}
      >
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "22px",
            letterSpacing: "2px",
            color: "#333",
          }}
        >
          ho<span style={{ color: "#7F77DD" }}>o</span>dTV
        </div>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          {["About", "Privacy", "Terms", "Contact"].map((link) => (
            <a
              key={link}
              href="#"
              style={{ fontSize: "12px", color: "#444", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#f0f0f0"; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#444"; }}
            >
              {link}
            </a>
          ))}
        </div>
        <div style={{ fontSize: "11px", color: "#333" }}>© {new Date().getFullYear()} hoodTV</div>
      </footer>
    </div>
  );
}
