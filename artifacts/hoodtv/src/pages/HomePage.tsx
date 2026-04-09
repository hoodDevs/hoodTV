import { useEffect, useState } from "react";
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
    // Priority 1 — hero + above fold
    getTrending().then((d) => { setTrending(d); setLoadingTrending(false); });
    getNewReleases().then((d) => { setNewReleases(d); setLoadingNew(false); });

    // Priority 2 — first rows
    getMovies(1).then((d) => { setMovies(d); setLoadingMovies(false); });
    getTVShows(1).then((d) => { setTVShows(d); setLoadingTV(false); });

    // Priority 3 — genre / themed rows (staggered slightly so we don't hammer TMDB)
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

          {/* Crime drama TV — feels different after two movie rows */}
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
