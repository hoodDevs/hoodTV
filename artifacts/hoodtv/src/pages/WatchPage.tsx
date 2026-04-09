import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  AlertCircle, RotateCcw, Info, Wifi, Server
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

    getStreamSources(id, typeParam, season, episode, { title: titleParam })
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
    getStreamSources(id!, typeParam, season, episode, { title: titleParam })
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
      `/watch/${id}?title=${encodeURIComponent(titleParam)}&type=${typeParam}&season=${season ?? 1}&episode=${ep}`
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

      {/* ─── Cinema block: top bar + player ─── */}
      {/* Height = smaller of: full viewport OR native 16:9 + 46px control bar */}
      {/* This keeps the player tight around the video with no wasted black space */}
      <div style={{
        width: "100%",
        height: "min(100vh, calc(56.25vw + 46px))",
        minHeight: "280px",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        background: "#000",
        flexShrink: 0,
      }}>

        {/* Top bar — overlaid on player */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: "60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)",
          zIndex: 10,
          pointerEvents: "none",
        }}>
          <button
            onClick={goBack}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "20px",
              padding: "7px 16px 7px 12px",
              color: "rgba(255,255,255,0.85)",
              fontSize: "13px", fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s",
              fontFamily: "'DM Sans', sans-serif",
              pointerEvents: "all",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.65)";
              (e.currentTarget as HTMLElement).style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.45)";
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)";
            }}
          >
            <ArrowLeft size={15} />
            Back
          </button>

          <div style={{ textAlign: "center", flex: 1, padding: "0 16px", pointerEvents: "none" }}>
            {title && (
              <p style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "14px", fontWeight: 600,
                color: "#e8e8f0",
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textShadow: "0 1px 6px rgba(0,0,0,0.8)",
              }}>
                {title}
                {season !== undefined && episode !== undefined && (
                  <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 400, marginLeft: "8px", fontSize: "12px" }}>
                    S{season} · E{episode}
                  </span>
                )}
              </p>
            )}
          </div>

          <button
            onClick={() => id && setLocation(`/title/${id}?type=${typeParam}`)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "36px", height: "36px",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.65)",
              cursor: "pointer",
              transition: "all 0.2s",
              flexShrink: 0,
              pointerEvents: "all",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(127,119,221,0.25)";
              (e.currentTarget as HTMLElement).style.color = "#c0bdf5";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(127,119,221,0.4)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.45)";
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
            }}
          >
            <Info size={15} />
          </button>
        </div>

        {/* Player fills remaining cinema block */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

          {/* ── Loading state ── */}
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
                      filter: "brightness(0.15) saturate(0.4) blur(3px)",
                      transform: "scale(1.04)",
                      pointerEvents: "none",
                    }}
                  />
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, rgba(0,0,0,0.65) 100%)",
                    pointerEvents: "none",
                  }} />
                </>
              )}
              <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
                <div style={{
                  width: "56px", height: "56px",
                  borderRadius: "50%",
                  border: "2px solid rgba(127,119,221,0.12)",
                  borderTop: "2px solid #7F77DD",
                  animation: "watch-spin 0.9s linear infinite",
                  boxShadow: "0 0 28px rgba(127,119,221,0.2)",
                }} />
                <div style={{ textAlign: "center" }}>
                  <p style={{
                    fontSize: "12px", fontWeight: 500,
                    color: "rgba(255,255,255,0.45)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    Finding stream
                  </p>
                  {title && (
                    <p style={{
                      fontSize: "11px",
                      color: "rgba(255,255,255,0.2)",
                      marginTop: "5px",
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {title}{season !== undefined ? ` · S${season}E${episode}` : ""}
                    </p>
                  )}
                </div>
              </div>
              <style>{`@keyframes watch-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ── Error state ── */}
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
                    filter: "brightness(0.05) saturate(0.2)",
                    pointerEvents: "none",
                  }}
                />
              )}
              <div style={{
                position: "relative", zIndex: 1,
                textAlign: "center", maxWidth: "400px", padding: "0 28px",
              }}>
                <div style={{
                  width: "56px", height: "56px", borderRadius: "50%",
                  background: "rgba(127,119,221,0.08)",
                  border: "1px solid rgba(127,119,221,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 18px",
                }}>
                  <AlertCircle size={24} style={{ color: "#7F77DD" }} />
                </div>
                <p style={{ fontSize: "20px", fontWeight: 700, color: "#fff", marginBottom: "10px", fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.02em" }}>
                  Stream unavailable
                </p>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", marginBottom: "26px", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
                  {errorMsg || "We couldn't find a working stream right now."}
                </p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                  <button onClick={retry} style={{
                    display: "flex", alignItems: "center", gap: "7px",
                    padding: "10px 22px", borderRadius: "10px",
                    fontSize: "13px", fontWeight: 600,
                    background: "#7F77DD", color: "#fff",
                    border: "none", cursor: "pointer",
                    transition: "background 0.2s",
                    fontFamily: "'DM Sans', sans-serif",
                    boxShadow: "0 4px 20px rgba(127,119,221,0.4)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#9590e8"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#7F77DD"; }}
                  >
                    <RotateCcw size={13} /> Try again
                  </button>
                  <button onClick={goBack} style={{
                    padding: "10px 22px", borderRadius: "10px",
                    fontSize: "13px", fontWeight: 500,
                    background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
                    border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
                    transition: "background 0.2s",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                  >
                    Go back
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Video.js player ── */}
          {loadState === "ready" && streamUrl && (
            <div key={streamUrl} style={{ position: "absolute", inset: 0 }}>
              <VideoPlayer
                src={streamUrl}
                sourceType={activeStreamSource?.source_type}
                tracks={streamCaptions}
              />
            </div>
          )}

          {/* ── Bottom overlay bar: episode nav + source switcher ── */}
          {/* sits above the Video.js control bar (46px) */}
          <div style={{
            position: "absolute",
            bottom: "46px",
            left: 0, right: 0,
            padding: "40px 20px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            zIndex: 5,
            pointerEvents: "none",
            background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)",
          }}>

            {/* Episode nav */}
            {season !== undefined && episode !== undefined && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                pointerEvents: "all",
              }}>
                {episode > 1 ? (
                  <button
                    onClick={() => goToEpisode(episode - 1)}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "6px 14px",
                      borderRadius: "20px",
                      fontSize: "12px", fontWeight: 500,
                      background: "rgba(0,0,0,0.5)",
                      backdropFilter: "blur(8px)",
                      color: "rgba(255,255,255,0.7)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(127,119,221,0.25)";
                      (e.currentTarget as HTMLElement).style.color = "#c0bdf5";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.5)";
                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
                    }}
                  >
                    <ChevronLeft size={13} /> Ep {episode - 1}
                  </button>
                ) : <div />}
                <button
                  onClick={() => goToEpisode(episode + 1)}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "12px", fontWeight: 500,
                    background: "rgba(127,119,221,0.2)",
                    backdropFilter: "blur(8px)",
                    color: "#c0bdf5",
                    border: "1px solid rgba(127,119,221,0.3)",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(127,119,221,0.35)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(127,119,221,0.2)";
                  }}
                >
                  Ep {episode + 1} <ChevronRight size={13} />
                </button>
              </div>
            )}

            {/* Source switcher */}
            {loadState === "ready" && sources.length > 1 && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                pointerEvents: "all",
                position: "relative",
              }} ref={sourceMenuRef}>
                <button
                  onClick={() => setSourceMenuOpen(o => !o)}
                  style={{
                    display: "flex", alignItems: "center", gap: "7px",
                    padding: "7px 14px",
                    borderRadius: "20px",
                    fontSize: "12px", fontWeight: 600,
                    background: "rgba(0,0,0,0.55)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.75)",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(127,119,221,0.2)";
                    (e.currentTarget as HTMLElement).style.color = "#c0bdf5";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(127,119,221,0.35)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.55)";
                    (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)";
                  }}
                >
                  <Server size={12} />
                  {sources[activeSource]?.name ?? "Source"}
                  <span style={{
                    fontSize: "10px",
                    opacity: 0.5,
                    marginLeft: "2px",
                    fontWeight: 400,
                  }}>▾</span>
                </button>

                {/* Source dropdown menu */}
                {sourceMenuOpen && (
                  <div style={{
                    position: "absolute",
                    bottom: "calc(100% + 8px)",
                    left: 0,
                    background: "rgba(12,12,20,0.96)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    padding: "6px",
                    minWidth: "180px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                    zIndex: 20,
                    overflow: "hidden",
                  }}>
                    <p style={{
                      fontSize: "10px",
                      color: "rgba(255,255,255,0.25)",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      padding: "4px 10px 8px",
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
                          padding: "9px 10px",
                          borderRadius: "8px",
                          fontSize: "13px", fontWeight: activeSource === i ? 600 : 400,
                          textAlign: "left",
                          background: activeSource === i ? "rgba(127,119,221,0.18)" : "transparent",
                          color: activeSource === i ? "#c0bdf5" : "rgba(255,255,255,0.6)",
                          border: "none",
                          cursor: "pointer",
                          transition: "all 0.15s",
                          fontFamily: "'DM Sans', sans-serif",
                          gap: "8px",
                        }}
                        onMouseEnter={(e) => {
                          if (activeSource !== i) {
                            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                            (e.currentTarget as HTMLElement).style.color = "#fff";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (activeSource !== i) {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)";
                          }
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Wifi size={11} style={{ opacity: 0.5 }} />
                          {src.name}
                        </span>
                        {activeSource === i && (
                          <span style={{
                            width: "6px", height: "6px",
                            borderRadius: "50%",
                            background: "#7F77DD",
                            flexShrink: 0,
                          }} />
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

      {/* ─── Info panel — below the cinema block (scroll to see) ─── */}
      {details && (
        <div style={{
          padding: "32px 24px 48px",
          background: "#05050c",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}>
          <div style={{ maxWidth: "860px", margin: "0 auto" }}>

            {/* Title + metadata row */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "20px", marginBottom: "24px" }}>
              {details.poster && (
                <img
                  src={details.poster}
                  alt={details.title}
                  style={{
                    width: "80px",
                    aspectRatio: "2/3",
                    borderRadius: "10px",
                    objectFit: "cover",
                    flexShrink: 0,
                    border: "1px solid rgba(255,255,255,0.07)",
                    boxShadow: "0 8px 28px rgba(0,0,0,0.55)",
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0, paddingTop: "2px" }}>
                <h1 style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: "clamp(24px, 3.5vw, 36px)",
                  letterSpacing: "0.04em",
                  color: "#eeeef8",
                  marginBottom: "10px",
                  lineHeight: 1,
                }}>
                  {details.title}
                </h1>

                <div style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginBottom: "14px",
                  gap: "0",
                }}>
                  {ratingDisplay && (
                    <>
                      <span style={{
                        display: "flex", alignItems: "center", gap: "4px",
                        fontSize: "13px", fontFamily: "'DM Sans', sans-serif",
                        color: "#e8c84a", fontWeight: 700,
                      }}>
                        <span style={{ fontSize: "11px" }}>★</span>{ratingDisplay}
                      </span>
                      <Dot />
                    </>
                  )}
                  {yearDisplay && (
                    <>
                      <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif" }}>
                        {yearDisplay}
                      </span>
                      {genresDisplay.length > 0 && <Dot />}
                    </>
                  )}
                  {genresDisplay.map((g, i) => (
                    <span key={g} style={{ display: "flex", alignItems: "center", fontSize: "13px", color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif" }}>
                      {g}{i < genresDisplay.length - 1 && <Dot />}
                    </span>
                  ))}
                  <Dot />
                  <span style={{
                    fontSize: "9px", letterSpacing: "0.1em",
                    textTransform: "uppercase", color: "#9D97E8",
                    background: "rgba(127,119,221,0.1)",
                    border: "1px solid rgba(127,119,221,0.22)",
                    borderRadius: "4px", padding: "2px 7px",
                    fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                  }}>
                    {details.type === "tv" ? "Series" : "Movie"}
                  </span>
                </div>

                {details.overview && (
                  <p style={{
                    fontSize: "13.5px",
                    color: "rgba(255,255,255,0.42)",
                    lineHeight: 1.72,
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    {details.overview}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                onClick={() => id && setLocation(`/title/${id}?type=${typeParam}`)}
                style={{
                  display: "flex", alignItems: "center", gap: "7px",
                  padding: "10px 20px", borderRadius: "10px",
                  fontSize: "13px", fontWeight: 500,
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.5)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer", transition: "all 0.2s",
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)";
                  (e.currentTarget as HTMLElement).style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)";
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

function Dot() {
  return (
    <span style={{
      display: "inline-block",
      width: "3px", height: "3px",
      borderRadius: "50%",
      background: "rgba(255,255,255,0.18)",
      margin: "0 8px",
      flexShrink: 0,
      verticalAlign: "middle",
    }} />
  );
}
