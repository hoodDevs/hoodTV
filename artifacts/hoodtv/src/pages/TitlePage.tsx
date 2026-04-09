import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Play, Plus, Check, ChevronDown, X, ArrowLeft, Clock } from "lucide-react";
import { MediaCard } from "@/components/MediaCard";
import { Skeleton } from "@/components/ui/skeleton";
import { getTitleDetails, getSeasonEpisodes } from "@/lib/api";
import type { TitleDetails, Episode } from "@/lib/api";
import { formatAirDate, formatReleaseDate } from "@/lib/dateUtils";
import { useWatchlist } from "@/hooks/useWatchlist";

export default function TitlePage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [details, setDetails] = useState<TitleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTrailer, setShowTrailer] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const { toggleWatchlist, isInWatchlist } = useWatchlist();

  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const hintType = searchParams.get("type") as "movie" | "tv" | null;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getTitleDetails(id, hintType ?? undefined).then((data) => {
      setDetails(data);
      setLoading(false);
      if (data?.type === "tv" && data.tmdbId && data.seasons && data.seasons.length > 0) {
        setSelectedSeason(data.seasons[0].season_number);
      }
    });
  }, [id]);

  useEffect(() => {
    if (!details || details.type !== "tv" || !details.tmdbId) return;
    setLoadingEpisodes(true);
    getSeasonEpisodes(details.tmdbId, selectedSeason).then((eps) => {
      setEpisodes(eps);
      setLoadingEpisodes(false);
    });
  }, [details, selectedSeason]);

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#0a0a0a" }}>
        <div className="w-full animate-pulse" style={{ height: "70vh", background: "#111" }} />
        <div className="px-8 py-8 max-w-7xl mx-auto" style={{ marginTop: "-140px", position: "relative", zIndex: 10 }}>
          <div className="flex gap-8">
            <Skeleton className="w-44 rounded-xl bg-[#1e1e1e]" style={{ aspectRatio: "2/3" }} />
            <div className="flex-1 pt-8">
              <Skeleton className="h-14 w-72 bg-[#1e1e1e] mb-4" />
              <Skeleton className="h-4 w-48 bg-[#1e1e1e] mb-3" />
              <Skeleton className="h-24 w-full max-w-xl bg-[#1e1e1e]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!details) return null;

  const inWatchlist = isInWatchlist(details.id);

  const yearStr = details.year || (details.releaseDate ? details.releaseDate.substring(0, 4) : "");
  const totalSeasonsStr = details.seasons?.length ? String(details.seasons.length) : "1";

  const watchUrl =
    details.type === "tv"
      ? `/watch/${details.id}?title=${encodeURIComponent(details.title)}&type=tv&season=${selectedSeason}&episode=1&year=${yearStr}&total_seasons=${totalSeasonsStr}`
      : `/watch/${details.id}?title=${encodeURIComponent(details.title)}&type=movie&year=${yearStr}`;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0a", color: "#f0f0f0" }} data-testid="title-page">

      {/* Hero backdrop */}
      <div className="relative w-full" style={{ height: "72vh", minHeight: "480px", overflow: "hidden" }}>
        {details.backdrop ? (
          <>
            <img
              src={details.backdrop}
              alt={details.title}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: "center 20%" }}
              fetchPriority="high"
              decoding="async"
            />
            {/* Dark overlay */}
            <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.35)" }} />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(135deg, #0d0318 0%, #0a0a1a 60%, #0a1a0d 100%)" }}
          />
        )}

        {/* Gradient fades */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(10,10,10,0.5) 0%, transparent 20%, transparent 50%, rgba(10,10,10,0.7) 80%, #0a0a0a 100%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to right, rgba(10,10,10,0.6) 0%, transparent 50%)",
          }}
        />

        {/* Back button */}
        <button
          onClick={() => {
            if (window.history.length > 1) {
              history.back();
            } else {
              setLocation("/");
            }
          }}
          className="absolute flex items-center gap-2 transition-colors"
          style={{ top: "84px", left: "40px", color: "rgba(255,255,255,0.6)", background: "none", border: "none", cursor: "pointer", fontSize: "13px" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}
          data-testid="back-btn"
        >
          <ArrowLeft size={18} />
          Back
        </button>
      </div>

      {/* Main content — overlaps hero */}
      <div
        className="relative z-10"
        style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 40px 80px", marginTop: "-160px" }}
      >
        <div className="flex flex-col sm:flex-row gap-8 items-end">
          {/* Poster */}
          {details.poster && (
            <div className="flex-shrink-0">
              <img
                src={details.poster}
                alt={details.title}
                className="rounded-xl shadow-2xl"
                style={{
                  width: "clamp(140px, 14vw, 200px)",
                  aspectRatio: "2/3",
                  objectFit: "cover",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                decoding="async"
                data-testid="title-poster"
              />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            {details.tagline && (
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  color: "#7F77DD",
                  fontStyle: "italic",
                  marginBottom: "10px",
                  letterSpacing: "0.02em",
                }}
              >
                {details.tagline}
              </p>
            )}

            <h1
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "clamp(40px, 5.5vw, 76px)",
                lineHeight: 0.95,
                letterSpacing: "2px",
                color: "#fff",
                marginBottom: "18px",
                textShadow: "0 4px 20px rgba(0,0,0,0.5)",
              }}
              data-testid="title-name"
            >
              {details.title}
            </h1>

            {/* Stats row */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "10px",
                marginBottom: "16px",
              }}
            >
              {(details.releaseDate || details.year) && (
                <span style={{ fontSize: "13px", color: "#999" }}>
                  {formatReleaseDate(details.releaseDate) || details.year}
                </span>
              )}

              {details.rating && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "rgba(245,197,24,0.1)",
                    border: "1px solid rgba(245,197,24,0.2)",
                    borderRadius: "4px",
                    padding: "2px 8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#f5c518",
                  }}
                >
                  ★ {details.rating.toFixed(1)}
                  {details.voteCount && (
                    <span style={{ fontWeight: 400, color: "#f5c518", opacity: 0.6, fontSize: "11px" }}>
                      ({details.voteCount.toLocaleString()})
                    </span>
                  )}
                </div>
              )}

              {details.runtime && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "12px",
                    color: "#999",
                  }}
                >
                  <Clock size={12} />
                  {Math.floor(details.runtime / 60)}h {details.runtime % 60}m
                </div>
              )}

              {details.type === "tv" && details.seasons && (
                <span style={{ fontSize: "12px", color: "#999" }}>
                  {details.seasons.length} Season{details.seasons.length !== 1 ? "s" : ""}
                </span>
              )}

              <span
                style={{
                  padding: "2px 9px",
                  borderRadius: "3px",
                  background: "rgba(127,119,221,0.18)",
                  border: "1px solid rgba(127,119,221,0.3)",
                  color: "#9D97E8",
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {details.type === "tv" ? "Series" : "Movie"}
              </span>
            </div>

            {/* Genres */}
            {details.genres && details.genres.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "7px", marginBottom: "18px" }}>
                {details.genres.map((g) => (
                  <span
                    key={g}
                    style={{
                      padding: "4px 12px",
                      borderRadius: "99px",
                      background: "#161616",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#aaa",
                      fontSize: "11px",
                    }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Overview */}
            {details.overview && (
              <p
                style={{
                  fontSize: "14px",
                  lineHeight: 1.75,
                  color: "rgba(255,255,255,0.6)",
                  marginBottom: "28px",
                  maxWidth: "580px",
                }}
                data-testid="title-overview"
              >
                {details.overview}
              </p>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              <button
                onClick={() => setLocation(watchUrl)}
                data-testid="title-play-btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "9px",
                  background: "#7F77DD",
                  color: "#fff",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "14px",
                  fontWeight: 600,
                  padding: "13px 28px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(127,119,221,0.4)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#9590e8";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 28px rgba(127,119,221,0.55)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#7F77DD";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(127,119,221,0.4)";
                }}
              >
                <Play size={17} fill="white" />
                Play
              </button>

              <button
                onClick={() => toggleWatchlist(details as any)}
                data-testid="title-watchlist-btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "rgba(255,255,255,0.08)",
                  color: "#f0f0f0",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "14px",
                  fontWeight: 500,
                  padding: "13px 22px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.14)",
                  cursor: "pointer",
                  backdropFilter: "blur(6px)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.15)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                }}
              >
                {inWatchlist ? <Check size={16} /> : <Plus size={16} />}
                {inWatchlist ? "Saved" : "+ My List"}
              </button>

              {details.trailerKey && (
                <button
                  onClick={() => setShowTrailer(true)}
                  data-testid="title-trailer-btn"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "rgba(255,255,255,0.06)",
                    color: "#aaa",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "14px",
                    fontWeight: 400,
                    padding: "13px 20px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: "pointer",
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
                  ▶ Trailer
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Cast */}
        {details.cast && details.cast.length > 0 && (
          <div style={{ marginTop: "56px" }}>
            <h2
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "22px",
                letterSpacing: "2px",
                color: "#fff",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span style={{ width: "3px", height: "18px", background: "#7F77DD", borderRadius: "2px", display: "inline-block" }} />
              Cast
            </h2>
            <div
              className="scrollbar-hide"
              style={{ display: "flex", gap: "14px", overflowX: "auto", paddingBottom: "8px" }}
            >
              {details.cast.map((member) => (
                <div
                  key={member.id}
                  className="flex-shrink-0"
                  style={{ width: "100px" }}
                  data-testid={`cast-${member.id}`}
                >
                  <div
                    style={{
                      width: "72px",
                      height: "72px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      margin: "0 auto 10px",
                      border: "2px solid rgba(127,119,221,0.2)",
                      background: "#1a1a2e",
                    }}
                  >
                    {member.profile ? (
                      <img
                        src={member.profile}
                        alt={member.name}
                        loading="lazy"
                        decoding="async"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "'Bebas Neue', sans-serif",
                          fontSize: "24px",
                          color: "#7F77DD",
                        }}
                      >
                        {member.name[0]}
                      </div>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#f0f0f0",
                      textAlign: "center",
                      lineHeight: 1.3,
                      marginBottom: "3px",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {member.name}
                  </p>
                  <p
                    style={{
                      fontSize: "10px",
                      color: "#666",
                      textAlign: "center",
                      display: "-webkit-box",
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {member.character}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Episodes (TV only) */}
        {details.type === "tv" && details.seasons && details.seasons.length > 0 && (
          <div style={{ marginTop: "56px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
              <h2
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: "22px",
                  letterSpacing: "2px",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span style={{ width: "3px", height: "18px", background: "#7F77DD", borderRadius: "2px", display: "inline-block" }} />
                Episodes
              </h2>
              <div className="relative">
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(Number(e.target.value))}
                  data-testid="season-selector"
                  style={{
                    appearance: "none",
                    padding: "7px 30px 7px 14px",
                    borderRadius: "7px",
                    color: "#f0f0f0",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    outline: "none",
                    background: "#161616",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {details.seasons.map((s) => (
                    <option key={s.season_number} value={s.season_number}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  style={{
                    position: "absolute",
                    right: "9px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#888",
                    pointerEvents: "none",
                  }}
                />
              </div>
            </div>

            {loadingEpisodes ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full bg-[#161616] rounded-xl" />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {episodes.map((ep) => (
                  <div
                    key={ep.id}
                    data-testid={`episode-${ep.episode_number}`}
                    className="group"
                    onClick={() =>
                      setLocation(
                        `/watch/${details.id}?title=${encodeURIComponent(details.title)}&type=${details.type}&season=${selectedSeason}&episode=${ep.episode_number}&year=${yearStr}&total_seasons=${totalSeasonsStr}`
                      )
                    }
                    style={{
                      display: "flex",
                      gap: "16px",
                      padding: "14px 16px",
                      borderRadius: "10px",
                      cursor: "pointer",
                      border: "1px solid rgba(255,255,255,0.04)",
                      background: "transparent",
                      transition: "background 0.2s, border-color 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(127,119,221,0.06)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(127,119,221,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.04)";
                    }}
                  >
                    {/* Episode number */}
                    <div
                      style={{
                        flexShrink: 0,
                        width: "36px",
                        height: "36px",
                        borderRadius: "6px",
                        background: "rgba(127,119,221,0.1)",
                        border: "1px solid rgba(127,119,221,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: "16px",
                        color: "#7F77DD",
                        marginTop: "2px",
                      }}
                    >
                      {ep.episode_number}
                    </div>

                    {/* Thumbnail */}
                    <div
                      style={{
                        flexShrink: 0,
                        width: "140px",
                        aspectRatio: "16/9",
                        borderRadius: "8px",
                        overflow: "hidden",
                        background: "#161616",
                        position: "relative",
                      }}
                    >
                      {ep.still_path ? (
                        <img
                          src={ep.still_path}
                          alt={ep.name}
                          loading="lazy"
                          decoding="async"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#555",
                          }}
                        >
                          <Play size={20} />
                        </div>
                      )}
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(0,0,0,0.35)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: 0,
                          transition: "opacity 0.2s",
                        }}
                        className="group-hover:!opacity-100"
                      >
                        <Play size={22} fill="white" style={{ color: "white" }} />
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#f0f0f0",
                          marginBottom: "5px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {ep.name}
                      </p>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#777",
                          lineHeight: 1.6,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {ep.overview}
                      </p>
                      {ep.air_date && (
                        <p style={{ fontSize: "11px", color: "#555", marginTop: "5px" }}>
                          {formatAirDate(ep.air_date)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* More Like This */}
        {details.similar && details.similar.length > 0 && (
          <div style={{ marginTop: "56px" }}>
            <h2
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "22px",
                letterSpacing: "2px",
                color: "#fff",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span style={{ width: "3px", height: "18px", background: "#7F77DD", borderRadius: "2px", display: "inline-block" }} />
              More Like This
            </h2>
            <div
              className="scrollbar-hide"
              style={{ display: "flex", gap: "14px", overflowX: "auto", paddingBottom: "8px" }}
            >
              {details.similar.map((item) => (
                <div key={item.id} className="snap-start flex-shrink-0">
                  <MediaCard item={item} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trailer modal */}
      {showTrailer && details.trailerKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowTrailer(false)}
          data-testid="trailer-modal"
        >
          <div
            className="relative w-full"
            style={{ maxWidth: "900px", aspectRatio: "16/9" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowTrailer(false)}
              style={{
                position: "absolute",
                top: "-44px",
                right: 0,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(255,255,255,0.6)",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}
              data-testid="trailer-close"
            >
              <X size={24} />
            </button>
            <iframe
              src={`https://www.youtube.com/embed/${details.trailerKey}?autoplay=1`}
              className="w-full h-full rounded-xl"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Trailer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
