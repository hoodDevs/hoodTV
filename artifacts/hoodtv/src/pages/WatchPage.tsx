import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  AlertCircle, RotateCcw, Info, Layers, Check,
  Star, Calendar, Film
} from "lucide-react";
import { getTitleDetails, getStreamSources } from "@/lib/api";
import type { TitleDetails, StreamSource } from "@/lib/api";
import { useContinueWatching } from "@/hooks/useContinueWatching";
import { VideoPlayer } from "@/components/VideoPlayer";

type LoadState = "loading" | "ready" | "error";

export default function WatchPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [details, setDetails] = useState<TitleDetails | null>(null);
  const [sources, setSources] = useState<StreamSource[]>([]);
  const [activeSource, setActiveSource] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const { addProgress } = useContinueWatching();
  const abortRef = useRef<AbortController | null>(null);
  const sourceMenuRef = useRef<HTMLDivElement>(null);

  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const season = searchParams.get("season") ? Number(searchParams.get("season")) : undefined;
  const episode = searchParams.get("episode") ? Number(searchParams.get("episode")) : undefined;
  const titleParam = searchParams.get("title") || "";
  const yearParam = searchParams.get("year") || "";
  const totalSeasonsParam = searchParams.get("total_seasons") || "1";
  const typeParam = (searchParams.get("type") as "movie" | "tv") || "movie";

  const title = details?.title || titleParam || "";
  const activeStreamSource = sources[activeSource] ?? null;
  const streamUrl = activeStreamSource?.url ?? null;
  const streamCaptions = activeStreamSource?.captions ?? [];

  useEffect(() => {
    if (!id) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoadState("loading");
    setSources([]);
    setActiveSource(0);
    setErrorMsg("");
    setSourceMenuOpen(false);

    getTitleDetails(id, typeParam).then((d) => {
      if (d) {
        setDetails(d);
        addProgress({ ...d, poster: d.poster || undefined } as any, 0, season, episode);
      }
    });

    getStreamSources(id, typeParam, season, episode, { title: titleParam, year: yearParam, totalSeasons: Number(totalSeasonsParam) })
      .then((srcs) => {
        if (!srcs || srcs.length === 0) {
          setErrorMsg("No stream found for this title.");
          setLoadState("error");
          return;
        }
        setSources(srcs);
        setLoadState("ready");
      })
      .catch((err: Error) => {
        setErrorMsg(err.message || "Could not load stream");
        setLoadState("error");
      });

    return () => abortRef.current?.abort();
  }, [id, season, episode, typeParam]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sourceMenuRef.current && !sourceMenuRef.current.contains(e.target as Node)) {
        setSourceMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function retry() {
    setLoadState("loading");
    setErrorMsg("");
    getStreamSources(id!, typeParam, season, episode, { title: titleParam, year: yearParam, totalSeasons: Number(totalSeasonsParam) })
      .then((srcs) => {
        if (!srcs || srcs.length === 0) {
          setErrorMsg("No stream found. Please try again later.");
          setLoadState("error");
          return;
        }
        setSources(srcs);
        setLoadState("ready");
      })
      .catch((err: Error) => { setErrorMsg(err.message); setLoadState("error"); });
  }

  function goToEpisode(ep: number) {
    setLocation(
      `/watch/${id}?title=${encodeURIComponent(titleParam)}&type=${typeParam}&season=${season ?? 1}&episode=${ep}&year=${yearParam}&total_seasons=${totalSeasonsParam}`
    );
  }

  function goBack() {
    if (window.history.length > 1) history.back();
    else setLocation(id ? `/title/${id}?type=${typeParam}` : "/");
  }

  const yearDisplay = details?.year || (details?.releaseDate ? new Date(details.releaseDate).getFullYear() : null);
  const ratingDisplay = details?.rating ? details.rating.toFixed(1) : null;
  const genresDisplay = details?.genres?.slice(0, 3) || [];

  return (
    <div style={{ minHeight: "100vh", background: "#05050c", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes watch-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes watch-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes watch-fadein {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .src-btn:hover { background: rgba(127,119,221,0.18) !important; color: #c0bdf5 !important; border-color: rgba(127,119,221,0.35) !important; }
        .back-btn:hover { background: rgba(0,0,0,0.7) !important; color: #fff !important; }
        .info-btn:hover { background: rgba(127,119,221,0.2) !important; color: #c0bdf5 !important; border-color: rgba(127,119,221,0.4) !important; }
        .retry-btn:hover { background: #9590e8 !important; box-shadow: 0 6px 28px rgba(127,119,221,0.55) !important; }
        .goback-btn:hover { background: rgba(255,255,255,0.09) !important; color: #fff !important; }
        .ep-prev-btn:hover { background: rgba(127,119,221,0.22) !important; color: #c0bdf5 !important; }
        .ep-next-btn:hover { background: rgba(127,119,221,0.4) !important; }
        .detail-btn:hover { background: rgba(127,119,221,0.18) !important; color: #c0bdf5 !important; border-color: rgba(127,119,221,0.32) !important; }
      `}</style>

      {/* ── Cinema block ── */}
      <div style={{
        width: "100%",
        height: "min(100vh, calc(56.25vw + 46px))",
        minHeight: "300px",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        background: "#000",
        flexShrink: 0,
      }}>

        {/* Top bar */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: "68px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)",
          zIndex: 10,
        }}>
          <button
            className="back-btn"
            onClick={goBack}
            style={{
              display: "flex", alignItems: "center", gap: "7px",
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "22px",
              padding: "8px 18px 8px 13px",
              color: "rgba(255,255,255,0.85)",
              fontSize: "13px", fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <ArrowLeft size={14} />
            Back
          </button>

          <div style={{ textAlign: "center", flex: 1, padding: "0 16px" }}>
            {title && (
              <p style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "14px", fontWeight: 600,
                color: "#e8e8f0",
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textShadow: "0 1px 8px rgba(0,0,0,0.9)",
              }}>
                {title}
                {season !== undefined && episode !== undefined && (
                  <span style={{ color: "rgba(255,255,255,0.38)", fontWeight: 400, marginLeft: "8px", fontSize: "12px" }}>
                    S{season} · E{episode}
                  </span>
                )}
              </p>
            )}
          </div>

          <button
            className="info-btn"
            onClick={() => id && setLocation(`/title/${id}?type=${typeParam}`)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "38px", height: "38px",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              transition: "all 0.2s",
              flexShrink: 0,
            }}
          >
            <Info size={15} />
          </button>
        </div>

        {/* Player area */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

          {/* Loading */}
          {loadState === "loading" && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              background: "#000",
              overflow: "hidden",
            }}>
              {details?.backdrop && (
                <>
                  <img
                    src={details.backdrop} alt="" aria-hidden
                    style={{
                      position: "absolute", inset: 0,
                      width: "100%", height: "100%",
                      objectFit: "cover",
                      filter: "brightness(0.12) saturate(0.3) blur(4px)",
                      transform: "scale(1.06)",
                      pointerEvents: "none",
                    }}
                  />
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(127,119,221,0.04) 0%, rgba(0,0,0,0.7) 100%)",
                    pointerEvents: "none",
                  }} />
                </>
              )}
              <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "28px", animation: "watch-fadein 0.4s ease" }}>
                {/* Spinner with rings */}
                <div style={{ position: "relative", width: "72px", height: "72px" }}>
                  <div style={{
                    position: "absolute", inset: 0,
                    borderRadius: "50%",
                    border: "1.5px solid rgba(127,119,221,0.08)",
                    borderTop: "1.5px solid #7F77DD",
                    animation: "watch-spin 1s linear infinite",
                    boxShadow: "0 0 32px rgba(127,119,221,0.25)",
                  }} />
                  <div style={{
                    position: "absolute", inset: "10px",
                    borderRadius: "50%",
                    border: "1px solid rgba(127,119,221,0.05)",
                    borderTop: "1px solid rgba(127,119,221,0.4)",
                    animation: "watch-spin 0.65s linear infinite reverse",
                  }} />
                  <div style={{
                    position: "absolute", inset: "20px",
                    borderRadius: "50%",
                    background: "rgba(127,119,221,0.12)",
                    animation: "watch-pulse 2s ease-in-out infinite",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Film size={14} style={{ color: "#9D97E8" }} />
                  </div>
                </div>

                <div style={{ textAlign: "center" }}>
                  <p style={{
                    fontSize: "11px", fontWeight: 600,
                    color: "rgba(255,255,255,0.38)",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    fontFamily: "'DM Sans', sans-serif",
                    marginBottom: "6px",
                  }}>
                    Finding stream
                  </p>
                  {title && (
                    <p style={{
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.18)",
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {title}{season !== undefined ? ` · S${season}E${episode}` : ""}
                    </p>
                  )}
                </div>

                {/* Pulse dots */}
                <div style={{ display: "flex", gap: "6px" }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: "5px", height: "5px",
                      borderRadius: "50%",
                      background: "#7F77DD",
                      animation: `watch-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {loadState === "error" && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "#000", overflow: "hidden",
            }}>
              {details?.backdrop && (
                <img src={details.backdrop} alt="" aria-hidden
                  style={{
                    position: "absolute", inset: 0,
                    width: "100%", height: "100%",
                    objectFit: "cover",
                    filter: "brightness(0.04) saturate(0.15)",
                    pointerEvents: "none",
                  }}
                />
              )}
              {/* Purple glow */}
              <div style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(127,119,221,0.07) 0%, transparent 70%)",
                pointerEvents: "none",
              }} />
              <div style={{
                position: "relative", zIndex: 1,
                textAlign: "center", maxWidth: "380px", padding: "0 28px",
                animation: "watch-fadein 0.35s ease",
              }}>
                <div style={{
                  width: "64px", height: "64px", borderRadius: "50%",
                  background: "rgba(127,119,221,0.08)",
                  border: "1.5px solid rgba(127,119,221,0.22)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px",
                  boxShadow: "0 0 40px rgba(127,119,221,0.12)",
                }}>
                  <AlertCircle size={26} style={{ color: "#7F77DD" }} />
                </div>
                <p style={{
                  fontSize: "22px", fontWeight: 700,
                  color: "#eeeef8", marginBottom: "10px",
                  fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: "-0.02em",
                }}>
                  Stream unavailable
                </p>
                <p style={{
                  fontSize: "13px", color: "rgba(255,255,255,0.32)",
                  marginBottom: "28px", lineHeight: 1.65,
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {errorMsg || "We couldn't find a working stream right now."}
                </p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                  <button className="retry-btn" onClick={retry} style={{
                    display: "flex", alignItems: "center", gap: "7px",
                    padding: "11px 22px", borderRadius: "12px",
                    fontSize: "13px", fontWeight: 600,
                    background: "#7F77DD", color: "#fff",
                    border: "none", cursor: "pointer",
                    transition: "all 0.2s",
                    fontFamily: "'DM Sans', sans-serif",
                    boxShadow: "0 4px 22px rgba(127,119,221,0.4)",
                  }}>
                    <RotateCcw size={13} /> Try again
                  </button>
                  <button className="goback-btn" onClick={goBack} style={{
                    padding: "11px 22px", borderRadius: "12px",
                    fontSize: "13px", fontWeight: 500,
                    background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)",
                    border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer",
                    transition: "all 0.2s",
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    Go back
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Video */}
          {loadState === "ready" && streamUrl && (
            <div key={streamUrl} style={{ position: "absolute", inset: 0 }}>
              <VideoPlayer
                src={streamUrl}
                sourceType={activeStreamSource?.source_type}
                tracks={streamCaptions}
                onError={() => {
                  if (activeSource < sources.length - 1) {
                    setActiveSource(prev => prev + 1);
                  } else {
                    setLoadState("error");
                    setErrorMsg("All sources failed. Please try again later.");
                  }
                }}
              />
            </div>
          )}

          {/* Bottom controls overlay */}
          <div style={{
            position: "absolute",
            bottom: "46px",
            left: 0, right: 0,
            padding: "48px 20px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            zIndex: 5,
            pointerEvents: "none",
            background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
          }}>

            {/* Episode nav */}
            {season !== undefined && episode !== undefined && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", pointerEvents: "all" }}>
                {episode > 1 ? (
                  <button
                    className="ep-prev-btn"
                    onClick={() => goToEpisode(episode - 1)}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "7px 15px",
                      borderRadius: "22px",
                      fontSize: "12px", fontWeight: 500,
                      background: "rgba(0,0,0,0.55)",
                      backdropFilter: "blur(10px)",
                      color: "rgba(255,255,255,0.65)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      cursor: "pointer", transition: "all 0.2s",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <ChevronLeft size={13} /> Ep {episode - 1}
                  </button>
                ) : <div />}
                <button
                  className="ep-next-btn"
                  onClick={() => goToEpisode(episode + 1)}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "7px 15px",
                    borderRadius: "22px",
                    fontSize: "12px", fontWeight: 600,
                    background: "rgba(127,119,221,0.25)",
                    backdropFilter: "blur(10px)",
                    color: "#c0bdf5",
                    border: "1px solid rgba(127,119,221,0.35)",
                    cursor: "pointer", transition: "all 0.2s",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Ep {episode + 1} <ChevronRight size={13} />
                </button>
              </div>
            )}

            {/* Source switcher */}
            {loadState === "ready" && sources.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", pointerEvents: "all", position: "relative" }} ref={sourceMenuRef}>
                <button
                  className="src-btn"
                  onClick={() => setSourceMenuOpen(o => !o)}
                  style={{
                    display: "flex", alignItems: "center", gap: "7px",
                    padding: "7px 14px",
                    borderRadius: "22px",
                    fontSize: "12px", fontWeight: 600,
                    background: "rgba(10,10,18,0.65)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.72)",
                    cursor: "pointer", transition: "all 0.2s",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <Layers size={12} style={{ opacity: 0.7 }} />
                  {sources[activeSource]?.name ?? "Source"}
                  <span style={{ fontSize: "9px", opacity: 0.45, marginLeft: "1px" }}>▾</span>
                </button>

                {sourceMenuOpen && (
                  <div style={{
                    position: "absolute",
                    bottom: "calc(100% + 10px)",
                    left: 0,
                    background: "rgba(8,8,16,0.97)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: "1px solid rgba(127,119,221,0.15)",
                    borderRadius: "14px",
                    padding: "8px",
                    minWidth: "200px",
                    boxShadow: "0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(127,119,221,0.08)",
                    zIndex: 20,
                    animation: "watch-fadein 0.15s ease",
                  }}>
                    <p style={{
                      fontSize: "10px",
                      color: "rgba(127,119,221,0.55)",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      padding: "4px 10px 9px",
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      Switch source
                    </p>
                    {sources.map((src, i) => (
                      <button
                        key={i}
                        onClick={() => { setActiveSource(i); setSourceMenuOpen(false); }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          width: "100%",
                          padding: "10px 11px",
                          borderRadius: "9px",
                          fontSize: "13px", fontWeight: activeSource === i ? 600 : 400,
                          textAlign: "left",
                          background: activeSource === i ? "rgba(127,119,221,0.16)" : "transparent",
                          color: activeSource === i ? "#c0bdf5" : "rgba(255,255,255,0.55)",
                          border: "none",
                          cursor: "pointer",
                          transition: "all 0.15s",
                          fontFamily: "'DM Sans', sans-serif",
                          gap: "8px",
                        }}
                        onMouseEnter={(e) => {
                          if (activeSource !== i) {
                            (e.currentTarget as HTMLElement).style.background = "rgba(127,119,221,0.1)";
                            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (activeSource !== i) {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)";
                          }
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <span style={{
                            width: "24px", height: "24px",
                            borderRadius: "6px",
                            background: activeSource === i ? "rgba(127,119,221,0.22)" : "rgba(255,255,255,0.06)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                          }}>
                            <Layers size={11} style={{ opacity: activeSource === i ? 1 : 0.4, color: activeSource === i ? "#9D97E8" : "inherit" }} />
                          </span>
                          {src.name}
                        </span>
                        {activeSource === i && (
                          <Check size={13} style={{ color: "#7F77DD", flexShrink: 0 }} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Info panel ── */}
      {details && (
        <div style={{ position: "relative", background: "#05050c", overflow: "hidden" }}>
          {/* Faint backdrop bleed from player */}
          {details.backdrop && (
            <div style={{
              position: "absolute",
              top: 0, left: 0, right: 0,
              height: "260px",
              backgroundImage: `url(${details.backdrop})`,
              backgroundSize: "cover",
              backgroundPosition: "center top",
              filter: "brightness(0.06) saturate(0.25) blur(2px)",
              maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)",
              pointerEvents: "none",
            }} />
          )}
          {/* Purple ambient glow */}
          <div style={{
            position: "absolute",
            top: "-80px", left: "50%",
            transform: "translateX(-50%)",
            width: "600px", height: "200px",
            background: "radial-gradient(ellipse at center, rgba(127,119,221,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative", zIndex: 1, padding: "36px 28px 52px", maxWidth: "900px", margin: "0 auto", animation: "watch-fadein 0.4s ease" }}>

            {/* Main row */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "24px", marginBottom: "28px" }}>

              {/* Poster */}
              {details.poster && (
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <img
                    src={details.poster}
                    alt={details.title}
                    style={{
                      width: "88px",
                      aspectRatio: "2/3",
                      borderRadius: "12px",
                      objectFit: "cover",
                      border: "1px solid rgba(255,255,255,0.07)",
                      boxShadow: "0 12px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(127,119,221,0.1)",
                    }}
                  />
                  {/* Playing indicator */}
                  <div style={{
                    position: "absolute",
                    bottom: "-8px", left: "50%",
                    transform: "translateX(-50%)",
                    background: "#7F77DD",
                    borderRadius: "10px",
                    padding: "3px 9px",
                    fontSize: "9px",
                    fontWeight: 700,
                    color: "#fff",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    fontFamily: "'DM Sans', sans-serif",
                    whiteSpace: "nowrap",
                    boxShadow: "0 3px 12px rgba(127,119,221,0.5)",
                  }}>
                    ▶ Now playing
                  </div>
                </div>
              )}

              {/* Text info */}
              <div style={{ flex: 1, minWidth: 0, paddingTop: "2px" }}>
                <h1 style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: "clamp(26px, 3.5vw, 38px)",
                  letterSpacing: "0.04em",
                  color: "#eeeef8",
                  marginBottom: "12px",
                  lineHeight: 1,
                }}>
                  {details.title}
                </h1>

                {/* Meta badges */}
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                  {ratingDisplay && (
                    <span style={{
                      display: "flex", alignItems: "center", gap: "4px",
                      background: "rgba(232,200,74,0.1)",
                      border: "1px solid rgba(232,200,74,0.2)",
                      borderRadius: "6px",
                      padding: "3px 9px",
                      fontSize: "12px", fontWeight: 700,
                      color: "#e8c84a",
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      <Star size={10} style={{ fill: "#e8c84a" }} />
                      {ratingDisplay}
                    </span>
                  )}
                  {yearDisplay && (
                    <span style={{
                      display: "flex", alignItems: "center", gap: "4px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "6px",
                      padding: "3px 9px",
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.45)",
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      <Calendar size={10} />
                      {yearDisplay}
                    </span>
                  )}
                  <span style={{
                    background: "rgba(127,119,221,0.12)",
                    border: "1px solid rgba(127,119,221,0.22)",
                    borderRadius: "6px",
                    padding: "3px 9px",
                    fontSize: "11px", fontWeight: 600,
                    color: "#9D97E8",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    {details.type === "tv" ? "Series" : "Movie"}
                  </span>
                  {genresDisplay.map((g) => (
                    <span key={g} style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: "6px",
                      padding: "3px 9px",
                      fontSize: "11px",
                      color: "rgba(255,255,255,0.35)",
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {g}
                    </span>
                  ))}
                </div>

                {details.overview && (
                  <p style={{
                    fontSize: "13.5px",
                    color: "rgba(255,255,255,0.4)",
                    lineHeight: 1.75,
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    {details.overview}
                  </p>
                )}
              </div>
            </div>

            {/* Divider */}
            <div style={{
              height: "1px",
              background: "linear-gradient(to right, transparent, rgba(127,119,221,0.15) 30%, rgba(127,119,221,0.15) 70%, transparent)",
              marginBottom: "22px",
            }} />

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                className="detail-btn"
                onClick={() => id && setLocation(`/title/${id}?type=${typeParam}`)}
                style={{
                  display: "flex", alignItems: "center", gap: "7px",
                  padding: "10px 20px", borderRadius: "11px",
                  fontSize: "13px", fontWeight: 500,
                  background: "rgba(127,119,221,0.08)",
                  color: "rgba(255,255,255,0.55)",
                  border: "1px solid rgba(127,119,221,0.14)",
                  cursor: "pointer", transition: "all 0.2s",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <Info size={13} /> View details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
